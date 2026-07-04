// Milestone 2 will implement:
//   1. Fetch each source in account.sources (RSS parsing, same pattern as
//      the existing cybershieldalerts.vercel.app fetch-rss.mjs)
//   2. Filter out anything already in history.processedUrls
//   3. Filter out anything older than account.content.maxArticleAgeDays
//   4. Score/rank remaining candidates, pick the day's top story
//   5. Write it to data/<accountId>/queue/pending/<slug>.json
//   6. Append the chosen URL to history.processedUrls and saveHistory()
//
// For now this just proves the config loader works end-to-end.

import { loadActiveAccounts } from './lib/config.mjs';

const accounts = loadActiveAccounts();

console.log(`[research] Found ${accounts.length} active account(s):`);
for (const account of accounts) {
  console.log(`  - ${account.displayName} (${account.sources.length} sources configured)`);
}

console.log('[research] Milestone 2 will implement the actual fetch/dedupe/select logic.');
