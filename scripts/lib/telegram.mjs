import fs from 'fs';
import crypto from 'crypto';

const TELEGRAM_CAPTION_LIMIT = 4096; // sendMessage text limit

function apiUrl(botToken, method) {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

async function telegramCall(botToken, method, body) {
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

function buildApprovalKeyboard(approvalHash) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `sp:approve:${approvalHash}` },
        { text: '❌ Reject', callback_data: `sp:reject:${approvalHash}` },
      ],
    ],
  };
}

function buildCaptionMessage(post) {
  const hashtagLine = (post.generated.hashtags || []).map((h) => `#${h}`).join(' ');
  const photoCredit = post.render?.photoCredit;
  const parts = [
    `📰 ${post.article.title}`,
    '',
    post.generated.caption,
    '',
    hashtagLine,
  ];
  if (photoCredit) {
    parts.push('', `📷 Photo by ${photoCredit.photographer} on Pexels`);
  }
  return parts.join('\n').slice(0, TELEGRAM_CAPTION_LIMIT);
}

/**
 * Sends the full preview for one pending post: images first, then a
 * text message with caption + hashtags + Approve/Reject buttons.
 * Returns the approvalHash so the caller can persist it on the post.
 */
export async function sendPostForApproval(botToken, chatId, post, imageAbsolutePaths) {
  await sendMediaGroup(botToken, chatId, imageAbsolutePaths);

  const approvalHash = computeApprovalHash(post.accountId, post.id);
  await telegramCall(botToken, 'sendMessage', {
    chat_id: chatId,
    text: buildCaptionMessage(post),
    reply_markup: buildApprovalKeyboard(approvalHash),
  });

  return approvalHash;
}
