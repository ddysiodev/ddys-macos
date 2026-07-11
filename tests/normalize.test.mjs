import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUrl,
  extractItems,
  itemKey,
  metaLine,
  movieSiteUrl,
  normalizeMovie,
  shortText,
  unwrapPaginated
} from '../src/core/normalize.js';

test('normalizes common movie fields', () => {
  const movie = normalizeMovie({ name: '测试电影', cover: 'cover.jpg', score: 8.1, area: 'CN' });
  assert.equal(movie.title, '测试电影');
  assert.equal(movie.poster, 'cover.jpg');
  assert.equal(movie.rating, 8.1);
  assert.equal(movie.region, 'CN');
  assert.equal(itemKey(movie), '测试电影');
});

test('builds URLs with array and empty query handling', () => {
  const url = buildUrl('https://ddys.io/api/v1/', '/search', { q: 'abc', tag: ['a', 'b'], empty: '' });
  assert.equal(url, 'https://ddys.io/api/v1/search?q=abc&tag=a&tag=b');
});

test('unwraps paginated and nested payloads', () => {
  const result = unwrapPaginated({ success: true, data: { list: [{ title: 'A' }] }, meta: { total: 1 } });
  assert.equal(result.data.length, 1);
  assert.equal(result.meta.total, 1);
  assert.deepEqual(extractItems({ data: { results: [{ title: 'B' }] } })[0].title, 'B');
});

test('creates site URLs and readable metadata', () => {
  const movie = normalizeMovie({ title: 'Movie', slug: 'movie', year: 2026, type: 'movie', region: 'US', rating: 9 });
  assert.equal(movieSiteUrl(movie, 'https://ddys.io/'), 'https://ddys.io/movies/movie');
  assert.equal(metaLine(movie), '2026 / movie / US / 评分 9');
  assert.equal(shortText('abcdef', 4), 'abc...');
});
