const DEFAULT_ROOT_URLS = [
  'https://apilageai.lk/help',
  'https://apilageai.lk',
  'https://apilageai.dev/help',
  'https://apilageai.dev',
];

function normalizeUrl(rawUrl, currentUrl = null) {
  try {
    return new URL(rawUrl, currentUrl || 'https://apilageai.lk').toString();
  } catch {
    return null;
  }
}

export function isOfficialApilageAIUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === 'apilageai.lk' || hostname === 'www.apilageai.lk' ||
      hostname === 'apilageai.dev' || hostname === 'www.apilageai.dev';
  } catch {
    return false;
  }
}

function stripHtml(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function crawlOfficialWebsitePages({ fetchFn = fetch, rootUrls = DEFAULT_ROOT_URLS } = {}) {
  const queue = [...rootUrls];
  const seen = new Set();
  const pages = [];

  while (queue.length && pages.length < 12) {
    const nextUrl = queue.shift();
    if (!nextUrl || seen.has(nextUrl)) continue;
    seen.add(nextUrl);
    const normalized = normalizeUrl(nextUrl);
    if (!normalized || !isOfficialApilageAIUrl(normalized)) continue;

    try {
      const response = await fetchFn(normalized, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!response || !response.ok) continue;
      const html = await response.text();
      if (!html) continue;
      const plainText = stripHtml(html);
      if (!plainText) continue;
      pages.push({ url: normalized, text: plainText });

      const links = [...html.matchAll(/href\s*=\s*['"]([^'"]+)['"]/gi)].map((match) => match[1]);
      for (const link of links) {
        const absolute = normalizeUrl(link, normalized);
        if (absolute && isOfficialApilageAIUrl(absolute) && !seen.has(absolute)) {
          queue.push(absolute);
        }
      }
    } catch {
      continue;
    }
  }

  return pages;
}

export async function collectRelevantWebsiteContext(question, { fetch: fetchFn = fetch } = {}) {
  if (!question || !String(question).trim()) return '';

  const normalizedQuestion = String(question).toLowerCase();
  const terms = [...new Set(normalizedQuestion.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean))]
    .slice(0, 12);

  const pages = await crawlOfficialWebsitePages({ fetchFn });
  if (!pages.length) return '';

  const scored = pages.map((page) => {
    const text = page.text.toLowerCase();
    const score = terms.reduce((total, term) => total + (text.includes(term) ? 3 : 0), 0);
    return { ...page, score };
  }).filter((page) => page.score > 0).sort((a, b) => b.score - a.score);

  const selected = (scored.length ? scored : pages)
    .slice(0, 3)
    .map((page) => page.text)
    .join('\n\n---\n\n');

  return selected.trim();
}
