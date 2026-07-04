// Milestone 5 will implement:
//   1. Send the rendered images + caption to Telegram (bot API, sendPhoto/sendMediaGroup)
//   2. Attach inline Approve / Edit / Reject buttons
//
// Milestone 6 will implement the OTHER half of this: a Cloudflare Worker
// that receives the button tap via Telegram webhook and fires a
// `repository_dispatch` event back into this repo to trigger publish.mjs.

console.log('[notify-telegram] Milestone 5 will implement Telegram preview + approval buttons.');
