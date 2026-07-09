import path from 'path';

const WORDS_PER_CHUNK = 6; // short enough to read at a glance mid-scroll

/**
 * Splits narration text into caption chunks, timed proportionally to
 * word count across the known total duration. This is an approximation
 * (Piper doesn't give us word-level timestamps without a separate forced-
 * alignment step), but proportional-by-word-count is what most caption
 * tools do anyway and reads naturally in practice.
 */
export function chunkScriptForCaptions(narrationText, totalDuration, wordsPerChunk = WORDS_PER_CHUNK) {
  const words = narrationText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
  }

  const totalWords = words.length;
  let elapsed = 0;
  return chunks.map((text) => {
    const chunkWords = text.split(/\s+/).length;
    const duration = (chunkWords / totalWords) * totalDuration;
    const start = elapsed;
    elapsed += duration;
    return { text, start, end: elapsed };
  });
}

/**
 * Escapes text for safe use inside an ffmpeg drawtext filter string.
 * drawtext treats backslash, single-quote, colon, comma, and percent as
 * syntactically significant — an unescaped apostrophe (very common in
 * narration: "don't", "it's") or colon will break the whole filter graph
 * or silently truncate the text. Order matters: backslash first, since
 * later escapes introduce backslashes that must not themselves be re-escaped.
 */
function escapeForDrawtext(text) {
  return text
    .replace(/\\/g, '') // backslashes essentially never appear in real narration — strip rather than risk fragile escaping
    .replace(/'/g, '\u2019') // typographic apostrophe instead of escaping — reads identically, zero escaping risk
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/%/g, '\\%');
}

/**
 * Builds one drawtext filter per caption chunk, each active only during
 * its own time window (enable='between(t,start,end)'), positioned in the
 * lower-third with a semi-transparent background bar for readability
 * regardless of what's happening in the video behind it. Positioned above
 * the slide's own footer (progress bar + counter) to avoid overlapping it.
 */
export function buildCaptionFilters(chunks, fontPath, canvasWidth, canvasHeight) {
  const fontSize = 54;
  const yPosition = Math.round(canvasHeight * 0.72); // above the slide footer, below center

  return chunks.map(({ text, start, end }) => {
    const escaped = escapeForDrawtext(text);
    return (
      `drawtext=fontfile='${fontPath}':text='${escaped}':fontsize=${fontSize}:fontcolor=white:` +
      `box=1:boxcolor=black@0.55:boxborderw=20:` +
      `x=(w-text_w)/2:y=${yPosition}:` +
      `line_spacing=8:` +
      `enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`
    );
  });
}
