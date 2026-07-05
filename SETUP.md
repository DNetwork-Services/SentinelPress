# SentinelPress — Setup

## 1. Add GitHub Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret** on this repo, and add:

| Secret name | Value | From |
|---|---|---|
| `CYBERSHIELDALERTS_IG_ACCESS_TOKEN` | Your Instagram access token | Milestone 0 |
| `CYBERSHIELDALERTS_IG_BUSINESS_ID` | Your Instagram Business Account ID | Milestone 0 |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot's token | Milestone 5 (create via @BotFather) |
| `TELEGRAM_CHAT_ID` | Your personal Telegram chat ID | Milestone 5 |
| `GEMINI_API_KEY` | Free-tier key from **Google AI Studio** (ai.google.dev) | Milestone 3 — now required |
| `GROQ_API_KEY` | Free-tier key from **console.groq.com** | Milestone 3 — optional but recommended as automatic fallback |

None of these ever get written into a code file — scripts read them only via `process.env.X` at runtime, and the workflow files map `secrets.X` to that env var. I (Claude) will never see or ask for the actual values.

## 2. Repo settings to check

- **Actions permissions**: Settings → Actions → General → Workflow permissions → set to **"Read and write permissions"**. Without this, the pipeline can't commit generated content back to the repo.
- **Branch protection on `main`**: if you add a "require pull request" rule later (like on your other repo), the direct-push steps in these workflows will need the same auto-merge fix we used there. For now, leave `main` unprotected unless you have a specific reason not to.

## 3. Verify the scaffold works today

```bash
npm ci
npm run research
```

This won't fetch real news yet (Milestone 2) — it just proves the account config loads correctly. You should see:

```
[research] Found 1 active account(s):
  - CyberShield Alerts (3 sources configured)
[research] Milestone 2 will implement the actual fetch/dedupe/select logic.
```

## 3b. Testing Milestone 3 (LLM generation) for real

Once `GEMINI_API_KEY` (and optionally `GROQ_API_KEY`) are set locally (create a `.env` file — never commit it — or just export them in your shell):

```bash
npm run research   # fetches real news, queues one story
npm run generate   # calls the LLM, fills in caption/script/hashtags/slides
cat data/cybershieldalerts/queue/pending/*.json
```

Check the output looks grounded in the actual article — no invented CVEs, stats, or quotes. If the carousel step fails with "did not return valid JSON," that's usually the model wrapping its answer in prose despite instructions — rerun, or try switching `GEMINI_MODEL`/`GROQ_MODEL` env vars to a different model.

## 3c. Testing Milestone 4 (carousel rendering) for real

```bash
npm run render
```

Renders every post at `status: "generated"` into branded PNGs (1080x1350) using the account's brand colors from `config.json`, and saves them alongside the post JSON in `data/<accountId>/queue/pending/`. Open one to check text isn't overflowing and colors match your brand.

Font: bundled `Poppins` (static weights, `assets/fonts/`) — Satori needs raw TTF/OTF data, not system fonts or variable fonts (variable fonts from Google Fonts' current `Inter` release failed to parse — a known Satori/opentype.js compatibility gap), so static-weight files are committed to the repo rather than fetched at runtime. To change the typeface, swap in different static-weight TTF files and update `loadFonts()` in `scripts/render-carousel.mjs`.

## 3d. Testing Milestone 5 (Telegram notifier) for real

With `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set:

```bash
npm run notify
```

You should get a Telegram message from your bot: the carousel images as an album, followed by a text message with the caption/hashtags and **✅ Approve** / **❌ Reject** buttons. Tapping them won't do anything yet — that wiring is Milestone 6. This step just confirms delivery looks right.

One thing to get right before this works: your bot can only message you if you've started a conversation with it first. Search for your bot's username in Telegram and hit **Start** once — otherwise `sendMediaGroup`/`sendMessage` will fail with a "chat not found" error.



## 4. Adding a new account later (e.g. The English Vault)

1. Copy `accounts/_template/config.example.json` to `accounts/the-english-vault/config.json`.
2. Fill in the placeholders, set `"active": true`.
3. Add its Instagram/Telegram secrets following the same naming pattern.
4. Add its prompt files under `accounts/the-english-vault/prompts/`.

No engine code changes needed — `loadActiveAccounts()` picks it up automatically.
