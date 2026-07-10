import { init } from '@heyputer/puter.js/src/init.cjs';

// Model choice: FLUX.1 [dev] is a strong open-weight model with good
// prompt following and fast generation — a solid default. Override via
// PUTER_IMAGE_MODEL if you want to try others (see developer.puter.com
// for the full catalog: GPT Image, Imagen 4, Ideogram, Stable Diffusion 3).
const DEFAULT_MODEL = process.env.PUTER_IMAGE_MODEL || 'black-forest-labs/flux-1.1-pro';

/**
 * Generates an AI illustration via Puter.js — a genuine quality upgrade
 * over Pollinations.ai (real production models, not a lightweight demo
 * model), still free (Puter's "User-Pays" model covers usage through
 * the account tied to PUTER_AUTH_TOKEN, not a per-call API key you pay
 * for directly). Returns null on any failure so the caller can fall
 * back to the procedural mood background rather than break the render.
 *
 * Real uncertainty worth knowing: Puter's free-tier rate limits aren't
 * clearly documented anywhere. If this starts failing consistently with
 * a rate-limit-shaped error, that's likely why — the fallback chain
 * means posts still render fine either way, just with a plainer background.
 */
export async function fetchPuterIllustration(slide) {
  const authToken = process.env.PUTER_AUTH_TOKEN;
  if (!authToken) return null;

  const prompt = `${slide?.imageQuery || 'abstract technology background'}, digital illustration, vibrant colors, clean modern style, no text, no watermark`;

  try {
    const puter = init(authToken);
    const result = await puter.ai.txt2img(prompt, { model: DEFAULT_MODEL });

    // Node.js has no DOM, so the browser API's "HTMLImageElement" return
    // shape doesn't directly apply — handle the couple of plausible
    // shapes defensively rather than assume one.
    let dataUri;
    if (typeof result === 'string' && result.startsWith('data:')) {
      dataUri = result;
    } else if (result?.src && typeof result.src === 'string') {
      dataUri = result.src;
    } else {
      throw new Error(`Unexpected response shape from puter.ai.txt2img: ${typeof result}`);
    }

    return { dataUri, source: 'puter' };
  } catch (err) {
    console.warn(`[puterImage] Generation failed (${err.message}) — trying next fallback.`);
    return null;
  }
}
