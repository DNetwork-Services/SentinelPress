import { spawn } from 'child_process';

export function getDurationSeconds(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => { stdout += c.toString(); });
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.on('error', (err) => {
      reject(new Error(`Failed to start ffprobe (is it installed and on PATH?): ${err.message}`));
    });
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe failed: ${stderr}`));
      resolve(parseFloat(stdout.trim()));
    });
  });
}
