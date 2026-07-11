import { MAX_CACHE_ENTRIES } from './constants.js';
import { buildUrl, normalizeBaseUrl, unwrapData, unwrapPaginated } from './normalize.js';
import { getSettings, readCache, writeCache } from './storage.js';

export class DdysMacosApi {
  constructor(settings, options = {}) {
    this.settings = settings;
    this.fetchImpl = options.fetch || globalThis.fetch;
    if (typeof this.fetchImpl !== 'function') throw new Error('当前运行环境缺少 Fetch API。');
  }

  async request(path, query = {}, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const url = buildUrl(this.settings.apiBase, path, query);
    const cacheKey = method === 'GET' && options.cache !== false ? makeCacheKey(url) : '';
    const ttlMs = Math.max(0, Number(this.settings.cacheTtlMinutes || 0)) * 60 * 1000;
    if (cacheKey && ttlMs > 0) {
      const cache = await readCache();
      const cached = cache[cacheKey];
      if (cached && Date.now() - cached.time < ttlMs) return cached.value;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('DDYS API 请求超时。')), this.settings.requestTimeoutMs);
    let response;
    let json;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      const text = await response.text();
      json = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(error?.message || 'DDYS API 请求失败。');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok || json?.success === false) {
      throw new Error(json?.message || `DDYS API HTTP ${response.status}`);
    }

    if (cacheKey && ttlMs > 0) await putCache(cacheKey, json);
    return json;
  }

  async search(params) {
    return unwrapPaginated(await this.request('/search', params));
  }

  async suggest(q) {
    return unwrapData(await this.request('/suggest', { q }));
  }

  async latest(params = {}) {
    return unwrapData(await this.request('/latest', params));
  }

  async hot(params = {}) {
    return unwrapData(await this.request('/hot', params));
  }

  async calendar(params = {}) {
    return unwrapData(await this.request('/calendar', params));
  }

  async movies(params = {}) {
    return unwrapPaginated(await this.request('/movies', params));
  }

  async movieDetail(slug) {
    return unwrapData(await this.request(`/movies/${encodeURIComponent(String(slug))}`));
  }

  async movieSources(slug) {
    return unwrapData(await this.request(`/movies/${encodeURIComponent(String(slug))}/sources`));
  }

  async movieRelated(slug) {
    return unwrapData(await this.request(`/movies/${encodeURIComponent(String(slug))}/related`));
  }

  async collections(params = {}) {
    return unwrapPaginated(await this.request('/collections', params));
  }

  async shares(params = {}) {
    return unwrapPaginated(await this.request('/shares', params));
  }

  async requests(params = {}) {
    return unwrapPaginated(await this.request('/requests', params));
  }

  async dictionaries() {
    const [types, genres, regions] = await Promise.all([
      this.request('/types').then(unwrapData).catch(() => []),
      this.request('/genres').then(unwrapData).catch(() => []),
      this.request('/regions').then(unwrapData).catch(() => [])
    ]);
    return { types, genres, regions };
  }

  async diagnostics() {
    const startedAt = Date.now();
    const latest = await this.latest({ limit: 1 });
    return {
      ok: true,
      apiBase: this.settings.apiBase,
      latencyMs: Date.now() - startedAt,
      sampleCount: Array.isArray(latest) ? latest.length : 0
    };
  }
}

export async function createApi(options = {}) {
  const settings = options.settings || await getSettings();
  return new DdysMacosApi({
    ...settings,
    apiBase: normalizeBaseUrl(settings.apiBase, settings.apiBase)
  }, options);
}

export function makeCacheKey(url) {
  let hash = 0;
  for (const char of String(url)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return `api:${Math.abs(hash).toString(36)}`;
}

async function putCache(key, value) {
  const cache = await readCache();
  const next = { ...cache, [key]: { time: Date.now(), value } };
  const entries = Object.entries(next).sort((a, b) => b[1].time - a[1].time).slice(0, MAX_CACHE_ENTRIES);
  await writeCache(Object.fromEntries(entries));
}
