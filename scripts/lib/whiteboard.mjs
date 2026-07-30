import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCENE_DIR = path.join(process.cwd(), 'assets', 'manim');
const SCENE_FILE = path.join(SCENE_DIR, 'whiteboard_scene.py');
const PARAMS_PATH = path.join(SCENE_DIR, 'params.json');

function findFileRecursive(dir, fileName) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(fullPath, fileName);
      if (found) return found;
    } else if (entry.name === fileName) {
      return fullPath;
    }
  }
  return null;
}

function runManim(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('manim', args, { cwd: SCENE_DIR });
    let stderr = '';
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.stdout.on('data', () => {}); // manim is chatty on stdout; only care about failures
    proc.on('error', (err) => {
      reject(new Error(`Failed to start manim (is it installed and on PATH?): ${err.message}`));
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`manim exited with code ${code}:\n${stderr.slice(-2000)}`));
    });
  });
}

/**
 * Splits body text into short lines suitable for the whiteboard scene's
 * one-line-at-a-time reveal (Manim's Text renders best as short phrases,
 * not wrapped paragraphs like Satori/CSS handles for the static cards).
 */
function splitBodyIntoLines(body, maxLines = 3, maxCharsPerLine = 46) {
  const sentences = (body || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  const lines = [];
  for (const sentence of sentences) {
    if (lines.length >= maxLines) break;
    if (sentence.length <= maxCharsPerLine) {
      lines.push(sentence.trim());
    } else {
      // Break an overly long sentence at the nearest space before the limit.
      const cut = sentence.lastIndexOf(' ', maxCharsPerLine);
      lines.push(sentence.slice(0, cut > 0 ? cut : maxCharsPerLine).trim());
    }
  }
  return lines;
}

/**
 * Renders the whiteboard-style explainer video for one post, timed to
 * match targetTotalDuration (the real narration length). Returns the
 * path to the rendered MP4 (silent — audio is muxed on separately, same
 * pattern as the Ken-Burns reel path in reel.mjs).
 */
export async function renderWhiteboardVideo(slide, brand, accountHandle, targetTotalDuration, outputPath) {
  const params = {
    headlineHighlight: slide.headlineHighlight || slide.text || '',
    headlineRest: slide.headlineRest || '',
    bodyLines: splitBodyIntoLines(slide.body || slide.text || ''),
    hindiSummary: slide.hindiSummary || '',
    accountHandle,
    primaryColorHex: brand.primaryColor,
    secondaryColorHex: brand.secondaryColor,
    targetTotalDuration,
  };
  fs.writeFileSync(PARAMS_PATH, JSON.stringify(params, null, 2));

  // -qh = high quality preset. Manim's output subfolder naming (e.g.
  // "1080p60") varies by version/config, so search for the file rather
  // than assume the exact path.
  await runManim(['-qh', '--output_file', 'rendered.mp4', 'whiteboard_scene.py', 'Explainer']);

  const mediaDir = path.join(SCENE_DIR, 'media', 'videos');
  const renderedPath = findFileRecursive(mediaDir, 'rendered.mp4');
  if (!renderedPath) {
    throw new Error(`Manim reported success but "rendered.mp4" was not found anywhere under ${mediaDir}`);
  }
  fs.copyFileSync(renderedPath, outputPath);

  // Clean up Manim's working files — only the final copied MP4 matters.
  fs.rmSync(path.join(SCENE_DIR, 'media'), { recursive: true, force: true });
  fs.rmSync(PARAMS_PATH, { force: true });

  return outputPath;
}
