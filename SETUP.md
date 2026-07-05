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


## 4. Adding a new account later (e.g. The English Vault)

1. Copy `accounts/_template/config.example.json` to `accounts/the-english-vault/config.json`.
2. Fill in the placeholders, set `"active": true`.
3. Add its Instagram/Telegram secrets following the same naming pattern.
4. Add its prompt files under `accounts/the-english-vault/prompts/`.

No engine code changes needed — `loadActiveAccounts()` picks it up automatically.
