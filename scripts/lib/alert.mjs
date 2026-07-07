/**
 * Sends a Telegram alert when a script fails fatally. Best-effort and
 * silent-on-its-own-failure: if Telegram isn't configured (env vars
 * missing) or the alert itself fails to send, we log that and move on —
 * an alerting failure must never mask or replace the original error,
 * which is still thrown/printed by the caller regardless.
 */
export async function alertFailure(scriptName, error) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('[alert] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set — skipping failure alert.');
    return;
  }

  const text = [
    `🚨 SentinelPress: "${scriptName}" failed`,
    '',
    error.message.slice(0, 500),
    '',
    'Check the Actions tab for the full log.',
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (alertErr) {
    console.warn(`[alert] Failed to send failure alert itself: ${alertErr.message}`);
  }
}
