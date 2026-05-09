/**
 * Normalize audio/image paths from pipeline output so the browser can load them.
 * Supports `/case-assets/...` (preferred), URLs, data URIs, and legacy absolute paths
 * that contain `data/cases/<caseId>/...`.
 */
export function normalizeCaseAssetUrl(uri: string | null | undefined): string | undefined {
  if (uri == null || uri === '') return undefined;
  if (uri.startsWith('/case-assets/') || uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:')) {
    return uri;
  }

  const unixIdx = uri.indexOf('/data/cases/');
  if (unixIdx >= 0) {
    return `/case-assets/${uri.slice(unixIdx + '/data/cases/'.length)}`;
  }

  const winMatch = uri.match(/[/\\]data[/\\]cases[/\\](.+)$/i);
  if (winMatch) {
    return `/case-assets/${winMatch[1].replace(/\\/g, '/')}`;
  }

  return uri;
}
