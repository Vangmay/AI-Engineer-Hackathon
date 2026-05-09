import crypto from 'node:crypto';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

export function createCaseId(title: string, date?: string): string {
  const suffix = date?.slice(0, 4) ?? 'unknown';
  return `case_${slugify(title)}_${suffix}`;
}

export function createId(prefix: string, seed: string): string {
  const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 10);
  return `${prefix}_${hash}`;
}

export function hashText(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex');
}

export function fileExtensionFromUrl(url: string, fallback = 'bin'): string {
  try {
    const pathname = new URL(url).pathname;
    const candidate = pathname.split('/').pop() ?? '';
    const ext = candidate.includes('.') ? candidate.split('.').pop() : '';
    return ext && /^[a-z0-9]+$/iu.test(ext) ? ext.toLowerCase() : fallback;
  } catch {
    return fallback;
  }
}
