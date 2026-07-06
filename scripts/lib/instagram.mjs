// Host/version are configurable because Meta's docs are genuinely
// inconsistent right now about which host (graph.facebook.com vs the
// newer graph.instagram.com) applies to Facebook-Login-linked Business
// accounts like this one. Defaults below match the Facebook Login flow
// this project's Instagram account was set up with; if publishing fails
// with a version/host-shaped error, try switching GRAPH_API_HOST to
// "graph.instagram.com" and GRAPH_API_VERSION to a newer version — see
// SETUP.md.
const GRAPH_HOST = process.env.GRAPH_API_HOST || 'graph.facebook.com';
const GRAPH_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';

function graphUrl(path) {
  return `https://${GRAPH_HOST}/${GRAPH_VERSION}/${path}`;
}

async function graphPost(path, params, accessToken) {
  const url = new URL(graphUrl(path));
  const body = new URLSearchParams({ ...params, access_token: accessToken });

  const res = await fetch(url, { method: 'POST', body });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Graph API error on ${path}: ${JSON.stringify(data.error || data)}`);
  }
  return data;
}

async function graphGet(path, params, accessToken) {
  const url = new URL(graphUrl(path));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Graph API error on ${path}: ${JSON.stringify(data.error || data)}`);
  }
  return data;
}

/**
 * Waits for a media container to finish processing (Instagram fetches
 * the image_url server-side, which is async). Polls with backoff.
 * Throws if it errors out or doesn't finish within the timeout.
 */
async function waitForContainerReady(containerId, accessToken, { timeoutMs = 60000, intervalMs = 2000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { status_code } = await graphGet(containerId, { fields: 'status_code' }, accessToken);
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR') throw new Error(`Container ${containerId} failed processing (status: ERROR).`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Container ${containerId} did not finish within ${timeoutMs}ms.`);
}

/**
 * Publishes a single video as an Instagram Reel. Video processing takes
 * longer than images, hence the longer timeout on the status poll.
 * Returns the published media's Instagram ID.
 */
export async function publishReel({ igBusinessAccountId, accessToken, videoUrl, caption }) {
  const { id: containerId } = await graphPost(
    `${igBusinessAccountId}/media`,
    { media_type: 'REELS', video_url: videoUrl, caption },
    accessToken
  );

  await waitForContainerReady(containerId, accessToken, { timeoutMs: 180000, intervalMs: 5000 });

  const { id: publishedId } = await graphPost(
    `${igBusinessAccountId}/media_publish`,
    { creation_id: containerId },
    accessToken
  );

  return publishedId;
}
export async function publishCarousel({ igBusinessAccountId, accessToken, imageUrls, caption }) {
  if (imageUrls.length < 2) {
    throw new Error(`Carousel requires at least 2 images, got ${imageUrls.length}.`);
  }
  if (imageUrls.length > 10) {
    throw new Error(`Carousel supports at most 10 images, got ${imageUrls.length}.`);
  }

  const childIds = [];
  for (const imageUrl of imageUrls) {
    const { id } = await graphPost(
      `${igBusinessAccountId}/media`,
      { image_url: imageUrl, is_carousel_item: 'true' },
      accessToken
    );
    await waitForContainerReady(id, accessToken);
    childIds.push(id);
  }

  const { id: creationId } = await graphPost(
    `${igBusinessAccountId}/media`,
    { media_type: 'CAROUSEL', children: childIds.join(','), caption },
    accessToken
  );
  await waitForContainerReady(creationId, accessToken);

  const { id: publishedId } = await graphPost(
    `${igBusinessAccountId}/media_publish`,
    { creation_id: creationId },
    accessToken
  );

  return publishedId;
}
