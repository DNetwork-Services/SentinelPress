import fs from 'fs';
import path from 'path';

const ACCOUNTS_DIR = path.join(process.cwd(), 'accounts');

/**
 * Load a single account's config.json by its folder name (accountId).
 */
export function loadAccount(accountId) {
  const configPath = path.join(ACCOUNTS_DIR, accountId, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`No config found for account "${accountId}" at ${configPath}`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return { ...config, _dir: path.join(ACCOUNTS_DIR, accountId) };
}

/**
 * Load every active account (skips accounts/_template and any account
 * with "active": false). This is what lets us add English Vault later
 * by just dropping a new folder in accounts/ — no engine code changes.
 */
export function loadActiveAccounts() {
  const entries = fs.readdirSync(ACCOUNTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'));

  return entries
    .map((e) => loadAccount(e.name))
    .filter((account) => account.active);
}

/**
 * Read an account's dedupe history (list of already-processed article URLs).
 * If the file is corrupted (bad JSON — e.g. a bad manual edit, or a race
 * between two workflow runs writing it at once), logs a warning and falls
 * back to empty history rather than crashing the whole pipeline. Losing
 * dedupe history is recoverable (worst case: an old article gets
 * reconsidered); crashing every future run is not.
 */
export function loadHistory(account) {
  const historyPath = path.join(account._dir, 'history.json');
  if (!fs.existsSync(historyPath)) {
    return { processedUrls: [], lastUpdated: null };
  }

  const raw = fs.readFileSync(historyPath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(
      `[config] WARNING: ${historyPath} contains invalid JSON (${err.message}). ` +
        `Falling back to empty history — dedupe state for this account was reset. ` +
        `Check for a bad manual edit or a race between overlapping workflow runs.`
    );
    return { processedUrls: [], lastUpdated: null };
  }
}

/**
 * Persist an updated history back to disk (caller is responsible for
 * committing the change to git — see scripts/research.mjs).
 */
export function saveHistory(account, history) {
  const historyPath = path.join(account._dir, 'history.json');
  history.lastUpdated = new Date().toISOString();
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');
}
