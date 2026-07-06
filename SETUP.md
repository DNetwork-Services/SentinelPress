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
| `PEXELS_API_KEY` | Free key from **pexels.com/api** (instant, no card) | Adds a real topic photo to each carousel's title slide. Optional — renders a plain background if unset. |

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

## 4. Milestone 6 — deploying the Cloudflare Worker (the always-on piece)

This is the one component that isn't GitHub Actions. It's small (~100 lines), free, and only does one job: catch your Telegram button tap and relay it.

### 4a. Create a GitHub PAT for the Worker to use

The Worker needs to trigger a `repository_dispatch` on this repo, which requires its own token (separate from `GITHUB_TOKEN`, which only works *inside* Actions, not from an external caller like Cloudflare).

1. GitHub → **Settings** (your account, not the repo) → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Repository access: **Only select repositories** → `SentinelPress`.
3. Permissions: **Contents: Read and write** (this alone covers repository_dispatch).
4. Generate, copy the token — you won't see it again.

### 4b. Deploy the Worker

```bash
cd cloudflare-worker
npm install -g wrangler   # one-time, free Cloudflare account needed
wrangler login
wrangler deploy
```

Then set its secrets (prompts for the value, doesn't take it as an argument — so it's never in your shell history):

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET   # make up any random string, e.g. `openssl rand -hex 32`
wrangler secret put GITHUB_PAT                # the token from step 4a
wrangler secret put GITHUB_REPO               # e.g. DNetwork-Services/SentinelPress
```

`wrangler deploy` prints a URL like `https://sentinelpress-telegram-webhook.<your-subdomain>.workers.dev` — save it, needed next.

### 4c. Point Telegram at the Worker

Run this once (replace the placeholders) — it tells Telegram to POST button taps to your Worker instead of you having to poll for them:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "<YOUR_WORKER_URL>", "secret_token": "<SAME_RANDOM_STRING_FROM_4b>"}'
```

A `{"ok":true,...}` response confirms it's wired up.

### 4d. Test it

Run the full pipeline once (`npm run research && npm run generate && npm run render && npm run notify`, or trigger `daily-pipeline.yml` manually from the Actions tab), then tap **✅ Approve** or **❌ Reject** on the Telegram message. You should see:
- The message updates to show "✅ APPROVED" or "❌ REJECTED" with the buttons removed
- A new "Handle Approval" workflow run appears in your Actions tab within a few seconds
- The post JSON moves from `data/cybershieldalerts/queue/pending/` to `.../approved/` or `.../rejected/`

Actual Instagram publishing is still Milestone 7 — for now the "Attempt publish" step in that workflow just logs its stub message.

## 5. Milestone 7 — Instagram publishing (now live)

A real constraint you should know about: Instagram's API doesn't accept direct file uploads for containers — it fetches each image from a **public HTTPS URL** you give it. That's why `handle-approval.yml` now pushes the approved images to GitHub *first* (so they're live at a `raw.githubusercontent.com` URL), then calls Instagram referencing that exact commit, then commits again afterward to record the published status. Three commits per approval is intentional, not a bug.

**One genuine uncertainty to watch for:** Meta's own documentation currently shows conflicting hosts/versions for the Graph API (`graph.facebook.com` vs the newer `graph.instagram.com`, `v21.0` vs `v25.0`) depending on which doc page you land on. I've defaulted to `graph.facebook.com` / `v21.0`, matching the Facebook-Login flow your account was set up with. If your first real publish attempt fails with an error mentioning the API version or an unrecognized endpoint, add these two secrets to override it:

| Secret name | Value to try |
|---|---|
| `GRAPH_API_HOST` | `graph.instagram.com` |
| `GRAPH_API_VERSION` | `v25.0` |

No code changes needed — `scripts/lib/instagram.mjs` reads both as env vars with the current defaults as fallback.

### Testing it for real

Approve a post via Telegram as usual. Watch the **Actions** tab for the "Handle Approval" run — it should show three green steps in sequence (resolve → commit → publish → commit) and the post should actually appear on your Instagram account as a carousel. Check `data/cybershieldalerts/queue/published/` for the moved JSON with `igMediaId` recorded.

If it fails, the post stays in `approved/` (not lost) so the next approval run — or a manual `workflow_dispatch` of `handle-approval.yml` — will retry it automatically.

## 6. Milestone 8 — Reel video assembly

`npm run render-reel` turns the same carousel slide PNGs into a vertical (1080x1920) MP4: each slide gets a slow Ken-Burns zoom for a few seconds, letterboxed to 9:16 with a blurred fill of the same image (not stark black bars), crossfading into the next slide. No extra setup needed — ffmpeg ships pre-installed on GitHub's runners, and the daily pipeline now runs this step automatically after `npm run render`.

**Deliberately not wired up yet:** the reel video isn't sent to Telegram for approval or published to Instagram. A silent video isn't very useful to review or post — Milestone 9 adds a voiceover (reading the reel script aloud) and background music, and *then* extends the approval/publish flow to handle reels alongside carousels. Until then, the `.mp4` just sits in the queue folder as a preview of the visual side.

### Testing it for real

```bash
npm run research && npm run generate && npm run render && npm run render-reel
```

Then check `data/cybershieldalerts/queue/pending/*-reel.mp4` — download it and play it locally to see the pan/zoom/crossfade in action.

## 7. Milestone 9 — Voiceover, music, and publishing reels

`npm run render-voiceover` synthesizes the reel script into speech (Piper TTS — fully offline, no API key, no cost), optionally mixes in background music from `assets/music/` at low volume, then rebuilds the reel video timed to match the narration exactly (the fixed guesses from Milestone 8 were just a placeholder). The daily pipeline now runs this automatically, and Telegram notifications include the finished reel alongside the carousel — one Approve/Reject decision covers publishing both.

**Background music is opt-in and manual on purpose.** `assets/music/` ships empty with a README pointing to a few sources (YouTube Audio Library, Pixabay Music) where you can read and accept the license yourself — that's not something worth automating sight-unseen. Reels work fine with voice-only narration if you never add any tracks.

**First run downloads a ~60MB voice model** (Piper's `en_US-lessac-medium` by default, configurable via `PIPER_VOICE`) from Hugging Face — the workflow caches it afterward so it's not re-downloaded daily.

**Publishing:** when you approve a post, `publish-instagram.mjs` now publishes the carousel *and* the reel as two separate Instagram posts from one approval. If the reel publish fails after the carousel already succeeded, that failure is isolated and recorded (`reelPublishError` in the post JSON) rather than retried — retrying would otherwise re-publish the carousel a second time, since the whole post is only marked "published" once both attempts (successful or not) are done.

### Testing it for real

```bash
npm run research && npm run generate && npm run render && npm run render-reel && npm run render-voiceover
```

Then `npm run notify` to see the full Telegram flow: carousel images, reel video with sound, caption, and buttons — approve it and watch `handle-approval.yml` publish both formats.



## 4. Adding a new account later (e.g. The English Vault)

1. Copy `accounts/_template/config.example.json` to `accounts/the-english-vault/config.json`.
2. Fill in the placeholders, set `"active": true`.
3. Add its Instagram/Telegram secrets following the same naming pattern.
4. Add its prompt files under `accounts/the-english-vault/prompts/`.

No engine code changes needed — `loadActiveAccounts()` picks it up automatically.
