# Research Notes — Open-Source Tools for Future Consideration

Keep this updated as new free/open-source options come up worth evaluating later. Only add something here after actually checking it fits the $0/CPU-only constraint (see README's "External Services" section for the standard this project holds every dependency to).

## Self-hosted / open-source directories

- **selfhost.directory** (github.com/turhobr/selfhost.directory) — curated list of self-hostable open-source software. The `#devops` section is relevant to CyberShieldAlerts' content sourcing (potential future RSS/topic sources) and to the project's own infra (e.g. if we ever want a self-hosted alternative to a currently-external service). Worth a pass next time we're evaluating a new tool category rather than defaulting to whatever's best-known.

## Already evaluated and adopted

- **Manim** — whiteboard/stick-figure animation engine for English Vault's reels. Confirmed installs cleanly (needs `libcairo2-dev libpango1.0-dev` system deps), renders fast (~4s for a short test scene) on CPU, produces exactly the "hand-drawn explainer" aesthetic researched from successful Hindi-language explainer Reels. See `assets/manim/whiteboard_scene.py`.
- **Edge TTS** — free Hindi/Hinglish voiceover (network call to Microsoft's service, no local model, no GPU). Chosen over Svara-TTS after confirming Svara requires a CUDA GPU even in its "efficient" variant — a hard incompatibility with free CPU-only infrastructure, not just a performance concern.
- **Puter.js** — higher-quality AI illustration fallback (FLUX, GPT Image, Imagen 4) vs. Pollinations.ai alone.

## Evaluated and rejected (with reason, so we don't re-litigate)

- **XTTS-v2** voice cloning — best quality, but CPML license is non-commercial only; disqualified given both accounts are for monetization.
- **Svara-TTS** — see above, GPU-only.
