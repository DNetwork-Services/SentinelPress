// Deliberately simple and transparent (not an LLM call) — this just ranks
// candidates so the pipeline can pick one deterministically. Easy to swap
// for an LLM-based ranking agent later without touching anything else.

const HIGH_IMPACT_KEYWORDS = [
  'zero-day', 'zero day', 'ransomware', 'critical', 'breach', 'exploited in the wild',
  'actively exploited', 'rce', 'remote code execution', 'supply chain', 'cve-',
];

export function scoreArticle(article) {
  const now = Date.now();
  const published = article.pubDate ? new Date(article.pubDate).getTime() : now;
  const ageHours = Math.max(0, (now - published) / (1000 * 60 * 60));

  // Recency: newer is better, decays over 72 hours to 0.
  const recencyScore = Math.max(0, 1 - ageHours / 72);

  // Impact: keyword match on title + description.
  const text = `${article.title} ${article.description}`.toLowerCase();
  const impactScore = HIGH_IMPACT_KEYWORDS.some((kw) => text.includes(kw)) ? 1 : 0;

  // Weighted combination — impact matters more than being a few hours newer.
  return recencyScore * 0.4 + impactScore * 0.6;
}

export function pickTopArticles(articles, count) {
  return [...articles]
    .map((a) => ({ ...a, _score: scoreArticle(a) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, count);
}
