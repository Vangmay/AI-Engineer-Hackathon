/**
 * Exa search inside Convex actions (mirror of scripts/lib/exa.ts).
 */

export interface ExaSearchResult {
  id?: string;
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text?: string;
  highlights?: string[];
  score?: number;
}

interface ExaResponse {
  requestId?: string;
  results?: ExaSearchResult[];
}

/** Prefer Wikipedia encyclopedia pages; fall back to any Exa hits with text. */
export const CORPUS_SEARCH_QUERIES = [
  'site:en.wikipedia.org unsolved murder investigation timeline suspects',
  'site:en.wikipedia.org homicide case trial disputed evidence witnesses',
  'site:en.wikipedia.org cold case homicide reinvestigation',
  'site:en.wikipedia.org criminal case conviction controversy',
  'site:en.wikipedia.org disappearance homicide investigation',
];

const MAX_CHARS_PER_RESULT = 4000;

export async function searchExa(input: {
  apiKey: string;
  query: string;
  numResults: number;
}): Promise<{ requestId?: string; results: ExaSearchResult[] }> {
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': input.apiKey,
    },
    body: JSON.stringify({
      query: input.query,
      numResults: input.numResults,
      type: 'auto',
      text: {
        maxCharacters: MAX_CHARS_PER_RESULT,
        includeHtmlTags: false,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Exa search failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as ExaResponse;
  return {
    requestId: payload.requestId,
    results: payload.results ?? [],
  };
}

export function pickQuery(): string {
  return CORPUS_SEARCH_QUERIES[Math.floor(Math.random() * CORPUS_SEARCH_QUERIES.length)];
}

function isLikelyWiki(u: string) {
  return /wikipedia\.org\/wiki\//iu.test(u);
}

/** Rank snippets for LLM ingestion: Wikipedia first, then longest text bodies. */
export function rankResearchResults(results: ExaSearchResult[]): ExaSearchResult[] {
  const withText = results.filter((r) => r.text && r.text.length > 120);
  const wiki = withText.filter((r) => isLikelyWiki(r.url));
  const pool = wiki.length >= 1 ? wiki : withText;
  return [...pool].sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0));
}

/** Build a bounded markdown-ish block for the LLM prompt. */
export function buildResearchCorpus(
  ranked: ExaSearchResult[],
  opts: { maxArticles: number; maxTotalChars: number },
): { corpus: string; sourceUrls: string[]; titles: string[] } {
  const urls: string[] = [];
  const titles: string[] = [];
  const parts: string[] = [];
  let total = 0;

  for (const hit of ranked.slice(0, opts.maxArticles)) {
    const excerpt = hit.text!.slice(0, MAX_CHARS_PER_RESULT);
    const chunk = [`### ${hit.title}`, `URL: ${hit.url}`, '', excerpt.trim(), ''].join('\n');
    if (total + chunk.length > opts.maxTotalChars) break;
    parts.push(chunk);
    urls.push(hit.url);
    titles.push(hit.title);
    total += chunk.length;
  }

  return {
    corpus: parts.join('\n---\n\n'),
    sourceUrls: urls,
    titles,
  };
}
