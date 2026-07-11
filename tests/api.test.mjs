import test from 'node:test';
import assert from 'node:assert/strict';
import { DdysMacosApi, makeCacheKey } from '../src/core/api.js';
import { clearCache, resetAll } from '../src/core/storage.js';

test('requests DDYS API and unwraps search results', async () => {
  await resetAll();
  const calls = [];
  const api = new DdysMacosApi({
    apiBase: 'https://example.com/api',
    cacheTtlMinutes: 0,
    requestTimeoutMs: 3000
  }, {
    fetch: async (url) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ success: true, data: [{ title: 'A' }], meta: { total: 1 } });
        }
      };
    }
  });
  const result = await api.search({ q: 'A' });
  assert.equal(result.data[0].title, 'A');
  assert.equal(calls[0], 'https://example.com/api/search?q=A');
});

test('caches GET requests when TTL is enabled', async () => {
  await clearCache();
  let count = 0;
  const api = new DdysMacosApi({
    apiBase: 'https://example.com/api',
    cacheTtlMinutes: 5,
    requestTimeoutMs: 3000
  }, {
    fetch: async () => {
      count += 1;
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ success: true, data: [{ title: 'A' }] });
        }
      };
    }
  });
  await api.latest();
  await api.latest();
  assert.equal(count, 1);
  assert.match(makeCacheKey('https://example.com'), /^api:/);
});

test('sends API key with bearer authorization when configured', async () => {
  await resetAll();
  const calls = [];
  const api = new DdysMacosApi({
    apiBase: 'https://example.com/api',
    apiKey: 'ddys_test_key',
    cacheTtlMinutes: 0,
    requestTimeoutMs: 3000
  }, {
    fetch: async (url, init) => {
      calls.push(init.headers);
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ success: true, data: [] });
        }
      };
    }
  });
  await api.latest();
  assert.equal(calls[0].Authorization, 'Bearer ddys_test_key');
  assert.equal(calls[0].Accept, 'application/json');
});
