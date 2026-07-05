import { spawn } from 'child_process';

const REEL_WIDTH = 1080;
const REEL_HEIGHT = 1920; // 9:16 — Instagram Reels' native ratio
const FPS = 30;
const CROSSFADE_SEC = 0.5;

// Base duration per slide type, in seconds — body slides get a touch
// longer since there's more to read. Milestone 9 will replace these
// fixed durations with "however long the voiceover for that slide takes."
const DURATION_BY_TYPE = { title: 3, body: 3.5, cta: 3 };

function durationForSlide(slide) {
  return DURATION_BY_TYPE[slide.type] ?? 3;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', ...args]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
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
 * No audio track yet (Milestone 9 adds voiceover + music) — a silent
 * track is included so the file is a well-formed video+audio container,
 * which some platforms/players expect even when there's nothing to hear.
 */
export async function assembleReel(slideImagePaths, slides, outputPath) {
  if (slideImagePaths.length !== slides.length) {
    throw new Error('slideImagePaths and slides must be the same length.');
  }
  if (slideImagePaths.length < 2) {
    throw new Error('Need at least 2 slides to build a reel with transitions.');
  }

  const durations = slides.map(durationForSlide);
  const inputArgs = slideImagePaths.flatMap((p) => ['-loop', '1', '-i', p]);

  const perSlideFilters = slideImagePaths.map((_, i) => buildSlideClipFilter(i, durations[i]));
  const xfadeChain = buildXfadeChain(durations);
  const filterComplex = [...perSlideFilters, xfadeChain].join(';');

  const totalDuration = durations.reduce((a, b) => a + b, 0) - CROSSFADE_SEC * (durations.length - 1);

  await runFfmpeg([
    ...inputArgs,
    '-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`,
    '-filter_complex', filterComplex,
    '-map', '[outv]',
    '-map', `${slideImagePaths.length}:a`,
    '-t', totalDuration.toFixed(2),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-shortest',
    outputPath,
  ]);

  return { durationSeconds: totalDuration };
}
