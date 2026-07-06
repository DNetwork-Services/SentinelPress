import fs from 'fs';
import path from 'path';
import { loadActiveAccounts } from './lib/config.mjs';
import { listQueue, analyticsDir } from './lib/queue.mjs';
import { getCarouselInsights, getReelInsights } from './lib/instagram.mjs';
import { sendWeeklySummary } from './lib/telegram.mjs';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set.`);
  return value;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function collectAnalyticsForAccount(account) {
  console.log(`\n=== ${account.displayName} ===`);

  const published = listQueue(account.accountId, 'published');
  const recent = published.filter((p) => p.publishedAt && Date.now() - new Date(p.publishedAt).getTime() <= SEVEN_DAYS_MS);

  if (recent.length === 0) {
    console.log('No posts published in the last 7 days.');
    return null;
  }

  const accessToken = requireEnv(account.instagram.accessTokenEnvVar);
  const results = [];

  for (const post of recent) {
    const entry = { title: post.article.title, publishedAt: post.publishedAt, carousel: null, reel: null };

    if (post.igMediaId) {
      try {
        entry.carousel = await getCarouselInsights(post.igMediaId, accessToken);
      } catch (err) {
        console.error(`  Failed to fetch carousel insights for "${post.article.title}": ${err.message}`);
      }
    }

    if (post.igReelMediaId) {
      try {
        entry.reel = await getReelInsights(post.igReelMediaId, accessToken);
      } catch (err) {
        console.error(`  Failed to fetch reel insights for "${post.article.title}": ${err.message}`);
      }
    }

    results.push(entry);
    console.log(`  ${post.article.title}: carousel=${JSON.stringify(entry.carousel)} reel=${JSON.stringify(entry.reel)}`);
  }

  // Persist the raw snapshot (git-as-database, same pattern as everything else).
  const dir = analyticsDir(account.accountId);
  const snapshotPath = path.join(dir, `weekly-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(results, null, 2) + '\n');

  return results;
}

function summarize(results) {
  const totals = { reach: 0, likes: 0, comments: 0, saved: 0, shares: 0 };
  let best = null;
  let bestReach = -1;

  for (const entry of results) {
    for (const source of [entry.carousel, entry.reel]) {
      if (!source) continue;
      for (const key of Object.keys(totals)) {
        totals[key] += source[key] || 0;
      }
    }
    const reach = (entry.carousel?.reach || 0) + (entry.reel?.reach || 0);
    if (reach > bestReach) {
      bestReach = reach;
      best = entry;
    }
  }

  return { totals, best, postCount: results.length };
}

async function main() {
  const accounts = loadActiveAccounts();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  for (const account of accounts) {
    const results = await collectAnalyticsForAccount(account);
    if (!results) continue;

    const summary = summarize(results);
    console.log(`\n  Weekly totals:`, summary.totals);

    if (botToken) {
      const chatId = requireEnv(account.telegram.chatIdEnvVar);
      await sendWeeklySummary(botToken, chatId, account, summary);
    }
  }
}

main().catch((err) => {
  console.error('[analytics] Fatal error:', err);
  process.exit(1);
});
