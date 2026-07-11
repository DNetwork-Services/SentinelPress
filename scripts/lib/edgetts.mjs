import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const DEFAULT_VOICE = process.env.EDGE_TTS_VOICE || 'hi-IN-SwaraNeural';

function run(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('edge-tts', args);
    let stderr = '';
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.on('error', (err) => {
      reject(new Error(`Failed to start edge-tts (is it installed and on PATH?): ${err.message}`));
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`edge-tts exited with code ${code}:\n${stderr.slice(-1000)}`));
    });
  });
}

/**
 * Parses edge-tts's SRT subtitle output into the same
 * { text, start, end } chunk shape captions.mjs already produces, so it
 * plugs directly into buildCaptionFilters with no changes needed there.
 * This is REAL per-phrase timing from the TTS engine itself — a step up
 * from captions.mjs's word-count proportional estimate (used for Piper,
 * which has no equivalent timing output).
 */
function parseSrtToChunks(srtContent) {
  const blocks = srtContent.trim().split(/\n\n+/);
  const chunks = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timeMatch) continue;

    const toSeconds = (h, m, s, ms) => parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
    const start = toSeconds(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
    const end = toSeconds(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
    const text = lines.slice(2).join(' ').trim();

    if (text) chunks.push({ text, start, end });
  }

  return chunks;
}

/**
 * Synthesizes text via Microsoft Edge's free online TTS service — no
 * local model, no GPU, just a network call, so it's a good fit for
 * CPU-only GitHub Actions runners in a way a heavy local Indic model
 * (e.g. Svara-TTS, which needs a CUDA GPU even in its efficient variant)
 * is not. Returns both the audio path and real per-phrase caption timing
 * parsed from the subtitle output.
 */
export async function synthesizeSpeechEdge(text, outputAudioPath, voice = DEFAULT_VOICE) {
  const subtitlePath = path.join(os.tmpdir(), `edge-tts-${Date.now()}.srt`);

  await run([
    '--text', text,
    '--voice', voice,
    '--write-media', outputAudioPath,
    '--write-subtitles', subtitlePath,
  ]);

  let captionChunks = [];
  try {
    const srtContent = fs.readFileSync(subtitlePath, 'utf-8');
    captionChunks = parseSrtToChunks(srtContent);
    fs.unlinkSync(subtitlePath);
  } catch (err) {
    console.warn(`[edgetts] Could not read subtitle timing (${err.message}) — captions will fall back to word-count estimation.`);
  }

  return { audioPath: outputAudioPath, captionChunks };
}
