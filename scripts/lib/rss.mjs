import https from 'https';
import http from 'http';

export function fetchUrl(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'SentinelPress-Research/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        return fetchUrl(res.headers.location, redirectsLeft - 1).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function extractTag(xml, tag) {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  if (match) return match[1].trim();

  const simpleRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)(?:</${tag}>|$)`);
  const simpleMatch = xml.match(simpleRegex);
  return simpleMatch ? simpleMatch[1].trim() : '';
}

export function cleanHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');
    const contentEncoded = extractTag(itemXml, 'content:encoded');

    let image = '';
    const mediaMatch = itemXml.match(/<media:content[^>]+url="([^"]+)"/);
    const enclosureMatch = itemXml.match(/<enclosure[^>]+url="([^"]+)"/);
    if (mediaMatch) image = mediaMatch[1];
    else if (enclosureMatch) image = enclosureMatch[1];

    const categories = [];
    const catRegex = /<category[^>]*><!\[CDATA\[(.*?)\]\]><\/category>/g;
    let catMatch;
    while ((catMatch = catRegex.exec(itemXml)) !== null) {
      categories.push(catMatch[1]);
    }

    if (title && link) {
      items.push({
        title: cleanHtml(title),
        link,
        description: cleanHtml(description || ''),
        content: contentEncoded ? cleanHtml(contentEncoded) : '',
        pubDate,
        image,
        categories,
      });
    }
  }

  return items;
}

export async function fetchFeed(source) {
  const xml = await fetchUrl(source.url);
  const items = parseRSS(xml);
  return items.map((item) => ({ ...item, sourceName: source.name, sourceCategory: source.category }));
}
