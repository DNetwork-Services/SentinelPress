import fs from 'fs';
import crypto from 'crypto';
import { withRetry, isTransientHttpError } from './retry.mjs';

const TELEGRAM_CAPTION_LIMIT = 4096; // sendMessage text limit

function apiUrl(botToken, method) {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

async function telegramCall(botToken, method, body) {
  return withRetry(
    async () => {
      const isForm = body instanceof FormData;
      const res = await fetch(apiUrl(botToken, method), {
        method: 'POST',
        headers: isForm ? undefined : { 'Content-Type': 'application/json' },
        body: isForm ? body : JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(`Telegram API error (${method}): ${data.description || res.status}`);
      }
      return data.result;
    },
    { isRetryable: isTransientHttpError, label: `Telegram ${method}` }
  );
}

/**
 * Sends a single photo (Telegram's sendMediaGroup requires 2-10 items,
 * so a single-image post — the news card format — needs sendPhoto instead).
 */
export async function sendSinglePhoto(botToken, chatId, imageAbsolutePath) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  const buf = fs.readFileSync(imageAbsolutePath);
  form.append('photo', new Blob([buf], { type: 'image/png' }), 'card.png');
  return telegramCall(botToken, 'sendPhoto', form);
}

/**
 * Sends the rendered slide images as a Telegram media group (album).
 * No caption here — Telegram's media-group captions are capped at 1024
 * chars and don't support inline buttons, so the full caption + approval
 * buttons go in a separate follow-up message instead.
 */
export async function sendMediaGroup(botToken, chatId, imageAbsolutePaths) {
  const form = new FormData();
  form.append('chat_id', String(chatId));

  const media = imageAbsolutePaths.map((_, i) => ({
    type: 'photo',
    media: `attach://file${i}`,
  }));
  form.append('media', JSON.stringify(media));

  for (let i = 0; i < imageAbsolutePaths.length; i++) {
    const buf = fs.readFileSync(imageAbsolutePaths[i]);
    form.append(`file${i}`, new Blob([buf], { type: 'image/png' }), `slide-${i + 1}.png`);
  }

  return telegramCall(botToken, 'sendMediaGroup', form);
}

/**
 * Computes a short, callback_data-safe reference for a post. Telegram
 * limits callback_data to 64 bytes, so we hash accountId+postId down to
 * 16 hex chars rather than embedding the (potentially long) slug directly.
 * The publish workflow (Milestone 7) resolves this hash back to the real
 * post by searching pending posts for a matching approvalHash field.
 */
export function computeApprovalHash(accountId, postId) {
  return crypto.createHash('sha1').update(`${accountId}:${postId}`).digest('hex').slice(0, 16);
}

function buildApprovalKeyboard(approvalHash, hasReel, isSingleImage) {
  const row = [{ text: isSingleImage ? '🖼️ Post Image' : '📱 Post Carousel', callback_data: `sp:carousel:${approvalHash}` }];
  if (hasReel) {
    row.push({ text: '🎬 Post Reel', callback_data: `sp:reel:${approvalHash}` });
  }
  return {
    inline_keyboard: [
      row,
      [{ text: '❌ Reject', callback_data: `sp:reject:${approvalHash}` }],
    ],
  };
}

function buildCaptionMessage(post) {
  const hashtagLine = (post.generated.hashtags || []).map((h) => `#${h}`).join(' ');
  const parts = [
    `📰 ${post.article.title}`,
    '',
    post.generated.caption,
    '',
    hashtagLine,
  ];
  return parts.join('\n').slice(0, TELEGRAM_CAPTION_LIMIT);
}

/**
 * Sends the reel video (if one exists) as a preview alongside the
 * carousel. Same approval decision (the buttons on the follow-up caption
 * message) covers publishing both formats — one review per story, not
 * a separate approval per format.
 */
export async function sendReelPreview(botToken, chatId, videoAbsolutePath) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', '🎬 Reel version');
  const buf = fs.readFileSync(videoAbsolutePath);
  form.append('video', new Blob([buf], { type: 'video/mp4' }), 'reel.mp4');
  return telegramCall(botToken, 'sendVideo', form);
}

/**
 * Sends a weekly performance summary: totals across all posts published
 * in the last 7 days, plus a callout of the best-performing one by reach.
 */
export async function sendWeeklySummary(botToken, chatId, account, summary) {
  const { totals, best, postCount } = summary;

  const lines = [
    `📊 Weekly summary — ${account.displayName}`,
    '',
    `${postCount} post(s) published in the last 7 days.`,
    '',
    `Reach: ${totals.reach}`,
    `Likes: ${totals.likes}`,
    `Comments: ${totals.comments}`,
    `Saves: ${totals.saved}`,
    `Shares: ${totals.shares}`,
  ];

  if (best) {
    lines.push('', `🏆 Best performer: "${best.title}"`);
  }

  await telegramCall(botToken, 'sendMessage', { chat_id: chatId, text: lines.join('\n') });
}

/**
 * Sends the full preview for one pending post: carousel images, then
 * the reel video (if rendered), then a text message with caption +
 * hashtags + a choice of Post Carousel / Post Reel / Reject — you pick
 * ONE format to actually publish, never both from the same review.
 * Returns the approvalHash so the caller can persist it on the post.
 */
export async function sendPostForApproval(botToken, chatId, post, imageAbsolutePaths, reelAbsolutePath) {
  if (imageAbsolutePaths.length === 1) {
    await sendSinglePhoto(botToken, chatId, imageAbsolutePaths[0]);
  } else {
    await sendMediaGroup(botToken, chatId, imageAbsolutePaths);
  }

  if (reelAbsolutePath) {
    await sendReelPreview(botToken, chatId, reelAbsolutePath);
  }

  const approvalHash = computeApprovalHash(post.accountId, post.id);
  const text = buildCaptionMessage(post) + (reelAbsolutePath ? '\n\n👆 Choose which format to publish:' : '');

  await telegramCall(botToken, 'sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: buildApprovalKeyboard(approvalHash, Boolean(reelAbsolutePath), imageAbsolutePaths.length === 1),
  });

  return approvalHash;
}
