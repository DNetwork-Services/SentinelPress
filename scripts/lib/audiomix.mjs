import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const MUSIC_DIR = path.join(process.cwd(), 'assets', 'music');
const MUSIC_VOLUME_DB = -20; // well under the narration so it never competes with speech

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', ...args]);
    let stderr = '';
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}:\n${stderr.slice(-1500)}`));
    });
  });
}

/**
 * Picks a random track from assets/music/. Returns null if the folder
 * doesn't exist or is empty — background music is optional, sourced by
 * the account owner (see SETUP.md) rather than auto-fetched, since music
 * licensing needs a human to actually verify the terms.
 */
function pickRandomMusicTrack() {
  if (!fs.existsSync(MUSIC_DIR)) return null;
  const files = fs.readdirSync(MUSIC_DIR).filter((f) => /\.(mp3|wav|m4a)$/i.test(f));
  if (files.length === 0) return null;
  return path.join(MUSIC_DIR, files[Math.floor(Math.random() * files.length)]);
}

/**
 * Combines narration with a looped/trimmed, volume-ducked music bed into
 * a single audio track of exactly narrationDuration seconds. If no music
 * track is available, just returns the narration as-is (still valid).
 */
export async function mixNarrationWithMusic(narrationWavPath, narrationDuration, outputPath) {
  const musicTrack = pickRandomMusicTrack();

  if (!musicTrack) {
    console.log('    No background music found in assets/music/ — using narration only.');
    fs.copyFileSync(narrationWavPath, outputPath);
    return { usedMusic: false };
  }

  await runFfmpeg([
    '-i', narrationWavPath,
    '-stream_loop', '-1', '-i', musicTrack,
    '-filter_complex',
    `[1:a]volume=${MUSIC_VOLUME_DB}dB,atrim=0:${narrationDuration}[music];` +
      `[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
    '-map', '[aout]',
    '-t', String(narrationDuration),
    outputPath,
  ]);

  return { usedMusic: true, trackName: path.basename(musicTrack) };
}
