import fs from 'fs';
import path from 'path';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Picks the next `count` unused topics from an account's topic bank
 * (a curated curriculum JSON, not a news feed). Reuses the exact same
 * history.processedUrls dedupe mechanism as RSS accounts by giving each
 * topic a synthetic "topic://accountId/topicId" URL — so nothing else in
 * research.mjs, generate.mjs, etc. needs to know this account isn't
 * news-based at all.
 *
 * If a topic has a "weekday" field, today's matching topics are
 * preferred first (e.g. Monday -> Vocabulary, Tuesday -> Translation —
 * see accounts/englishvault/topics.json's weekly content plan). Topics
 * without a weekday (or once today's theme is exhausted) fill any
 * remaining slots from the general unused pool.
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

  const today = WEEKDAY_NAMES[new Date().getDay()];
  const todaysTheme = unused.filter((t) => t.weekday === today);
  const rest = unused.filter((t) => t.weekday !== today);

  if (todaysTheme.length > 0) {
    console.log(`  Today is ${today} — preferring "${todaysTheme[0].category}" topics per the weekly content plan.`);
  }

  // Shuffle each pool separately so same-day picks vary run to run, but
  // today's theme always comes first when available.
  const shuffledTheme = [...todaysTheme].sort(() => Math.random() - 0.5);
  const shuffledRest = [...rest].sort(() => Math.random() - 0.5);
  const picked = [...shuffledTheme, ...shuffledRest].slice(0, count);

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
