export const VERSION = '0.1.0';
export const APP_NAME = 'DDYS macOS';
export const DEFAULT_API_BASE = 'https://ddys.io/api/v1';
export const DEFAULT_SITE_BASE = 'https://ddys.io';
export const MAX_CACHE_ENTRIES = 120;
export const MAX_HISTORY_ITEMS = 160;
export const MAX_SUBSCRIPTION_SEEN = 120;

export const STORAGE_KEYS = Object.freeze({
  settings: 'ddysMacos.settings',
  favorites: 'ddysMacos.favorites',
  watchLater: 'ddysMacos.watchLater',
  history: 'ddysMacos.history',
  notes: 'ddysMacos.notes',
  subscriptions: 'ddysMacos.subscriptions',
  apiCache: 'ddysMacos.apiCache',
  diagnostics: 'ddysMacos.diagnostics'
});

export const DEFAULT_SETTINGS = Object.freeze({
  apiBase: DEFAULT_API_BASE,
  siteBase: DEFAULT_SITE_BASE,
  locale: 'zh-CN',
  theme: 'system',
  startupTab: 'discover',
  cacheTtlMinutes: 15,
  refreshMinutes: 60,
  requestTimeoutMs: 12000,
  notificationsEnabled: true,
  autoRefreshEnabled: true,
  openTarget: 'external',
  compactCards: false
});

export const EMPTY_STATE = Object.freeze({
  favorites: [],
  watchLater: [],
  history: [],
  notes: {},
  subscriptions: [],
  apiCache: {},
  diagnostics: null
});

export const APP_TABS = Object.freeze([
  { id: 'discover', label: '发现' },
  { id: 'search', label: '搜索' },
  { id: 'calendar', label: '日历' },
  { id: 'library', label: '片库' },
  { id: 'alerts', label: '订阅' },
  { id: 'settings', label: '设置' }
]);

export const MOVIE_TYPES = Object.freeze([
  { value: '', label: '全部' },
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'variety', label: '综艺' },
  { value: 'anime', label: '动漫' },
  { value: 'documentary', label: '纪录片' }
]);
