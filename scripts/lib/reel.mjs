import { spawn } from 'child_process';
import { buildCaptionFilters } from './captions.mjs';

const REEL_WIDTH = 1080;
const REEL_HEIGHT = 1920; // 9:16 — Instagram Reels' native ratio
const FPS = 30;
const CROSSFADE_SEC = 0.5;

// Base duration per slide type, in seconds — body slides get a touch
// longer since there's more to read. Milestone 9 will replace these
// fixed durations with "however long the voiceover for that slide takes."
const DURATION_BY_TYPE = { title: 3, body: 3.5, cta: 3, newscard: 8 };

function durationForSlide(slide) {
  return DURATION_BY_TYPE[slide.type] ?? 3;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', ...args]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', (err) => {
      reject(new Error(`Failed to start ffmpeg (is it installed and on PATH?): ${err.message}`));
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}:\n${stderr.slice(-2000)}`));
    });
  });
}

/**
 * Our carousel slides are 1080x1350 (4:5). Reels want 1080x1920 (9:16).
 * Rather than stark black bars, this fills the extra space with a
 * blurred, scaled-up copy of the same slide behind the sharp centered
 * original — a common "letterbox fill" look.
 *
 * Then applies a slow zoom (Ken Burns effect) over the slide's duration,
 * so static slides don't feel like a static slideshow in video form.
 */
function buildSlideClipFilter(inputIndex, duration) {
  const frames = Math.round(duration * FPS);
  return [
    `[${inputIndex}:v]scale=${REEL_WIDTH}:${REEL_HEIGHT}:force_original_aspect_ratio=increase,` +
      `crop=${REEL_WIDTH}:${REEL_HEIGHT},gblur=sigma=30[bg${inputIndex}]`,
    `[${inputIndex}:v]scale=${REEL_WIDTH}:-1[fg${inputIndex}]`,
    `[bg${inputIndex}][fg${inputIndex}]overlay=(W-w)/2:(H-h)/2[composited${inputIndex}]`,
    `[composited${inputIndex}]scale=${REEL_WIDTH * 2}:${REEL_HEIGHT * 2},` +
      `zoompan=z='min(zoom+0.0008,1.08)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${REEL_WIDTH}x${REEL_HEIGHT}:fps=${FPS}` +
      `[clip${inputIndex}]`,
  ].join(';');
}

/**
 * Chains per-slide clips together with crossfade transitions using
 * ffmpeg's xfade filter. xfade only takes two inputs at a time, so for
 * N slides we chain N-1 sequential xfades, each one feeding into the next.
 */
function buildXfadeChain(slideDurations) {
  const parts = [];
  let cumulativeOffset = slideDurations[0] - CROSSFADE_SEC;
  let lastLabel = 'clip0';

  for (let i = 1; i < slideDurations.length; i++) {
    const outLabel = i === slideDurations.length - 1 ? 'outv' : `xf${i}`;
    parts.push(
      `[${lastLabel}][clip${i}]xfade=transition=fade:duration=${CROSSFADE_SEC}:offset=${cumulativeOffset.toFixed(2)}[${outLabel}]`
    );
    lastLabel = outLabel;
    cumulativeOffset += slideDurations[i] - CROSSFADE_SEC;
  }
  return parts.join(';');
}

/**
 * Assembles a vertical (9:16) reel video from a sequence of slide PNGs.
 *
 * By default, produces a silent (well, silent-track) video using fixed
 * per-slide-type durations — this is what Milestone 8 produces standalone.
 *
 * When called with targetTotalDuration (Milestone 9, to match narration
 * length), per-slide durations are scaled so the FINAL total (after
 * crossfade overlaps, which don't scale) lands on that target — solving
 * targetTotalDuration = scale*sum(baseDurations) - CROSSFADE_SEC*(n-1)
 * for scale, rather than naively scaling by a duration ratio, which
 * undershoots because the fixed crossfade overlap doesn't shrink with it.
 */
export async function assembleReel(slideImagePaths, slides, outputPath, { audioPath, targetTotalDuration, captionChunks, fontPath } = {}) {
  if (slideImagePaths.length !== slides.length) {
    throw new Error('slideImagePaths and slides must be the same length.');
  }
  if (slideImagePaths.length < 1) {
    throw new Error('Need at least 1 slide to build a reel.');
  }

  const isSingleSlide = slideImagePaths.length === 1;
  const baseDurations = slides.map(durationForSlide);
  const n = baseDurations.length;
  const baseSum = baseDurations.reduce((a, b) => a + b, 0);

  // With only one slide there's no crossfade overlap to account for —
  // the whole duration is just that one Ken-Burns clip.
  const scale = targetTotalDuration
    ? isSingleSlide
      ? targetTotalDuration / baseSum
      : (targetTotalDuration + CROSSFADE_SEC * (n - 1)) / baseSum
    : 1;
  const durations = baseDurations.map((d) => d * scale);

  const inputArgs = slideImagePaths.flatMap((p) => ['-loop', '1', '-i', p]);
  const perSlideFilters = slideImagePaths.map((_, i) => buildSlideClipFilter(i, durations[i]));

  // Single slide: the one Ken-Burns clip IS the output, just relabel it.
  // Multiple slides: chain crossfades between them as before.
  const transitionChain = isSingleSlide ? '[clip0]copy[outv]' : buildXfadeChain(durations);

  // Burned-in captions are an explicit Instagram ranking factor (most
  // viewers watch muted) — chained onto the final [outv] label as a
  // series of timed drawtext filters, one per caption chunk.
  let filterComplex;
  let finalLabel = 'outv';
  if (captionChunks && captionChunks.length > 0 && fontPath) {
    const captionFilters = buildCaptionFilters(captionChunks, fontPath, REEL_WIDTH, REEL_HEIGHT);
    // drawtext filters chain sequentially, each taking the previous
    // stage's output — [outv] -> [cap0] -> [cap1] -> ... -> [capN]
    const captionChain = captionFilters
      .map((filter, i) => {
        const inLabel = i === 0 ? 'outv' : `cap${i - 1}`;
        const outLabel = i === captionFilters.length - 1 ? 'captioned' : `cap${i}`;
        return `[${inLabel}]${filter}[${outLabel}]`;
      })
      .join(';');
    filterComplex = [...perSlideFilters, transitionChain, captionChain].join(';');
    finalLabel = 'captioned';
  } else {
    filterComplex = [...perSlideFilters, transitionChain].join(';');
  }

  const totalDuration = isSingleSlide
    ? durations[0]
    : durations.reduce((a, b) => a + b, 0) - CROSSFADE_SEC * (n - 1);

  const audioInputArgs = audioPath
    ? ['-i', audioPath]
    : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
  const audioMapIndex = slideImagePaths.length;

  await runFfmpeg([
    ...inputArgs,
    ...audioInputArgs,
    '-filter_complex', filterComplex,
    '-map', `[${finalLabel}]`,
    '-map', `${audioMapIndex}:a`,
    '-t', totalDuration.toFixed(2),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-shortest',
    outputPath,
  ]);

  return { durationSeconds: totalDuration };
}
