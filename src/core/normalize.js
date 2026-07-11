import { DEFAULT_SITE_BASE } from './constants.js';

export function normalizeBaseUrl(value, fallback) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text.replace(/\/+$/, '');
}

export function buildUrl(base, path, query = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${normalizeBaseUrl(base, base)}${normalizedPath}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function unwrapData(envelope) {
  if (envelope?.success === true) return envelope.data;
  if (Array.isArray(envelope)) return envelope;
  return envelope?.data ?? envelope;
}

export function unwrapPaginated(envelope) {
  if (envelope?.success === true) {
    const data = extractItems(envelope.data);
    return { data, meta: envelope.meta || createMeta(data) };
  }
  const data = extractItems(envelope);
  return { data, meta: envelope?.meta || createMeta(data) };
}

export function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['data', 'items', 'movies', 'results', 'list', 'rows']) {
    if (Array.isArray(payload[key])) return payload[key];
    if (payload[key] && typeof payload[key] === 'object') {
      const nested = extractItems(payload[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function normalizeMovie(item = {}) {
  const title = item.title || item.name || item.movie_title || item.keyword || '未命名影片';
  const slug = item.slug || item.id || item.movie_id || slugify(title);
  const url = item.url || item.link || item.permalink || `/movies/${encodeURIComponent(String(slug))}`;
  return {
    ...item,
    id: item.id ?? item.movie_id ?? slug,
    title,
    slug,
    poster: item.poster || item.cover || item.image || item.pic || '',
    year: item.year || item.release_year || item.date_year || '',
    rating: item.rating ?? item.score ?? item.rate ?? '',
    type: item.type || item.type_code || item.category || '',
    region: item.region || item.region_code || item.area || '',
    intro: item.intro || item.description || item.summary || item.content || '',
    url
  };
}

export function itemKey(item = {}) {
  const movie = normalizeMovie(item);
  return String(movie.slug || movie.id || movie.title).trim().toLowerCase();
}

export function movieSiteUrl(item = {}, siteBase = DEFAULT_SITE_BASE) {
  const movie = normalizeMovie(item);
  if (/^https?:\/\//i.test(movie.url || '')) return movie.url;
  const path = movie.url || `/movies/${encodeURIComponent(String(movie.slug))}`;
  return `${normalizeBaseUrl(siteBase, DEFAULT_SITE_BASE)}${path.startsWith('/') ? path : `/${path}`}`;
}

export function metaLine(item = {}) {
  const movie = normalizeMovie(item);
  return [movie.year, movie.type, movie.region, movie.rating ? `评分 ${movie.rating}` : ''].filter(Boolean).join(' / ');
}

export function createMeta(data = []) {
  const total = Array.isArray(data) ? data.length : 0;
  return { total, page: 1, per_page: total, total_pages: 1 };
}

export function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'movie';
}

export function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function shortText(value, length = 80) {
  const text = String(value || '').trim();
  return text.length > length ? `${text.slice(0, Math.max(0, length - 1))}...` : text;
}

export function uniqueMovies(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    const movie = normalizeMovie(item);
    const key = itemKey(movie);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(movie);
  }
  return out;
}
