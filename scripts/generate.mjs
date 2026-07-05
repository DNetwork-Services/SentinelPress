import fs from 'fs';
import path from 'path';
import { loadActiveAccounts } from './lib/config.mjs';
import { listQueue, writePendingPost } from './lib/queue.mjs';
import { callLLM, callLLMForJSON } from './lib/llm.mjs';

function loadPrompt(account, promptRelPath) {
  const fullPath = path.join(account._dir, promptRelPath);
  return fs.readFileSync(fullPath, 'utf-8');
}

function buildArticleText(article) {
  const body = article.content?.trim() || article.description?.trim() || '';
  return `Title: ${article.title}\nSource link: ${article.link}\n\n${body}`.trim();
}

function fillPrompt(template, articleText) {
  return template.replace(/\{\{ARTICLE_TEXT\}\}/g, articleText);
}

async function generateForPost(account, post) {
  const articleText = buildArticleText(post.article);
  const prompts = account.content.prompts;

  console.log(`  Generating content for: "${post.article.title}"`);

  const captionPrompt = fillPrompt(loadPrompt(account, prompts.caption), articleText);
  const caption = await callLLM(captionPrompt);

  const scriptPrompt = fillPrompt(loadPrompt(account, prompts.script), articleText);
  const script = await callLLM(scriptPrompt);

  const hashtagsPrompt = fillPrompt(loadPrompt(account, prompts.hashtags), articleText);
  let hashtags;
  try {
    hashtags = await callLLMForJSON(hashtagsPrompt);
    if (!Array.isArray(hashtags)) throw new Error('Expected a JSON array of hashtags.');
  } catch (err) {
    console.warn(`    Hashtag generation failed (${err.message}) — leaving empty, can be added manually.`);
    hashtags = [];
  }

  const carouselPrompt = fillPrompt(loadPrompt(account, prompts.carousel), articleText);
  let slides;
  try {
    const carouselJson = await callLLMForJSON(carouselPrompt);
    if (!Array.isArray(carouselJson.slides)) throw new Error('Expected { slides: [...] }.');
    slides = carouselJson.slides;
  } catch (err) {
    throw new Error(`Carousel generation failed for "${post.article.title}": ${err.message}`);
  }

  return {
    ...post,
    status: 'generated',
    generated: {
      caption,
      script,
      hashtags,
      slides,
      generatedAt: new Date().toISOString(),
    },
  };
}

async function generateForAccount(account) {
  console.log(`\n=== ${account.displayName} ===`);

  const pending = listQueue(account.accountId, 'pending').filter((p) => p.status === 'researched');
  if (pending.length === 0) {
    console.log('No posts awaiting generation.');
    return 0;
  }

  let done = 0;
  for (const post of pending) {
    try {
      const updated = await generateForPost(account, post);
      writePendingPost(account.accountId, updated);
      console.log(`  Done: "${post.article.title}"`);
      done++;
    } catch (err) {
      // Leave the post at status "researched" so a future run retries it,
      // rather than losing it or writing partial/broken content.
      console.error(`  FAILED: ${err.message}`);
    }
  }
  return done;
}

async function main() {
  const accounts = loadActiveAccounts();
  let total = 0;
  for (const account of accounts) {
    total += await generateForAccount(account);
  }
  console.log(`\nDone. ${total} post(s) generated.`);
}

main().catch((err) => {
  console.error('[generate] Fatal error:', err);
  process.exit(1);
});
