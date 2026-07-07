/**
 * Retries an async function with exponential backoff. Meant for transient
 * failures (network blips, 5xx, rate limits) — NOT for genuine errors like
 * bad parameters or auth failures, which will just fail the same way every
 * time and shouldn't waste retries. Callers pass isRetryable to distinguish
 * the two; defaults to "retry everything" for simplicity where that
 * distinction doesn't matter much.
 */
export async function withRetry(fn, { retries = 3, baseDelayMs = 1000, isRetryable = () => true, label = 'operation' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryable(err)) throw err;
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(`  [retry] ${label} failed (attempt ${attempt + 1}/${retries + 1}): ${err.message.slice(0, 150)} — retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * A reasonable default for "is this worth retrying" across our external
 * API calls: network-level failures (no HTTP response at all) and 429/5xx
 * responses are transient; everything else (400/401/403/404, bad JSON,
 * validation errors) will just fail identically every time.
 */
export function isTransientHttpError(err) {
  const msg = err.message || '';
  if (/network|ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(msg)) return true;
  const statusMatch = msg.match(/\b(4\d\d|5\d\d)\b/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    return status === 429 || status >= 500;
  }
  return false;
}
