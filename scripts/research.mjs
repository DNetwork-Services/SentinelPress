import { loadActiveAccounts, loadHistory, saveHistory } from './lib/config.mjs';
import { fetchFeed } from './lib/rss.mjs';
import { pickTopArticles } from './lib/rank.mjs';
import { writePendingPost, slugify } from './lib/queue.mjs';
import { alertFailure } from './lib/alert.mjs';

async function researchAccount(account) {
  console.log(`\n=== ${account.displayName} ===`);

  const history = loadHistory(account);
  const alreadyProcessed = new Set(history.processedUrls);
  const maxAgeMs = (account.content?.maxArticleAgeDays ?? 3) * 24 * 60 * 60 * 1000;
  const now = Date.now();

  let allCandidates = [];

  for (const source of account.sources) {
    console.log(`Fetching ${source.name} (${source.url})`);
    try {
      const items = await fetchFeed(source);
      console.log(`  ${items.length} items in feed`);

      const fresh = items.filter((item) => {
        if (alreadyProcessed.has(item.link)) return false;
        const published = item.pubDate ? new Date(item.pubDate).getTime() : now;
        return now - published <= maxAgeMs;
      });

      console.log(`  ${fresh.length} new + within ${account.content.maxArticleAgeDays} day(s)`);
      allCandidates.push(...fresh);
    } catch (err) {
      console.error(`  Failed to fetch ${source.name}: ${err.message}`);
    }
  }

  if (allCandidates.length === 0) {
    console.log('No new candidate articles today — nothing queued.');
    return 0;
  }

  const postsPerDay = account.posting?.postsPerDay ?? 1;
  const chosen = pickTopArticles(allCandidates, postsPerDay);

  let queued = 0;
  for (const article of chosen) {
    const id = slugify(`${article.sourceName}-${article.title}`);

    writePendingPost(account.accountId, {
      id,
      accountId: account.accountId,
      status: 'researched',
      source: { name: article.sourceName, category: article.sourceCategory },
      article: {
        title: article.title,
        link: article.link,
        description: article.description,
        content: article.content,
        pubDate: article.pubDate,
        image: article.image,
      },
      score: article._score,
      selectedAt: new Date().toISOString(),
      generated: null,
      render: null,
    });

    history.processedUrls.push(article.link);
    queued++;
    console.log(`Queued: "${article.title}" (score ${article._score.toFixed(2)})`);
  }

  // Cap history growth — keep the most recent 500 processed URLs.
  if (history.processedUrls.length > 500) {
    history.processedUrls = history.processedUrls.slice(-500);
  }
  saveHistory(account, history);

  return queued;
}

async function main() {
  const accounts = loadActiveAccounts();
  console.log(`Running research for ${accounts.length} active account(s).`);

  let totalQueued = 0;
  for (const account of accounts) {
    totalQueued += await researchAccount(account);
  }

  console.log(`\nDone. ${totalQueued} post(s) queued across all accounts.`);
}

main().catch(async (err) => {
  console.error('[research] Fatal error:', err);
  await alertFailure('research', err);
  process.exit(1);
});
