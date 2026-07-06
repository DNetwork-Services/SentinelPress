import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const DEFAULT_VOICE = process.env.PIPER_VOICE || 'en_US-lessac-medium';
const VOICE_DIR = path.join(process.cwd(), '.piper-voices');

function run(command, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stderr = '';
    if (input) {
      proc.stdin.write(input);
      proc.stdin.end();
    }
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}:\n${stderr.slice(-1000)}`));
    });
    proc.on('error', reject);
  });
}

/**
 * Downloads the voice model files if not already cached in .piper-voices/.
 * These are ~60MB and rarely change, so caching across runs (e.g. via
 * GitHub Actions cache) avoids re-downloading daily — see SETUP.md.
 */
async function ensureVoiceDownloaded(voice) {
  const onnxPath = path.join(VOICE_DIR, `${voice}.onnx`);
  if (fs.existsSync(onnxPath)) return;

  fs.mkdirSync(VOICE_DIR, { recursive: true });
  console.log(`  Downloading Piper voice "${voice}" (first run only, ~60MB)...`);
  await run('python3', ['-m', 'piper.download_voices', voice, '--download-dir', VOICE_DIR]);
}

/**
 * Synthesizes text into a WAV file using Piper (fully offline neural TTS,
 * no API key). Returns the output path.
 */
export async function synthesizeSpeech(text, outputWavPath, voice = DEFAULT_VOICE) {
  await ensureVoiceDownloaded(voice);

  await run('piper', [
    '--model', path.join(VOICE_DIR, `${voice}.onnx`),
    '--output_file', outputWavPath,
  ], { input: text });

  return outputWavPath;
}
