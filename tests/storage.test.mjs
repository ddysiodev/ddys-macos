import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addHistory,
  addSubscription,
  exportData,
  getState,
  importData,
  resetAll,
  saveSettings,
  setNote,
  toggleCollectionItem
} from '../src/core/storage.js';

test('stores settings and local collections without browser localStorage', async () => {
  await resetAll();
  const settings = await saveSettings({ cacheTtlMinutes: 30, theme: 'dark', requestTimeoutMs: 5000 });
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.cacheTtlMinutes, 30);

  const movie = { title: '本地电影', slug: 'local-movie' };
  const favorite = await toggleCollectionItem('favorites', movie);
  assert.equal(favorite.active, true);
  await addHistory(movie);
  await setNote(movie, '看到第二集');

  const state = await getState();
  assert.equal(state.favorites.length, 1);
  assert.equal(state.history.length, 1);
  assert.equal(state.notes['local-movie'], '看到第二集');
});

test('imports, exports, and normalizes subscriptions', async () => {
  await resetAll();
  await addSubscription({ query: '科幻' });
  const exported = await exportData();
  assert.equal(exported.subscriptions[0].query, '科幻');

  await resetAll();
  await importData(exported);
  const state = await getState();
  assert.equal(state.subscriptions.length, 1);
  assert.equal(state.subscriptions[0].enabled, true);
});
