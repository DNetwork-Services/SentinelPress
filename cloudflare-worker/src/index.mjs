// SentinelPress - Telegram webhook receiver
//
// This is the ONLY always-on component in the whole system. Everything
// else runs on GitHub Actions' schedule/triggers. This Worker's job is
// small and deliberate:
//   1. Verify the request really came from Telegram (secret token check)
//   2. Immediately acknowledge the button tap (Telegram requires this fast)
//   3. Edit the original message so you can see the tap registered
//   4. Fire a repository_dispatch event so GitHub Actions does the real work
//      (resolving which post this is and moving it through the queue)
//
// This Worker never touches the repo, Instagram, or the LLM — it only
// relays. Deliberately minimal blast radius for the one piece that's
// exposed to the public internet.

async function answerCallbackQuery(botToken, callbackQueryId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function editMessage(botToken, chatId, messageId, newText) {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      reply_markup: { inline_keyboard: [] }, // remove the buttons so it can't be tapped twice
    }),
  });
}

async function dispatchToGitHub(env, eventType, approvalHash) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'SentinelPress-Worker',
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: { approvalHash },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub dispatch failed (${res.status}): ${body}`);
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('OK', { status: 200 });
    }

    // Verify this request actually came from Telegram, not a random caller
    // hitting our public URL. Set via the secret_token param on setWebhook.
    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const callbackQuery = update.callback_query;
    if (!callbackQuery || !callbackQuery.data) {
      // Not a button tap (could be some other Telegram update type) — ignore.
      return new Response('OK', { status: 200 });
    }

    const [prefix, action, approvalHash] = callbackQuery.data.split(':');
    if (prefix !== 'sp' || !['approve', 'reject'].includes(action) || !approvalHash) {
      return new Response('OK', { status: 200 });
    }

    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const originalText = callbackQuery.message.text || '';

    try {
      // Acknowledge fast so Telegram doesn't show a loading spinner / timeout error.
      await answerCallbackQuery(
        env.TELEGRAM_BOT_TOKEN,
        callbackQuery.id,
        action === 'approve' ? 'Approved ✅' : 'Rejected ❌'
      );

      await editMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        messageId,
        `${originalText}\n\n${action === 'approve' ? '✅ APPROVED' : '❌ REJECTED'}`
      );

      await dispatchToGitHub(env, action === 'approve' ? 'post-approved' : 'post-rejected', approvalHash);

      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error(err);
      // Still return 200 — Telegram will retry delivery on non-2xx, which
      // would just re-trigger the same (possibly already-partially-applied)
      // action. Better to log and let a human notice than to double-fire.
      return new Response('OK (error logged)', { status: 200 });
    }
  },
};
