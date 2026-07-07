import { loadActiveAccounts } from './lib/config.mjs';
import { listQueue, movePost } from './lib/queue.mjs';
import { publishCarousel, publishReel } from './lib/instagram.mjs';
import { alertFailure } from './lib/alert.mjs';

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
      console.log(`  Carousel published! Instagram media ID: ${igMediaId}`);

      // Reel publish is isolated in its own try/catch: the carousel has
      // already succeeded at this point, so a reel failure must NOT throw
      // here — that would leave the post at status "approved" and cause
      // the carousel to be published a second time on retry.
      let igReelMediaId = null;
      let reelPublishError = null;
      if (post.render.reelVideo) {
        try {
          const videoUrl = `${imageBaseUrl}/${account.accountId}/queue/approved/${post.render.reelVideo}`;
          console.log(`  Publishing reel version...`);
          igReelMediaId = await publishReel({ igBusinessAccountId, accessToken, videoUrl, caption });
          console.log(`  Reel published! Instagram media ID: ${igReelMediaId}`);
        } catch (err) {
          console.error(`  Reel publish FAILED (carousel already published, not retrying it): ${err.message}`);
          reelPublishError = err.message;
        }
      }

      movePost(
        account.accountId,
        { ...post, status: 'published', igMediaId, igReelMediaId, reelPublishError, publishedAt: new Date().toISOString() },
        'approved',
        'published'
      );
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

main().catch(async (err) => {
  console.error('[publish-instagram] Fatal error:', err);
  await alertFailure('publish-instagram', err);
  process.exit(1);
});
