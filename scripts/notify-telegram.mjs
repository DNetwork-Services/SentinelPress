import path from 'path';
import { loadActiveAccounts } from './lib/config.mjs';
import { listQueue, writePendingPost, queueDir } from './lib/queue.mjs';
import { sendPostForApproval } from './lib/telegram.mjs';

function resolveEnvVar(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set.`);
  return value;
}

async function notifyForAccount(account, botToken) {
  console.log(`\n=== ${account.displayName} ===`);

  const pending = listQueue(account.accountId, 'pending').filter(
    (p) => p.status === 'rendered' && (!p.render?.reelVideo || p.render?.hasVoiceover)
  );
  if (pending.length === 0) {
    console.log('No posts awaiting approval notification.');
    return 0;
  }

  const chatId = resolveEnvVar(account.telegram.chatIdEnvVar);
  const dir = queueDir(account.accountId, 'pending');

  let sent = 0;
  for (const post of pending) {
    try {
      const imagePaths = post.render.slideImages.map((f) => path.join(dir, f));
      const reelPath = post.render.reelVideo ? path.join(dir, post.render.reelVideo) : null;
      console.log(`  Sending "${post.article.title}" (${imagePaths.length} slides${reelPath ? ' + reel' : ''}) to Telegram...`);
      const approvalHash = await sendPostForApproval(botToken, chatId, post, imagePaths, reelPath);

      writePendingPost(account.accountId, {
        ...post,
        status: 'awaiting_approval',
        approvalHash,
        notifiedAt: new Date().toISOString(),
      });
      console.log(`  Sent. Waiting for your approve/reject tap.`);
      sent++;
    } catch (err) {
      // Leave at status "rendered" so a future run retries the notification
      // rather than re-rendering images unnecessarily.
      console.error(`  FAILED: ${err.message}`);
    }
  }
  return sent;
}

async function main() {
  const botToken = resolveEnvVar('TELEGRAM_BOT_TOKEN');
  const accounts = loadActiveAccounts();

  let total = 0;
  for (const account of accounts) {
    total += await notifyForAccount(account, botToken);
  }
  console.log(`\nDone. ${total} post(s) sent for approval.`);
}

main().catch((err) => {
  console.error('[notify-telegram] Fatal error:', err);
  process.exit(1);
});
