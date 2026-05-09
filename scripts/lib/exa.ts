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

export async function searchExa(input: {
  apiKey: string;
  query: string;
  numResults: number;
  includeText?: boolean;
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
      text: input.includeText
        ? {
            maxCharacters: 3000,
            includeHtmlTags: false,
          }
        : false,
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
