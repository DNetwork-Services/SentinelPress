import { loadActiveAccounts } from './lib/config.mjs';
import { listQueue, movePost } from './lib/queue.mjs';
import { publishCarousel, publishImage, publishReel } from './lib/instagram.mjs';
import { alertFailure } from './lib/alert.mjs';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set.`);
  return value;
}

function buildCaption(post) {
  const hashtagLine = (post.generated.hashtags || []).map((h) => `#${h}`).join(' ');
  const parts = [post.generated.caption, '', hashtagLine];
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
      const caption = buildCaption(post);
      const format = post.approvedFormat;

      if (!format) {
        throw new Error('Post has no approvedFormat set — expected "carousel" or "reel". Was it approved before this feature existed?');
      }

      let igMediaId = null;
      let igReelMediaId = null;

      if (format === 'carousel') {
        const imageUrls = post.render.slideImages.map(
          (fileName) => `${imageBaseUrl}/${account.accountId}/queue/approved/${fileName}`
        );
        if (imageUrls.length === 1) {
          console.log(`  Publishing "${post.article.title}" as a single IMAGE...`);
          igMediaId = await publishImage({ igBusinessAccountId, accessToken, imageUrl: imageUrls[0], caption });
          console.log(`  Image published! Instagram media ID: ${igMediaId}`);
        } else {
          console.log(`  Publishing "${post.article.title}" as a CAROUSEL (${imageUrls.length} slides)...`);
          igMediaId = await publishCarousel({ igBusinessAccountId, accessToken, imageUrls, caption });
          console.log(`  Carousel published! Instagram media ID: ${igMediaId}`);
        }
      } else {
        if (!post.render.reelVideo) {
          throw new Error('Post was approved as "reel" but has no rendered reel video.');
        }
        const videoUrl = `${imageBaseUrl}/${account.accountId}/queue/approved/${post.render.reelVideo}`;
        console.log(`  Publishing "${post.article.title}" as a REEL...`);
        igReelMediaId = await publishReel({ igBusinessAccountId, accessToken, videoUrl, caption });
        console.log(`  Reel published! Instagram media ID: ${igReelMediaId}`);
      }

      movePost(
        account.accountId,
        { ...post, status: 'published', igMediaId, igReelMediaId, publishedAt: new Date().toISOString() },
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
