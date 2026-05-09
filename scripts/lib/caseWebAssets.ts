import path from 'node:path';
import { getCaseDir } from './caseFiles.ts';

/**
 * Map an on-disk path under a case bundle to a URL served by the Vite dev/preview middleware.
 */
export function filesystemUriToCaseWebPath(caseId: string, uri: string | undefined): string | undefined {
  if (!uri) return uri;
  const trimmed = uri.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('/case-assets/')
  ) {
    return trimmed;
  }

  const caseRoot = path.resolve(getCaseDir(caseId));
  let abs: string;
  try {
    abs = path.resolve(trimmed);
  } catch {
    return trimmed;
  }

  const caseRootWithSep = caseRoot.endsWith(path.sep) ? caseRoot : `${caseRoot}${path.sep}`;
  if (abs !== caseRoot && !abs.startsWith(caseRootWithSep)) {
    return trimmed;
  }

  const rel = path.relative(caseRoot, abs).split(path.sep).join('/');
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return trimmed;
  }
  return `/case-assets/${caseId}/${rel}`;
}
