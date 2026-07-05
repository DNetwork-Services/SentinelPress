import { loadActiveAccounts } from './lib/config.mjs';
import { listQueue, movePost } from './lib/queue.mjs';
import { publishCarousel } from './lib/instagram.mjs';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set.`);
  return value;
}

function buildCaption(post) {
  const hashtagLine = (post.generated.hashtags || []).map((h) => `#${h}`).join(' ');
  const photoCredits = post.render?.photoCredits || [];
  const parts = [post.generated.caption, '', hashtagLine];
  if (photoCredits.length > 0) {
    const creditLine = photoCredits.map((c) => c.photographer).join(', ');
    parts.push('', `📷 Photos by ${creditLine} on Pexels`);
  }
  // Instagram caption limit is 2200 characters.
  return parts.join('\n').slice(0, 2200);
}

async function publishForAccount(account, imageBaseUrl) {
  console.log(`\n=== ${account.displayName} ===`);

  const approved = listQueue(account.accountId, 'approved').filter((p) => p.status === 'approved');
  if (approved.length === 0) {
    console.log('No approved posts awaiting publish.');
    return 0;
  }

  const accessToken = requireEnv(account.instagram.accessTokenEnvVar);
  const igBusinessAccountId = requireEnv(account.instagram.businessAccountIdEnvVar);

  let published = 0;
  for (const post of approved) {
    try {
      const imageUrls = post.render.slideImages.map(
        (fileName) => `${imageBaseUrl}/${account.accountId}/queue/approved/${fileName}`
      );
      const caption = buildCaption(post);

      console.log(`  Publishing "${post.article.title}" (${imageUrls.length} slides)...`);
      const igMediaId = await publishCarousel({ igBusinessAccountId, accessToken, imageUrls, caption });

      movePost(
        account.accountId,
        { ...post, status: 'published', igMediaId, publishedAt: new Date().toISOString() },
        'approved',
        'published'
      );
      console.log(`  Published! Instagram media ID: ${igMediaId}`);
      published++;
    } catch (err) {
      // Leave at status "approved" so the next run retries — publishing
      // never got confirmed, so it's not safe to assume it went through.
      console.error(`  FAILED: ${err.message}`);
    }
  }
  return published;
}

async function main() {
  const imageBaseUrl = process.env.IMAGE_BASE_URL;
  if (!imageBaseUrl) {
    console.log('IMAGE_BASE_URL not set — nothing to publish yet (this is expected before Milestone 7 wiring is complete).');
    return;
  }

  const accounts = loadActiveAccounts();
  let total = 0;
  for (const account of accounts) {
    total += await publishForAccount(account, imageBaseUrl);
  }
  console.log(`\nDone. ${total} post(s) published.`);
}

main().catch((err) => {
  console.error('[publish-instagram] Fatal error:', err);
  process.exit(1);
});
