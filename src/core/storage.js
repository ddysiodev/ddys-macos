import {
  DEFAULT_SETTINGS,
  EMPTY_STATE,
  MAX_CACHE_ENTRIES,
  MAX_HISTORY_ITEMS,
  STORAGE_KEYS
} from './constants.js';
import { clampNumber, itemKey, normalizeBaseUrl, normalizeMovie, uniqueMovies } from './normalize.js';

const memoryStore = new Map();

export async function getSettings() {
  return normalizeSettings(readValue(STORAGE_KEYS.settings));
}

export async function saveSettings(input) {
  const settings = normalizeSettings({ ...(await getSettings()), ...(input || {}) });
  writeValue(STORAGE_KEYS.settings, settings);
  return settings;
}

export async function getState() {
  return {
    settings: await getSettings(),
    favorites: normalizeList(readValue(STORAGE_KEYS.favorites)),
    watchLater: normalizeList(readValue(STORAGE_KEYS.watchLater)),
    history: normalizeList(readValue(STORAGE_KEYS.history)),
    notes: normalizeNotes(readValue(STORAGE_KEYS.notes)),
    subscriptions: normalizeSubscriptions(readValue(STORAGE_KEYS.subscriptions)),
    apiCache: normalizeObject(readValue(STORAGE_KEYS.apiCache)),
    diagnostics: readValue(STORAGE_KEYS.diagnostics) || null
  };
}

export async function setCollection(name, list) {
  const key = STORAGE_KEYS[name];
  if (!key) throw new Error(`Unknown collection: ${name}`);
  const normalized = normalizeList(list);
  writeValue(key, normalized);
  return normalized;
}

export async function toggleCollectionItem(name, item) {
  const key = STORAGE_KEYS[name];
  if (!key) throw new Error(`Unknown collection: ${name}`);
  const state = await getState();
  const list = normalizeList(state[name]);
  const movie = stampMovie(item);
  const keyValue = itemKey(movie);
  const exists = list.some((entry) => itemKey(entry) === keyValue);
  const next = exists ? list.filter((entry) => itemKey(entry) !== keyValue) : [movie, ...list];
  writeValue(key, next);
  return { active: !exists, list: next };
}

export async function addHistory(item) {
  const state = await getState();
  const movie = stampMovie(item);
  const keyValue = itemKey(movie);
  const next = [movie, ...state.history.filter((entry) => itemKey(entry) !== keyValue)].slice(0, MAX_HISTORY_ITEMS);
  writeValue(STORAGE_KEYS.history, next);
  return next;
}

export async function setNote(item, note) {
  const state = await getState();
  const key = itemKey(item);
  const notes = { ...state.notes };
  if (String(note || '').trim()) notes[key] = String(note).trim();
  else delete notes[key];
  writeValue(STORAGE_KEYS.notes, notes);
  return notes;
}

export async function addSubscription(input) {
  const state = await getState();
  const query = String(input?.query || input?.title || '').trim();
  if (!query) throw new Error('订阅关键词不能为空。');
  const subscription = {
    id: input?.id || `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: input?.type || 'keyword',
    query,
    enabled: input?.enabled !== false,
    createdAt: input?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastCheckedAt: input?.lastCheckedAt || '',
    lastSeenKeys: Array.isArray(input?.lastSeenKeys) ? input.lastSeenKeys : []
  };
  const next = [subscription, ...state.subscriptions.filter((item) => item.id !== subscription.id)];
  writeValue(STORAGE_KEYS.subscriptions, next);
  return subscription;
}

export async function updateSubscriptions(subscriptions) {
  const next = normalizeSubscriptions(subscriptions);
  writeValue(STORAGE_KEYS.subscriptions, next);
  return next;
}

export async function removeSubscription(id) {
  const state = await getState();
  const next = state.subscriptions.filter((item) => item.id !== id);
  writeValue(STORAGE_KEYS.subscriptions, next);
  return next;
}

export async function readCache() {
  return normalizeObject(readValue(STORAGE_KEYS.apiCache));
}

export async function writeCache(cache) {
  const entries = Object.entries(normalizeObject(cache))
    .sort((a, b) => Number(b[1]?.time || 0) - Number(a[1]?.time || 0))
    .slice(0, MAX_CACHE_ENTRIES);
  writeValue(STORAGE_KEYS.apiCache, Object.fromEntries(entries));
}

export async function clearCache() {
  writeValue(STORAGE_KEYS.apiCache, {});
}

export async function saveDiagnostics(result) {
  const diagnostics = { ...result, checkedAt: new Date().toISOString() };
  writeValue(STORAGE_KEYS.diagnostics, diagnostics);
  return diagnostics;
}

export async function exportData() {
  const state = await getState();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    favorites: state.favorites,
    watchLater: state.watchLater,
    history: state.history,
    notes: state.notes,
    subscriptions: state.subscriptions
  };
}

export async function importData(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('导入数据不是有效 JSON。');
  writeValue(STORAGE_KEYS.settings, normalizeSettings(payload.settings));
  writeValue(STORAGE_KEYS.favorites, normalizeList(payload.favorites));
  writeValue(STORAGE_KEYS.watchLater, normalizeList(payload.watchLater));
  writeValue(STORAGE_KEYS.history, normalizeList(payload.history));
  writeValue(STORAGE_KEYS.notes, normalizeNotes(payload.notes));
  writeValue(STORAGE_KEYS.subscriptions, normalizeSubscriptions(payload.subscriptions));
  return getState();
}

export async function resetAll() {
  for (const key of Object.values(STORAGE_KEYS)) removeValue(key);
}

export function normalizeSettings(input = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...(input || {}) };
  return {
    ...merged,
    apiBase: normalizeBaseUrl(merged.apiBase, DEFAULT_SETTINGS.apiBase),
    siteBase: normalizeBaseUrl(merged.siteBase, DEFAULT_SETTINGS.siteBase),
    apiKey: String(merged.apiKey || '').trim(),
    theme: ['system', 'light', 'dark'].includes(merged.theme) ? merged.theme : DEFAULT_SETTINGS.theme,
    startupTab: ['discover', 'search', 'calendar', 'library', 'alerts', 'settings'].includes(merged.startupTab)
      ? merged.startupTab
      : DEFAULT_SETTINGS.startupTab,
    cacheTtlMinutes: clampNumber(merged.cacheTtlMinutes, DEFAULT_SETTINGS.cacheTtlMinutes, 0, 1440),
    refreshMinutes: clampNumber(merged.refreshMinutes, DEFAULT_SETTINGS.refreshMinutes, 5, 1440),
    requestTimeoutMs: clampNumber(merged.requestTimeoutMs, DEFAULT_SETTINGS.requestTimeoutMs, 3000, 60000),
    notificationsEnabled: merged.notificationsEnabled !== false,
    autoRefreshEnabled: merged.autoRefreshEnabled !== false,
    compactCards: merged.compactCards === true,
    openTarget: ['external', 'in-app', 'copy'].includes(merged.openTarget) ? merged.openTarget : DEFAULT_SETTINGS.openTarget
  };
}

export function normalizeList(value) {
  return uniqueMovies(Array.isArray(value) ? value : EMPTY_STATE.favorites);
}

export function normalizeSubscriptions(value) {
  return Array.isArray(value)
    ? value
      .filter((item) => item && String(item.query || '').trim())
      .map((item) => ({
        id: item.id || `sub_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        type: item.type || 'keyword',
        query: String(item.query).trim(),
        enabled: item.enabled !== false,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
        lastCheckedAt: item.lastCheckedAt || '',
        lastSeenKeys: Array.isArray(item.lastSeenKeys) ? item.lastSeenKeys.slice(0, 120) : []
      }))
    : [...EMPTY_STATE.subscriptions];
}

function stampMovie(item) {
  return {
    ...normalizeMovie(item),
    savedAt: new Date().toISOString()
  };
}

function normalizeNotes(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function readValue(key) {
  const storage = getLocalStorage();
  const raw = storage ? storage.getItem(key) : memoryStore.get(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeValue(key, value) {
  const raw = JSON.stringify(value);
  const storage = getLocalStorage();
  if (storage) storage.setItem(key, raw);
  else memoryStore.set(key, raw);
}

function removeValue(key) {
  const storage = getLocalStorage();
  if (storage) storage.removeItem(key);
  else memoryStore.delete(key);
}

function getLocalStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}
