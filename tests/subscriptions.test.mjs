import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSubscriptions,
  findSubscriptionMatches,
  shouldNotify,
  summarizeMatches,
  updateSubscriptionAfterCheck
} from '../src/core/subscriptions.js';

test('finds only fresh subscription matches', () => {
  const sub = { id: 's1', query: 'A', lastSeenKeys: ['old'] };
  const result = findSubscriptionMatches(sub, [{ title: 'Old', slug: 'old' }, { title: 'New', slug: 'new' }]);
  assert.equal(result.fresh.length, 1);
  assert.equal(result.fresh[0].slug, 'new');
  assert.equal(shouldNotify([result]), true);
});

test('updates subscription seen keys and summary', () => {
  const updated = updateSubscriptionAfterCheck({ id: 's1', query: 'A', lastSeenKeys: ['a'] }, ['b', 'a']);
  assert.deepEqual(updated.lastSeenKeys.slice(0, 2), ['b', 'a']);
  const summary = summarizeMatches([{ fresh: [{ title: '新片' }] }]);
  assert.equal(summary.total, 1);
  assert.match(summary.title, /1/);
});

test('checks subscriptions through an api client', async () => {
  const api = {
    async search() {
      return { data: [{ title: '新片', slug: 'new' }] };
    }
  };
  const report = await checkSubscriptions(api, [{ id: 's1', query: '新片', enabled: true }]);
  assert.equal(report.matches.length, 1);
  assert.equal(report.summary.total, 1);
  assert.equal(report.errors.length, 0);
});
