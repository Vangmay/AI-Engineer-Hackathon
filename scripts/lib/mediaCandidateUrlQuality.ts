/**
 * Heuristics for how likely a URL is to yield playable media via yt-dlp or direct fetch,
 * before accounting for DRM, geo-blocking, or age-gate retries.
 */

import type { ExtractionFitnessTier } from '../../src/types/media.ts';
import type { SourceRecord } from '../../src/types/research.ts';

export interface UrlExtractionFitness {
  score: number;
  tier: ExtractionFitnessTier;
  notes: string[];
}

const DIRECT_MEDIA_RE = /\.(mp3|m4a|aac|wav|opus|ogg|webm|mp4|m4v|mkv|mov)(\?|#|$)/iu;

/** Strong YouTube episode / clip identity (single watchable item). */
function youtubeVideoSignals(url: URL): { bonus: number; notes: string[] } {
  const hostNorm = url.hostname.replace(/^www\./u, '');
  const host = hostNorm.toLowerCase();
  const path = url.pathname.toLowerCase();
  const notes: string[] = [];

  const youtubeHost =
    host.endsWith('youtube.com') || host === 'youtu.be' || host === 'music.youtube.com' || host === 'm.youtube.com';

  if (!youtubeHost) {
    return { bonus: 0, notes };
  }

  const v = url.searchParams.get('v');
  const idFromV = v && /^[a-z0-9_-]{11}$/iu.test(v) ? v : undefined;

  const pathSegs = path.split('/').filter(Boolean);
  const youtuBeId = host === 'youtu.be' ? pathSegs[0] : undefined;
  const shortsId = [...path.matchAll(/\/shorts\/([a-z0-9_-]{8,})(?:\/|\?|$)/iu)][0]?.[1];
  const embedId = [...path.matchAll(/\/embed\/([a-z0-9_-]{8,})(?:\/|$|\?)/iu)][0]?.[1];

  const clipQuery = url.searchParams.get('clip');

  const hasConcreteId =
    Boolean(idFromV) ||
    (youtuBeId && /^[a-z0-9_-]{8,}$/iu.test(youtuBeId)) ||
    Boolean(shortsId || embedId);

  if (hasConcreteId) {
    notes.push('YouTube URL targets a concrete watchable item (watch v=, youtu.be, shorts, or embed id).');
    return { bonus: 42, notes };
  }

  if (path.includes('/clip/') && clipQuery) {
    notes.push('YouTube clip URL — often extractable but less stable than a full watch URL.');
    return { bonus: 24, notes };
  }

  if (
    path.includes('/playlist') ||
    path.includes('/@') ||
    path.includes('/channel/') ||
    path.includes('/c/') ||
    path.includes('/user/') ||
    path.includes('/results') ||
    path.includes('/feed/') ||
    (path.includes('/live') && !url.searchParams.get('v'))
  ) {
    notes.push('YouTube browse surface (channel, playlist, search, directory, or ambiguous live hub).');
    return { bonus: -46, notes };
  }

  if (host.endsWith('youtube.com') && path === '/' && !url.searchParams.get('v')) {
    notes.push('Bare YouTube landing without watch id.');
    return { bonus: -48, notes };
  }

  notes.push('YouTube URL lacks a recognizable single-video id.');
  return { bonus: -14, notes };
}

function directFileBonus(urlStr: string, notes: string[]): number {
  if (DIRECT_MEDIA_RE.test(urlStr)) {
    notes.push('Direct media-like extension in URL path.');
    return 46;
  }
  return 0;
}

/** Article / transcript wrappers that usually return HTML, not playable media. */
function articleOrTranscriptPenalty(urlStr: string, title: string, text: string, notes: string[]): number {
  let penalty = 0;
  const blob = `${urlStr}\n${title}\n${text}`.toLowerCase();

  const transcriptHints = [
    'transcript',
    'full transcript',
    'captions',
    'subtitle',
    'subtitles only',
    'read the transcript',
    'text transcript',
    'timed transcript',
  ];
  for (const h of transcriptHints) {
    if (blob.includes(h)) {
      penalty += 36;
      notes.push(`Transcript/read-only mirror hint: “${h}”.`);
      break;
    }
  }

  try {
    const u = new URL(urlStr);
    const path = `${u.pathname}${u.search}`.toLowerCase();
    const host = u.hostname.replace(/^www\./u, '').toLowerCase();

    if (path.match(/\.(html?|htm|php|asp|aspx)(\?|$|#)/u) || path.includes('/article/') || path.includes('/story/')) {
      penalty += 22;
      notes.push('Article-style URL path (*.html /article/, /story/).');
    }

    const articleHosts = ['medium.com', 'substack.com', 'washingtonpost.com', 'nytimes.com', 'theguardian.com'];
    if (articleHosts.some((h) => host.endsWith(h) || host.includes(`.${h}`))) {
      penalty += 16;
      notes.push(`Publication host likely serves article HTML: ${host}.`);
    }

    if (host === 'reddit.com' || host.endsWith('.reddit.com') || host === 'news.ycombinator.com') {
      if (!blob.includes('youtube') && !blob.includes('youtu.be') && !blob.includes('/video') && !path.includes('.mp4')) {
        penalty += 20;
        notes.push('Forum / comment thread wrapper without embedded media signals.');
      }
    }

    if (host.includes('netflix.') || host.includes('hulu.') || host.includes('hbomax') || host.includes('disney.')) {
      penalty += 40;
      notes.push('Paid streaming catalogue — rarely extractable without auth.');
    }
  } catch {
    penalty += 18;
    notes.push('Malformed URL.');
  }

  return penalty;
}

/** Known yt-dlp-friendly hubs (excluding YouTube, handled separately). */
function hostedHubBonus(hostname: string, notes: string[]): number {
  const h = hostname.replace(/^www\./u, '').toLowerCase();
  const rows: Array<[RegExp, number, string]> = [
    [/vimeo\.com$/iu, 28, 'Vimeo'],
    [/dailymotion\.com$/iu, 26, 'Dailymotion'],
    [/bbc\.co\.uk$/iu, 10, 'BBC iPlayer/programme (often geo/block)'],
    [/soundcloud\.com$/iu, 22, 'SoundCloud'],
    [/twitch\.tv$/iu, 14, 'Twitch'],
    [/podcasts\.apple\.com$/iu, 20, 'Apple Podcasts'],
    [/open\.spotify\.com$/iu, 14, 'Spotify episode'],
    [/cbc\.ca$/iu, 10, 'CBC streams / pages'],
  ];
  for (const [re, pts, msg] of rows) {
    if (re.test(h)) {
      notes.push(msg);
      return pts;
    }
  }
  return 0;
}

function credibilityBonus(source?: Pick<SourceRecord, 'credibilityTier' | 'url'>): number {
  if (!source?.url) return 0;
  if (source.credibilityTier === 'primary') return 14;
  if (source.credibilityTier === 'strong_secondary') return 9;
  if (source.credibilityTier === 'weak_secondary') return 4;
  return 0;
}

/**
 * Highest URL match against bundled sources for alignment boost.
 */
function bestMatchingSourceForUrl(url: string, sources: SourceRecord[] | undefined): SourceRecord | undefined {
  const norm = normalizeUrlCompare(url);
  return sources?.find((s) => normalizeUrlCompare(s.url) === norm);
}

function normalizeUrlCompare(url: string): string {
  try {
    const u = new URL(url);
    u.protocol = 'https:';
    u.hostname = u.hostname.replace(/^www\./u, '').toLowerCase();
    u.hash = '';
    u.searchParams.sort();
    u.pathname =
      u.pathname.length > 1 && u.pathname.endsWith('/')
        ? u.pathname.slice(0, -1)
        : u.pathname;
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Roughly 0–100 — higher values mean better ordering for harvest / clone media selection / downloader retries.
 */
export function scoreMediaUrlExtractionFitness(input: {
  url: string;
  title?: string;
  textSnippet?: string;
  exaScore?: number;
  bundledSources?: SourceRecord[];
}): UrlExtractionFitness {
  const title = input.title ?? '';
  const text = input.textSnippet ?? '';
  const notes: string[] = [];

  let score = 38;

  const direct = directFileBonus(input.url, notes);
  score += direct;
  if (direct >= 44) {
    const cred = credibilityBonus(bestMatchingSourceForUrl(input.url, input.bundledSources));
    if (cred > 0) {
      score += cred;
      notes.push(`Bundled source alignment (+${cred} credibility tier).`);
    }
    return finalizeFitness(score, notes, input.exaScore);
  }

  try {
    const u = new URL(input.url);
    const yt = youtubeVideoSignals(u);
    score += yt.bonus;
    notes.push(...yt.notes);

    const isYoutubeHost =
      u.hostname.includes('youtube.com') || u.hostname === 'youtu.be' || u.hostname === 'music.youtube.com';

    if (!isYoutubeHost) {
      const hub = hostedHubBonus(u.hostname, notes);
      score += hub;
    }

    score -= articleOrTranscriptPenalty(input.url, title, text, notes);
  } catch {
    score -= 35;
    notes.push('Malformed URL.');
  }

  const match = credibilityBonus(bestMatchingSourceForUrl(input.url, input.bundledSources));
  if (match > 0) {
    notes.push(`Bundled source alignment (+${match} credibility tier).`);
  }
  score += match;

  return finalizeFitness(score, notes, input.exaScore);
}

function finalizeFitness(rawScore: number, notes: string[], exaScore?: number): UrlExtractionFitness {
  let score = rawScore;

  if (typeof exaScore === 'number' && !Number.isNaN(exaScore)) {
    const bump = Math.min(14, Math.max(-8, Math.round(exaScore * 12)));
    if (bump !== 0) {
      notes.push(`Exa result score tilt ${bump >= 0 ? '+' : ''}${bump}.`);
    }
    score += bump;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let tier: ExtractionFitnessTier;
  if (score >= 68) tier = 'strong';
  else if (score >= 44) tier = 'ok';
  else if (score >= 23) tier = 'weak';
  else tier = 'avoid';

  const uniq = [...new Set(notes)];
  const clipped = uniq.length > 6 ? [...uniq.slice(0, 5), '…additional signals omitted'] : uniq;

  return { score, tier, notes: clipped };
}

export function shouldAvoidDownloaderAttempts(fitness: UrlExtractionFitness): boolean {
  return fitness.tier === 'avoid';
}
