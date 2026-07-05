// Pexels API: free tier, 200 req/hour / 20,000 req/month — far more than
// 1 post/day needs. Auth header takes the raw key, NOT "Bearer <key>".
// https://www.pexels.com/api/documentation/

function buildQuery(slide, sourceCategory) {
  if (slide?.imageQuery) return slide.imageQuery;

  // Fallback for slides without an imageQuery (e.g. hand-written test data,
  // or older posts generated before this field existed).
  const genericTerms = {
    Vulnerability: 'cybersecurity hacker code',
    Hacking: 'hacker dark computer',
    News: 'cybersecurity technology',
  };
  return genericTerms[sourceCategory] || 'cybersecurity technology';
}

/**
 * Searches Pexels and returns a base64 data URI for the best-fit photo,
 * or null if the search fails / returns nothing (caller should fall back
 * to a plain background rather than fail the whole render).
 */
export async function fetchTopicPhoto(slide, sourceCategory, apiKey) {
  if (!apiKey) return null;

  const query = buildQuery(slide, sourceCategory);
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) throw new Error(`Pexels API error ${res.status}`);

    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) return null;

    const imageUrl = photo.src.large2x || photo.src.large;
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Photo download failed ${imgRes.status}`);

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    return {
      dataUri: `data:image/jpeg;base64,${buffer.toString('base64')}`,
      photographer: photo.photographer,
      pexelsUrl: photo.url,
    };
  } catch (err) {
    console.warn(`[stockphoto] Could not fetch a photo (${err.message}) — using plain background instead.`);
    return null;
  }
}
