# SentinelPress

A multi-tenant AI content automation engine: it researches trustworthy sources, drafts Instagram content (script, carousel, caption, hashtags), renders carousel images, sends everything to you on Telegram for a tap-to-approve/reject decision, and only then publishes via the official Instagram Graph API.

Built to run entirely on free infrastructure — GitHub Actions for scheduled/triggered compute, the git repo itself as the database, Cloudflare Workers for the one always-on piece (catching Telegram approvals). No server to keep running, no hosting bill.

**Status:** Milestones 0–11 complete. See `SETUP.md` for what to configure, and the roadmap below for what's next.

## How it works

```mermaid
flowchart LR
    A[Research] --> B[LLM Generate]
    B --> C[Render Carousel]
    C --> D[Telegram Approval]
    D -->|Approved| E[Publish to Instagram]
    D -->|Rejected| F[Discard + log]
```

## Project structure

```
accounts/<accountId>/config.json    Per-account settings, sources, brand
accounts/<accountId>/history.json   Dedupe store (which articles already used)
accounts/<accountId>/prompts/       LLM prompt templates for this account
accounts/_template/                 Copy this to add a new account
scripts/                            The engine — account-agnostic
data/<accountId>/queue/             pending/ -> approved/ -> published/
.github/workflows/                  Scheduled + event-triggered pipelines
```

## Roadmap

- [x] Milestone 0 — Instagram Graph API access set up
- [x] Milestone 1 — Repo scaffold, config schema, multi-tenant structure
- [x] Milestone 2 — Research + dedupe engine (RSS -> candidate JSON)
- [x] Milestone 3 — LLM content generation (Gemini/Groq)
- [x] Milestone 4 — Carousel image renderer
- [x] Milestone 5 — Telegram notifier
- [x] Milestone 6 — Cloudflare Worker webhook + approve/reject buttons
- [x] Milestone 4b — Real topic photos on title slides (Pexels, free tier)
- [x] Milestone 7 — Instagram publish agent
- [x] Milestone 8 — Reel video assembly (ffmpeg: pans/zooms/crossfades from slides)
- [x] Milestone 9 — Reel voiceover (Piper TTS) + music, reels wired into Telegram approval + Instagram publish
- [x] Milestone 10 — Analytics agent + weekly summary
- [x] Milestone 11 — Hardening: retries, error alerts, docs
- [ ] Milestone 12 — Add The English Vault as a second account

## Troubleshooting

**A step failed and I got a 🚨 Telegram alert — now what?**
Check the **Actions** tab for that workflow run; the alert includes the failing script's name and the first 500 characters of the error, but the full log (including any retry attempts leading up to it) is in the run itself.

**"No pending post found with approvalHash..." in the Handle Approval log.**
Not a bug — this means the tap was already processed (Telegram retries webhook delivery on any non-2xx response, so a duplicate delivery is expected occasionally) or the post was somehow already moved. Safe to ignore if it only happens occasionally.

**A script failed with a JSON parse error on `history.json`.**
`loadHistory()` catches this and falls back to empty history rather than crashing — check the warning log for which account's file is corrupted, then fix it manually on GitHub (valid shape: `{"processedUrls": [], "lastUpdated": null}`).

**Gemini/Groq/Telegram/Instagram calls failing intermittently.**
These now retry automatically (exponential backoff, up to 3 attempts) for transient failures — network errors, 429 rate limits, 5xx server errors. A call that fails immediately without retrying means the error was classified as non-transient (e.g. a genuine 401/403 auth problem, or bad request parameters) — check the error message for what's actually wrong rather than assuming it'll resolve itself.

**ffmpeg / Piper not found.**
Both are installed fresh in each workflow run (`apt-get install ffmpeg`, `pip install piper-tts`) rather than assumed pre-installed — if either step is missing from a workflow you're editing, that's why a later step would fail with an ENOENT-style error.

**No Telegram alert arrived for a failed step.**
`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` need to be set at the **job level** (not just on individual steps) for `alertFailure()` to reach them regardless of which step fails — this is already how `daily-pipeline.yml` and `handle-approval.yml` are set up; keep that pattern if you add new steps.

## License

Private project — no license granted for reuse.
