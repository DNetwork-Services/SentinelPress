import path from 'path';
import fs from 'fs';
import { loadActiveAccounts } from './lib/config.mjs';
import { listQueue, writePendingPost, queueDir } from './lib/queue.mjs';
import { synthesizeSpeech } from './lib/tts.mjs';
import { mixNarrationWithMusic } from './lib/audiomix.mjs';
import { getDurationSeconds } from './lib/media.mjs';
import { assembleReel } from './lib/reel.mjs';

async function addVoiceoverForAccount(account) {
  console.log(`\n=== ${account.displayName} ===`);

  const pending = listQueue(account.accountId, 'pending').filter(
    (p) => p.status === 'rendered' && p.render?.reelVideo && !p.render?.hasVoiceover
  );
  if (pending.length === 0) {
    console.log('No reels awaiting voiceover.');
    return 0;
  }

  const dir = queueDir(account.accountId, 'pending');
  let done = 0;

  for (const post of pending) {
    try {
      console.log(`  Adding voiceover for: "${post.article.title}"`);

      const narrationPath = path.join(dir, `${post.id}-narration.wav`);
      await synthesizeSpeech(post.generated.script, narrationPath);
      const narrationDuration = await getDurationSeconds(narrationPath);
      console.log(`    Narration: ${narrationDuration.toFixed(1)}s`);

      const mixedAudioPath = path.join(dir, `${post.id}-audio-mixed.wav`);
      const { usedMusic, trackName } = await mixNarrationWithMusic(narrationPath, narrationDuration, mixedAudioPath);
      if (usedMusic) console.log(`    Mixed with music: ${trackName}`);

      // Rebuild the reel video at the narration's actual length (silent
      // durations were an arbitrary guess in Milestone 8) using the real
      // mixed audio track instead of silence.
      const slideImagePaths = post.render.slideImages.map((f) => path.join(dir, f));
      const reelPath = path.join(dir, post.render.reelVideo);
      const { durationSeconds } = await assembleReel(slideImagePaths, post.generated.slides, reelPath, {
        audioPath: mixedAudioPath,
        targetTotalDuration: narrationDuration,
      });

      // Clean up intermediate files — only the final reel + queue JSON
      // need to be committed to git.
      fs.unlinkSync(narrationPath);
      fs.unlinkSync(mixedAudioPath);

      writePendingPost(account.accountId, {
        ...post,
        render: { ...post.render, hasVoiceover: true, reelDurationSeconds: durationSeconds, musicTrack: usedMusic ? trackName : null },
      });
      console.log(`  Done: ${post.render.reelVideo} (${durationSeconds.toFixed(1)}s, ${usedMusic ? 'with music' : 'voice only'})`);
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
    total += await addVoiceoverForAccount(account);
  }
  console.log(`\nDone. ${total} reel(s) got a voiceover.`);
}

main().catch((err) => {
  console.error('[render-voiceover] Fatal error:', err);
  process.exit(1);
});
