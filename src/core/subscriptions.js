import { MAX_SUBSCRIPTION_SEEN } from './constants.js';
import { itemKey, normalizeMovie, shortText } from './normalize.js';

export async function checkSubscriptions(api, subscriptions, options = {}) {
  const enabled = (Array.isArray(subscriptions) ? subscriptions : []).filter((item) => item.enabled !== false);
  const matches = [];
  const errors = [];
  for (const subscription of enabled) {
    try {
      const result = await api.search({ q: subscription.query, per_page: options.limit || 20 });
      matches.push(findSubscriptionMatches(subscription, result.data, options.freshLimit || 10));
    } catch (error) {
      errors.push({ subscription, message: error?.message || '订阅检查失败' });
    }
  }
  return { matches, errors, summary: summarizeMatches(matches) };
}

export function findSubscriptionMatches(subscription, items, limit = 10) {
  const previous = new Set(subscription.lastSeenKeys || []);
  const movies = (Array.isArray(items) ? items : []).map((item) => normalizeMovie(item));
  const fresh = movies.filter((item) => !previous.has(itemKey(item))).slice(0, limit);
  return {
    subscription,
    fresh,
    seenKeys: movies.map((item) => itemKey(item)).slice(0, MAX_SUBSCRIPTION_SEEN)
  };
}

export function updateSubscriptionAfterCheck(subscription, seenKeys) {
  return {
    ...subscription,
    lastCheckedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSeenKeys: Array.from(new Set([...(seenKeys || []), ...(subscription.lastSeenKeys || [])])).slice(0, MAX_SUBSCRIPTION_SEEN)
  };
}

export function summarizeMatches(matches) {
  const total = matches.reduce((sum, item) => sum + item.fresh.length, 0);
  const first = matches.find((item) => item.fresh.length)?.fresh[0];
  return {
    total,
    title: total ? `DDYS 有 ${total} 条订阅更新` : 'DDYS 订阅暂无更新',
    message: first ? `${shortText(first.title, 34)} 等内容有新结果` : '所有订阅关键词都已检查完成。'
  };
}

export function shouldNotify(matches) {
  return matches.some((item) => item.fresh.length > 0);
}
