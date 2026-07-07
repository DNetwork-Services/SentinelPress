import path from 'path';
import fs from 'fs';
import { loadActiveAccounts } from './lib/config.mjs';
import { listQueue, writePendingPost, queueDir } from './lib/queue.mjs';
import { synthesizeSpeech } from './lib/tts.mjs';
import { mixNarrationWithMusic } from './lib/audiomix.mjs';
import { getDurationSeconds } from './lib/media.mjs';
import { assembleReel } from './lib/reel.mjs';
import { alertFailure } from './lib/alert.mjs';

// Backstop cleanup in case the LLM still slips in a conversational
// preamble or structural label despite the prompt now explicitly
// forbidding it — this is what was causing Piper to narrate things like
// "Here's your reel script:" before the actual content.
function cleanScriptForNarration(script) {
  let cleaned = script.trim();

  // Strip a leading conversational preamble line (e.g. "Here's your script:",
  // "Sure, here's a 30-second reel script:") — these end in a colon and
  // precede the real content, unlike the narration itself.
  const preambleMatch = cleaned.match(/^(here'?s?|sure|okay|certainly)[^\n]{0,80}:\s*\n+/i);
  if (preambleMatch) {
    cleaned = cleaned.slice(preambleMatch[0].length);
  }

  // Strip structural labels at the start of a line. Extended whitelist
  // rather than a fully generic "any capitalized word + colon" pattern —
  // the latter risks stripping legitimate spoken phrasing that happens to
  // start with "Word:" (e.g. "Update: patch your VPN now" as an actual
  // spoken line, not a label).
  const knownLabels = [
    'hook', 'intro', 'introduction', 'opening', 'closing', 'outro', 'cta',
    'call to action', 'scene\\s*\\d*', 'line\\s*\\d*', 'part\\s*\\d*', 'step\\s*\\d*',
    'what happened', 'why it matters', 'the fix', 'the impact', 'bottom line',
    'takeaway', 'summary', 'narration', 'voiceover', 'script',
  ];
  cleaned = cleaned.replace(new RegExp(`^(${knownLabels.join('|')})\\s*:\\s*`, 'gim'), '');
  cleaned = cleaned.replace(/^[\[(][^\])]+[\])]\s*/gm, '');

  // Strip wrapping quotes if the whole thing got quoted.
  cleaned = cleaned.replace(/^["'](.*)["']$/s, '$1');

  return cleaned.trim();
}

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

      const narrationText = cleanScriptForNarration(post.generated.script);
      const narrationPath = path.join(dir, `${post.id}-narration.wav`);
      await synthesizeSpeech(narrationText, narrationPath);
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

main().catch(async (err) => {
  console.error('[render-voiceover] Fatal error:', err);
  await alertFailure('render-voiceover', err);
  process.exit(1);
});
