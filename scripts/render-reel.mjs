import path from 'path';
import { loadActiveAccounts } from './lib/config.mjs';
import { listQueue, writePendingPost, queueDir } from './lib/queue.mjs';
import { assembleReel } from './lib/reel.mjs';
import { alertFailure } from './lib/alert.mjs';

async function renderReelForAccount(account) {
  console.log(`\n=== ${account.displayName} ===`);

  // Reel assembly runs on posts that already have carousel images rendered.
  const pending = listQueue(account.accountId, 'pending').filter((p) => p.status === 'rendered' && !p.render?.reelVideo);
  if (pending.length === 0) {
    console.log('No posts awaiting reel assembly.');
    return 0;
  }

  const dir = queueDir(account.accountId, 'pending');
  let done = 0;
  for (const post of pending) {
    try {
      console.log(`  Assembling reel for: "${post.article.title}"`);
      const slideImagePaths = post.render.slideImages.map((f) => path.join(dir, f));
      const outputFileName = `${post.id}-reel.mp4`;
      const outputPath = path.join(dir, outputFileName);

      const { durationSeconds } = await assembleReel(slideImagePaths, post.generated.slides, outputPath);

      writePendingPost(account.accountId, {
        ...post,
        render: { ...post.render, reelVideo: outputFileName, reelDurationSeconds: durationSeconds },
      });
      console.log(`  Done: ${outputFileName} (${durationSeconds.toFixed(1)}s)`);
      done++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
    }
  }
  return done;
}

async function main() {
  const accounts = loadActiveAccounts();
  let total = 0;
  for (const account of accounts) {
    total += await renderReelForAccount(account);
  }
  console.log(`\nDone. ${total} reel(s) assembled.`);
}

main().catch(async (err) => {
  console.error('[render-reel] Fatal error:', err);
  await alertFailure('render-reel', err);
  process.exit(1);
});
