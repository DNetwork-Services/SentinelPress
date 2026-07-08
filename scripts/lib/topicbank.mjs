import fs from 'fs';
import path from 'path';

/**
 * Picks the next `count` unused topics from an account's topic bank
 * (a curated curriculum JSON, not a news feed). Reuses the exact same
 * history.processedUrls dedupe mechanism as RSS accounts by giving each
 * topic a synthetic "topic://accountId/topicId" URL — so nothing else in
 * research.mjs, generate.mjs, etc. needs to know this account isn't
 * news-based at all.
 *
 * If every topic in the bank has been used, cycles back to the start
 * rather than producing nothing — a curriculum is meant to repeat
 * eventually (spaced repetition is good for learners anyway).
 */
export function pickNextTopics(account, alreadyProcessed, count) {
  const bankPath = path.join(account._dir, account.topicBank);
  const topics = JSON.parse(fs.readFileSync(bankPath, 'utf-8'));

  const withUrls = topics.map((t) => ({
    ...t,
    _pseudoUrl: `topic://${account.accountId}/${t.id}`,
  }));

  let unused = withUrls.filter((t) => !alreadyProcessed.has(t._pseudoUrl));
  if (unused.length === 0) {
    console.log('  Topic bank fully cycled — starting over from the beginning.');
    unused = withUrls;
  }

  // Shuffle so topics don't always surface in the same JSON-file order.
  const shuffled = [...unused].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);

  return picked.map((t) => ({
    title: t.topic,
    link: t._pseudoUrl,
    description: t.detail,
    content: t.detail,
    pubDate: new Date().toISOString(),
    image: '',
    sourceName: `${account.displayName} Curriculum`,
    sourceCategory: t.category,
    _score: 1,
  }));
}
