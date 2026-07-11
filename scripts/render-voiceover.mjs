import path from 'path';
import fs from 'fs';
import { loadActiveAccounts } from './lib/config.mjs';
import { listQueue, writePendingPost, queueDir } from './lib/queue.mjs';
import { synthesizeSpeech } from './lib/tts.mjs';
import { synthesizeSpeechEdge } from './lib/edgetts.mjs';
import { mixNarrationWithMusic } from './lib/audiomix.mjs';
import { getDurationSeconds } from './lib/media.mjs';
import { assembleReel } from './lib/reel.mjs';
import { chunkScriptForCaptions } from './lib/captions.mjs';
import { alertFailure } from './lib/alert.mjs';

const CAPTION_FONT_ENGLISH = path.join(process.cwd(), 'assets', 'fonts', 'Poppins-Bold.ttf');
const CAPTION_FONT_HINDI = path.join(process.cwd(), 'assets', 'fonts', 'Hind-SemiBold.ttf');

/**
 * Synthesizes narration using whichever engine the account is configured
 * for. Piper (default) is English-only but fast and fully offline. Edge
 * TTS is used for Hindi/Hinglish accounts — Piper has no Hindi voice at
 * all, and the alternative (a heavy local Indic model like Svara-TTS)
 * needs a CUDA GPU even in its efficient variant, which GitHub Actions'
 * free runners don't have. Edge TTS is just a network call to Microsoft's
 * free service, so it's CPU-friendly and also gives real per-phrase
 * caption timing (via its subtitle output) instead of the word-count
 * estimate Piper's output requires.
 */
async function synthesizeNarration(account, text, outputPathBase) {
  const engine = account.tts?.engine || 'piper';

  if (engine === 'edge-tts') {
    const audioPath = `${outputPathBase}.mp3`;
    const { captionChunks } = await synthesizeSpeechEdge(text, audioPath, account.tts?.voice);
    return { audioPath, captionChunks };
  }

  const audioPath = `${outputPathBase}.wav`;
  await synthesizeSpeech(text, audioPath);
  return { audioPath, captionChunks: null };
}

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
      const narrationPathBase = path.join(dir, `${post.id}-narration`);
      const { audioPath: narrationPath, captionChunks: realCaptionChunks } = await synthesizeNarration(account, narrationText, narrationPathBase);
      const narrationDuration = await getDurationSeconds(narrationPath);
      console.log(`    Narration (${account.tts?.engine || 'piper'}): ${narrationDuration.toFixed(1)}s`);

      const mixedAudioPath = path.join(dir, `${post.id}-audio-mixed.wav`);
      const { usedMusic, trackName } = await mixNarrationWithMusic(narrationPath, narrationDuration, mixedAudioPath);
      if (usedMusic) console.log(`    Mixed with music: ${trackName}`);

      // Burned-in captions — an explicit Instagram ranking factor, and
      // most viewers watch muted. Real per-phrase timing from edge-tts's
      // subtitle output when available (accurate); otherwise falls back
      // to word-count-proportional estimation (Piper has no timing output).
      const captionChunks = realCaptionChunks && realCaptionChunks.length > 0
        ? realCaptionChunks
        : chunkScriptForCaptions(narrationText, narrationDuration);

      // Rebuild the reel video at the narration's actual length (silent
      // durations were an arbitrary guess in Milestone 8) using the real
      // mixed audio track instead of silence.
      const slideImagePaths = post.render.slideImages.map((f) => path.join(dir, f));
      const reelPath = path.join(dir, post.render.reelVideo);
      const captionFontPath = account.tts?.engine === 'edge-tts' ? CAPTION_FONT_HINDI : CAPTION_FONT_ENGLISH;
      const { durationSeconds } = await assembleReel(slideImagePaths, post.generated.slides, reelPath, {
        audioPath: mixedAudioPath,
        targetTotalDuration: narrationDuration,
        captionChunks,
        fontPath: captionFontPath,
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
