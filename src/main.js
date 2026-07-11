import { APP_NAME, APP_TABS, DEFAULT_SETTINGS, MOVIE_TYPES, VERSION } from './core/constants.js';
import { createApi } from './core/api.js';
import { applyTheme, downloadJson, notify, openExternal, readTextFile } from './core/desktop.js';
import { checkSubscriptions, shouldNotify, updateSubscriptionAfterCheck } from './core/subscriptions.js';
import {
  addHistory,
  addSubscription,
  clearCache,
  exportData,
  getState,
  importData,
  removeSubscription,
  saveDiagnostics,
  saveSettings,
  setNote,
  toggleCollectionItem,
  updateSubscriptions
} from './core/storage.js';
import {
  itemKey,
  metaLine,
  movieSiteUrl,
  normalizeMovie,
  safeJsonParse,
  shortText
} from './core/normalize.js';

const root = document.querySelector('#app');

const app = {
  tab: 'discover',
  local: null,
  api: null,
  loading: false,
  error: '',
  query: '',
  type: '',
  latest: [],
  hot: [],
  collections: [],
  search: [],
  searchMeta: null,
  calendar: null,
  activeMovie: null,
  detail: null,
  sources: null,
  related: [],
  subscriptionReport: null,
  diagnostics: null,
  toastTimer: null,
  refreshTimer: null
};

boot();

async function boot() {
  app.local = await getState();
  app.tab = app.local.settings.startupTab || 'discover';
  app.diagnostics = app.local.diagnostics;
  applyTheme(app.local.settings);
  bind();
  render();
  await loadTab(app.tab);
  scheduleRefresh();
}

function bind() {
  root.addEventListener('submit', handleSubmit);
  root.addEventListener('click', handleClick);
  root.addEventListener('change', handleChange);
  document.addEventListener('keydown', handleKeydown);
}

async function handleSubmit(event) {
  const searchForm = event.target.closest('[data-search-form]');
  const settingsForm = event.target.closest('[data-settings-form]');
  const noteForm = event.target.closest('[data-note-form]');
  const subscribeForm = event.target.closest('[data-subscribe-form]');
  if (!searchForm && !settingsForm && !noteForm && !subscribeForm) return;
  event.preventDefault();
  try {
    if (searchForm) {
      const data = new FormData(searchForm);
      app.query = String(data.get('q') || '').trim();
      app.type = String(data.get('type') || '');
      if (!app.query) throw new Error('请输入要搜索的关键词。');
      app.tab = 'search';
      await runSearch();
      return;
    }
    if (settingsForm) {
      await saveSettingsFromForm(settingsForm);
      return;
    }
    if (noteForm) {
      const note = noteForm.querySelector('[name="note"]')?.value || '';
      await setNote(app.activeMovie, note);
      await reloadLocal('备注已保存。');
      return;
    }
    if (subscribeForm) {
      const query = String(new FormData(subscribeForm).get('query') || '').trim();
      await subscribe(query);
    }
  } catch (error) {
    toast(error.message || '操作失败。');
  }
}

async function handleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  event.preventDefault();
  const action = target.dataset.action;
  const value = target.dataset.value || '';
  const data = readPayload(target);
  try {
    if (action === 'tab') {
      app.tab = value;
      render();
      await loadTab(value);
    } else if (action === 'refresh') {
      await clearCache();
      await loadTab(app.tab, true);
    } else if (action === 'detail') {
      await openDetail(data);
    } else if (action === 'favorite') {
      await toggle('favorites', data);
    } else if (action === 'later') {
      await toggle('watchLater', data);
    } else if (action === 'open') {
      const movie = normalizeMovie(data);
      await openExternal(movieSiteUrl(movie, app.local.settings.siteBase), app.local.settings.openTarget);
    } else if (action === 'open-url') {
      await openExternal(value, app.local.settings.openTarget);
    } else if (action === 'subscribe') {
      await subscribe(value || data.title || app.query);
    } else if (action === 'remove-subscription') {
      await removeSubscription(value);
      await reloadLocal('订阅已删除。');
    } else if (action === 'toggle-subscription') {
      await toggleSubscription(value);
    } else if (action === 'check-subscriptions') {
      await runSubscriptionCheck();
    } else if (action === 'diagnostics') {
      await runDiagnostics();
    } else if (action === 'clear-cache') {
      await clearCache();
      toast('API 缓存已清理。');
    } else if (action === 'export') {
      downloadJson(`ddys-macos-export-${new Date().toISOString().slice(0, 10)}.json`, await exportData());
    } else if (action === 'import') {
      root.querySelector('[data-import-file]')?.click();
    } else if (action === 'theme') {
      await saveSettings({ theme: value });
      await reloadLocal('主题已更新。');
    }
  } catch (error) {
    toast(error.message || '操作失败。');
  }
}

async function handleChange(event) {
  const fileInput = event.target.closest('[data-import-file]');
  if (!fileInput || !fileInput.files?.[0]) return;
  try {
    const text = await readTextFile(fileInput.files[0]);
    await importData(JSON.parse(text));
    await reloadLocal('数据已导入。');
  } catch (error) {
    toast(error.message || '导入失败。');
  } finally {
    fileInput.value = '';
  }
}

function handleKeydown(event) {
  const tag = event.target?.tagName?.toLowerCase();
  if (event.key === '/' && !['input', 'textarea', 'select'].includes(tag)) {
    event.preventDefault();
    root.querySelector('[name="q"]')?.focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    root.querySelector('[name="q"]')?.focus();
  }
}

async function api() {
  app.api = await createApi({ settings: app.local?.settings || DEFAULT_SETTINGS });
  return app.api;
}

async function loadTab(tab, force = false) {
  if (tab === 'discover') return loadDiscover(force);
  if (tab === 'calendar') return loadCalendar(force);
  if (tab === 'search' && app.query) return runSearch(force);
  render();
}

async function loadDiscover(force = false) {
  app.loading = true;
  app.error = '';
  render();
  try {
    if (force) await clearCache();
    const client = await api();
    const [latest, hot, collections] = await Promise.all([
      client.latest({ limit: 24 }).catch(() => []),
      client.hot({ limit: 24 }).catch(() => []),
      client.collections({ per_page: 12 }).catch(() => ({ data: [] }))
    ]);
    app.latest = normalizeList(latest);
    app.hot = normalizeList(hot);
    app.collections = normalizeList(collections.data || collections);
  } catch (error) {
    app.error = error.message || '加载失败。';
  } finally {
    app.loading = false;
    render();
  }
}

async function runSearch(force = false) {
  app.loading = true;
  app.error = '';
  render();
  try {
    if (force) await clearCache();
    const client = await api();
    const result = await client.search({
      q: app.query,
      type: app.type || undefined,
      per_page: 36
    });
    app.search = normalizeList(result.data);
    app.searchMeta = result.meta;
  } catch (error) {
    app.error = error.message || '搜索失败。';
  } finally {
    app.loading = false;
    render();
  }
}

async function loadCalendar(force = false) {
  app.loading = true;
  app.error = '';
  render();
  try {
    if (force) await clearCache();
    const now = new Date();
    const client = await api();
    app.calendar = await client.calendar({ year: now.getFullYear(), month: now.getMonth() + 1 });
  } catch (error) {
    app.error = error.message || '日历加载失败。';
  } finally {
    app.loading = false;
    render();
  }
}

async function openDetail(item) {
  const movie = normalizeMovie(item);
  app.activeMovie = movie;
  app.detail = movie;
  app.sources = null;
  app.related = [];
  await addHistory(movie);
  app.local = await getState();
  render();
  try {
    const client = await api();
    const [detail, sources, related] = await Promise.all([
      client.movieDetail(movie.slug).catch(() => movie),
      client.movieSources(movie.slug).catch(() => ({ online: [], download: [] })),
      client.movieRelated(movie.slug).catch(() => ({ related: [] }))
    ]);
    app.detail = normalizeMovie({ ...movie, ...detail });
    app.sources = normalizeSources(sources);
    app.related = normalizeList([...(related?.series || []), ...(related?.related || []), ...(Array.isArray(related) ? related : [])]).slice(0, 8);
    render();
  } catch (error) {
    toast(error.message || '详情加载失败。');
  }
}

async function toggle(name, item) {
  const result = await toggleCollectionItem(name, item);
  await reloadLocal(result.active ? '已加入。' : '已移除。');
}

async function subscribe(query) {
  const text = String(query || '').trim();
  if (!text) throw new Error('没有可订阅的关键词。');
  await addSubscription({ query: text });
  app.tab = 'alerts';
  await reloadLocal('订阅已添加。');
}

async function toggleSubscription(id) {
  const next = app.local.subscriptions.map((item) => (
    item.id === id ? { ...item, enabled: !item.enabled, updatedAt: new Date().toISOString() } : item
  ));
  await updateSubscriptions(next);
  await reloadLocal('订阅状态已更新。');
}

async function runSubscriptionCheck() {
  app.loading = true;
  render();
  try {
    const client = await api();
    const report = await checkSubscriptions(client, app.local.subscriptions, { limit: 24, freshLimit: 8 });
    const updates = new Map(report.matches.map((match) => [
      match.subscription.id,
      updateSubscriptionAfterCheck(match.subscription, match.seenKeys)
    ]));
    await updateSubscriptions(app.local.subscriptions.map((item) => updates.get(item.id) || item));
    app.subscriptionReport = report;
    app.local = await getState();
    if (shouldNotify(report.matches)) {
      await notify(report.summary.title, report.summary.message, app.local.settings.notificationsEnabled);
    }
    toast(report.summary.title);
  } catch (error) {
    toast(error.message || '订阅检查失败。');
  } finally {
    app.loading = false;
    render();
  }
}

async function runDiagnostics() {
  app.loading = true;
  render();
  try {
    const client = await api();
    const result = await client.diagnostics();
    app.diagnostics = await saveDiagnostics({
      ...result,
      version: VERSION,
      userAgent: navigator.userAgent,
      localCounts: {
        favorites: app.local.favorites.length,
        watchLater: app.local.watchLater.length,
        history: app.local.history.length,
        subscriptions: app.local.subscriptions.length
      }
    });
    toast('诊断完成。');
  } catch (error) {
    app.diagnostics = await saveDiagnostics({ ok: false, message: error.message || '诊断失败。' });
    toast(app.diagnostics.message);
  } finally {
    app.loading = false;
    app.local = await getState();
    render();
  }
}

async function saveSettingsFromForm(form) {
  const data = new FormData(form);
  await saveSettings({
    apiBase: data.get('apiBase'),
    siteBase: data.get('siteBase'),
    theme: data.get('theme'),
    startupTab: data.get('startupTab'),
    cacheTtlMinutes: data.get('cacheTtlMinutes'),
    refreshMinutes: data.get('refreshMinutes'),
    requestTimeoutMs: data.get('requestTimeoutMs'),
    notificationsEnabled: data.get('notificationsEnabled') === 'on',
    autoRefreshEnabled: data.get('autoRefreshEnabled') === 'on',
    compactCards: data.get('compactCards') === 'on',
    openTarget: data.get('openTarget')
  });
  await reloadLocal('设置已保存。');
  scheduleRefresh();
}

async function reloadLocal(message) {
  app.local = await getState();
  applyTheme(app.local.settings);
  render();
  if (message) toast(message);
}

function scheduleRefresh() {
  clearInterval(app.refreshTimer);
  const settings = app.local?.settings;
  if (!settings?.autoRefreshEnabled) return;
  app.refreshTimer = setInterval(() => {
    if (app.tab === 'discover') loadDiscover(true);
    if (app.tab === 'alerts') runSubscriptionCheck();
  }, Math.max(5, settings.refreshMinutes) * 60 * 1000);
}

function render() {
  const local = app.local || { settings: DEFAULT_SETTINGS, favorites: [], watchLater: [], history: [], notes: {}, subscriptions: [] };
  const settings = local.settings;
  document.title = `${APP_NAME} ${VERSION}`;
  root.classList.toggle('is-compact', settings.compactCards);
  root.innerHTML = `
    <div class="desktop-shell">
      <aside class="sidebar">
        <div class="brand">
          <img src="/assets/icons/icon-192.png" alt="">
          <div>
            <strong>DDYS</strong>
            <span>macOS ${VERSION}</span>
          </div>
        </div>
        <nav class="nav">${APP_TABS.map((tab) => navButton(tab)).join('')}</nav>
        <div class="sidebar-footer">
          <button class="ghost" data-action="diagnostics">运行诊断</button>
          <button class="ghost" data-action="check-subscriptions">检查订阅</button>
        </div>
      </aside>
      <main class="workspace">
        ${renderTopbar()}
        <section class="status-strip">
          <span>${escapeHtml(settings.apiBase)}</span>
          <span>${local.favorites.length} 收藏</span>
          <span>${local.watchLater.length} 稍后看</span>
          <span>${local.subscriptions.length} 订阅</span>
        </section>
        ${app.error ? `<div class="notice is-error">${escapeHtml(app.error)}</div>` : ''}
        ${app.loading ? '<div class="notice">正在处理...</div>' : ''}
        <section class="view">${renderActive(local)}</section>
      </main>
      <aside class="inspector">${renderDetail(local)}</aside>
    </div>
    <input type="file" accept="application/json,.json" data-import-file hidden>
    <div class="toast" hidden></div>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar">
      <form class="searchbar" data-search-form>
        <input name="q" value="${escapeAttr(app.query)}" placeholder="搜索电影、剧集、关键词" autocomplete="off">
        <select name="type" aria-label="类型">
          ${MOVIE_TYPES.map((type) => `<option value="${type.value}" ${app.type === type.value ? 'selected' : ''}>${type.label}</option>`).join('')}
        </select>
        <button class="primary" type="submit">搜索</button>
      </form>
      <div class="top-actions">
        <button data-action="refresh">刷新</button>
        <button data-action="theme" data-value="${app.local?.settings?.theme === 'dark' ? 'light' : 'dark'}">主题</button>
      </div>
    </header>
  `;
}

function renderActive(local) {
  if (app.tab === 'search') return renderSearch(local);
  if (app.tab === 'calendar') return renderCalendar(local);
  if (app.tab === 'library') return renderLibrary(local);
  if (app.tab === 'alerts') return renderAlerts(local);
  if (app.tab === 'settings') return renderSettings(local);
  return renderDiscover(local);
}

function renderDiscover(local) {
  return `
    <section class="panel">
      <div class="panel-head">
        <div><h1>发现</h1><p>最新更新、热门内容和片单集中在一个桌面窗口里。</p></div>
        <button data-action="subscribe" data-value="最新更新">订阅最新</button>
      </div>
      ${renderSection('最新更新', app.latest, local)}
      ${renderSection('热门内容', app.hot, local)}
      ${app.collections.length ? renderSection('推荐片单', app.collections, local) : ''}
    </section>
  `;
}

function renderSearch(local) {
  const title = app.query ? `搜索：${app.query}` : '搜索';
  const total = app.searchMeta?.total ? `${app.searchMeta.total} 条结果` : `${app.search.length} 条结果`;
  return `
    <section class="panel">
      <div class="panel-head">
        <div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(total)}</p></div>
        ${app.query ? `<button data-action="subscribe" data-value="${escapeAttr(app.query)}">订阅关键词</button>` : ''}
      </div>
      ${renderMovieGrid(app.search, local)}
    </section>
  `;
}

function renderCalendar(local) {
  const calendar = normalizeCalendar(app.calendar);
  return `
    <section class="panel">
      <div class="panel-head">
        <div><h1>更新日历</h1><p>${calendar.title}</p></div>
        <button data-action="refresh">刷新日历</button>
      </div>
      <div class="calendar">
        ${['日', '一', '二', '三', '四', '五', '六'].map((day) => `<div class="weekday">${day}</div>`).join('')}
        ${calendar.cells.map((cell) => `
          <div class="day-cell ${cell.day ? '' : 'is-empty'}">
            <strong>${cell.day || ''}</strong>
            ${cell.items.slice(0, 4).map((item) => `<button data-action="detail" data-payload="${payload(item)}">${escapeHtml(shortText(item.title, 18))}</button>`).join('')}
          </div>
        `).join('')}
      </div>
      ${calendar.items.length ? `<div class="section-gap">${renderMovieGrid(calendar.items, local)}</div>` : ''}
    </section>
  `;
}

function renderLibrary(local) {
  return `
    <section class="panel">
      <div class="panel-head">
        <div><h1>片库</h1><p>本地收藏、稍后看、历史和备注都只保存在当前设备。</p></div>
        <button data-action="export">导出数据</button>
      </div>
      ${renderSection(`收藏 ${local.favorites.length}`, local.favorites, local)}
      ${renderSection(`稍后看 ${local.watchLater.length}`, local.watchLater, local)}
      ${renderSection(`观看历史 ${local.history.length}`, local.history, local)}
    </section>
  `;
}

function renderAlerts(local) {
  const report = app.subscriptionReport;
  return `
    <section class="panel">
      <div class="panel-head">
        <div><h1>订阅提醒</h1><p>按关键词定期检查 DDYS 搜索结果，发现新增内容后发通知。</p></div>
        <button class="primary" data-action="check-subscriptions">立即检查</button>
      </div>
      <form class="inline-form" data-subscribe-form>
        <input name="query" value="${escapeAttr(app.query)}" placeholder="关键词，例如导演、片名、类型">
        <button type="submit">添加订阅</button>
      </form>
      ${report ? `<div class="notice">${escapeHtml(report.summary.title)}，错误 ${report.errors.length} 条。</div>` : ''}
      <div class="subscription-list">
        ${local.subscriptions.length ? local.subscriptions.map((item) => renderSubscription(item)).join('') : '<div class="empty">暂无订阅。</div>'}
      </div>
      ${report?.matches?.length ? renderSubscriptionMatches(report.matches, local) : ''}
    </section>
  `;
}

function renderSettings(local) {
  const settings = local.settings;
  return `
    <section class="panel">
      <div class="panel-head">
        <div><h1>设置</h1><p>API、缓存、通知、主题和本地数据管理。</p></div>
        <div class="button-row">
          <button data-action="import">导入</button>
          <button data-action="export">导出</button>
        </div>
      </div>
      <form class="settings-form" data-settings-form>
        ${field('API Base', 'apiBase', settings.apiBase)}
        ${field('站点 Base', 'siteBase', settings.siteBase)}
        <div class="form-grid">
          ${numberField('缓存分钟', 'cacheTtlMinutes', settings.cacheTtlMinutes, 0, 1440)}
          ${numberField('刷新分钟', 'refreshMinutes', settings.refreshMinutes, 5, 1440)}
          ${numberField('请求超时毫秒', 'requestTimeoutMs', settings.requestTimeoutMs, 3000, 60000)}
          <label>打开方式<select name="openTarget">
            ${option('external', '系统浏览器', settings.openTarget)}
            ${option('in-app', '当前窗口', settings.openTarget)}
            ${option('copy', '复制链接', settings.openTarget)}
          </select></label>
          <label>主题<select name="theme">
            ${option('system', '跟随系统', settings.theme)}
            ${option('light', '浅色', settings.theme)}
            ${option('dark', '深色', settings.theme)}
          </select></label>
          <label>启动页<select name="startupTab">
            ${APP_TABS.map((tab) => option(tab.id, tab.label, settings.startupTab)).join('')}
          </select></label>
        </div>
        <div class="switch-grid">
          ${switchField('notificationsEnabled', '订阅通知', settings.notificationsEnabled)}
          ${switchField('autoRefreshEnabled', '自动刷新', settings.autoRefreshEnabled)}
          ${switchField('compactCards', '紧凑卡片', settings.compactCards)}
        </div>
        <div class="button-row">
          <button class="primary" type="submit">保存设置</button>
          <button type="button" data-action="clear-cache">清理缓存</button>
          <button type="button" data-action="diagnostics">运行诊断</button>
        </div>
      </form>
      ${renderDiagnostics(app.diagnostics || local.diagnostics)}
    </section>
  `;
}

function renderDetail(local) {
  const movie = app.detail ? normalizeMovie(app.detail) : null;
  if (!movie) {
    return `
      <div class="detail-empty">
        <img src="/assets/icons/icon-192.png" alt="">
        <strong>选择一部影片</strong>
        <span>详情、资源、相关内容和本地备注会显示在这里。</span>
      </div>
    `;
  }
  const sources = app.sources || { online: [], download: [], other: [] };
  const note = local.notes?.[itemKey(movie)] || '';
  return `
    <article class="detail">
      ${poster(movie)}
      <div class="detail-title">
        <h2>${escapeHtml(movie.title)}</h2>
        <p>${escapeHtml(metaLine(movie) || '暂无元数据')}</p>
      </div>
      <div class="button-row">
        <button data-action="favorite" data-payload="${payload(movie)}">收藏</button>
        <button data-action="later" data-payload="${payload(movie)}">稍后看</button>
        <button class="primary" data-action="open" data-payload="${payload(movie)}">打开</button>
      </div>
      ${movie.intro ? `<p class="summary">${escapeHtml(shortText(movie.intro, 360))}</p>` : ''}
      <form data-note-form class="note-box">
        <label>本地备注</label>
        <textarea name="note" rows="4" placeholder="记录看到哪一集、资源质量、个人备注">${escapeHtml(note)}</textarea>
        <button type="submit">保存备注</button>
      </form>
      ${renderResources('在线资源', sources.online)}
      ${renderResources('下载资源', sources.download)}
      ${sources.other.length ? renderResources('其他资源', sources.other) : ''}
      ${app.related.length ? `<section class="mini-section"><h3>相关内容</h3>${renderMiniList(app.related)}</section>` : ''}
    </article>
  `;
}

function renderSection(title, items, local) {
  return `<section class="content-section"><h2>${escapeHtml(title)}</h2>${renderMovieGrid(items, local)}</section>`;
}

function renderMovieGrid(items, local) {
  const list = normalizeList(items);
  if (!list.length) return '<div class="empty">暂无内容。</div>';
  const favoriteKeys = new Set(local.favorites.map((item) => itemKey(item)));
  const laterKeys = new Set(local.watchLater.map((item) => itemKey(item)));
  return `
    <div class="movie-grid">
      ${list.map((movie) => {
        const key = itemKey(movie);
        return `
          <article class="movie-card">
            <button class="poster-button" data-action="detail" data-payload="${payload(movie)}">${poster(movie)}</button>
            <div class="card-body">
              <button class="title-button" data-action="detail" data-payload="${payload(movie)}">${escapeHtml(movie.title)}</button>
              <p>${escapeHtml(metaLine(movie) || '暂无元数据')}</p>
              <div class="card-actions">
                <button data-action="favorite" data-payload="${payload(movie)}">${favoriteKeys.has(key) ? '已收藏' : '收藏'}</button>
                <button data-action="later" data-payload="${payload(movie)}">${laterKeys.has(key) ? '已稍后' : '稍后'}</button>
                <button data-action="open" data-payload="${payload(movie)}">打开</button>
              </div>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderMiniList(items) {
  return `
    <div class="mini-list">
      ${items.map((movie) => `
        <button data-action="detail" data-payload="${payload(movie)}">
          <span>${escapeHtml(movie.title)}</span>
          <small>${escapeHtml(metaLine(movie))}</small>
        </button>
      `).join('')}
    </div>
  `;
}

function renderResources(title, items) {
  const list = Array.isArray(items) ? items : [];
  return `
    <section class="mini-section">
      <h3>${escapeHtml(title)} <span>${list.length}</span></h3>
      ${list.length ? `<div class="resource-list">${list.map((item) => `
        <div class="resource">
          <strong>${escapeHtml(item.name || item.title || item.label || '资源')}</strong>
          <span>${escapeHtml([item.quality, item.format, item.size, item.type].filter(Boolean).join(' / ') || '暂无说明')}</span>
          <div class="button-row">
            ${item.url ? `<button data-action="open-url" data-value="${escapeAttr(item.url)}">打开链接</button>` : ''}
            ${item.extract_code ? `<code>提取码 ${escapeHtml(item.extract_code)}</code>` : ''}
          </div>
        </div>
      `).join('')}</div>` : '<div class="empty">暂无资源。</div>'}
    </section>
  `;
}

function renderSubscription(item) {
  return `
    <article class="subscription">
      <div>
        <strong>${escapeHtml(item.query)}</strong>
        <span>${item.enabled ? '已启用' : '已暂停'} / 上次检查 ${escapeHtml(item.lastCheckedAt || '暂无')}</span>
      </div>
      <div class="button-row">
        <button data-action="toggle-subscription" data-value="${escapeAttr(item.id)}">${item.enabled ? '暂停' : '启用'}</button>
        <button data-action="remove-subscription" data-value="${escapeAttr(item.id)}">删除</button>
      </div>
    </article>
  `;
}

function renderSubscriptionMatches(matches, local) {
  const movies = normalizeList(matches.flatMap((match) => match.fresh));
  if (!movies.length) return '<div class="empty">本次没有新增结果。</div>';
  return renderSection('本次新增结果', movies, local);
}

function renderDiagnostics(result) {
  if (!result) return '';
  return `
    <section class="diagnostics">
      <h2>诊断结果</h2>
      <pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>
    </section>
  `;
}

function navButton(tab) {
  return `<button class="${app.tab === tab.id ? 'is-active' : ''}" data-action="tab" data-value="${tab.id}">${tab.label}</button>`;
}

function field(label, name, value) {
  return `<label>${escapeHtml(label)}<input name="${escapeAttr(name)}" value="${escapeAttr(value)}"></label>`;
}

function numberField(label, name, value, min, max) {
  return `<label>${escapeHtml(label)}<input name="${escapeAttr(name)}" type="number" min="${min}" max="${max}" value="${escapeAttr(value)}"></label>`;
}

function switchField(name, label, checked) {
  return `<label class="switch"><span>${escapeHtml(label)}</span><input name="${escapeAttr(name)}" type="checkbox" ${checked ? 'checked' : ''}></label>`;
}

function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function poster(movie) {
  if (movie.poster) {
    return `<span class="poster"><img src="${escapeAttr(movie.poster)}" alt="${escapeAttr(movie.title)}" loading="lazy"></span>`;
  }
  return `<span class="poster is-fallback"><span>${escapeHtml(String(movie.title || 'DD').slice(0, 2))}</span></span>`;
}

function normalizeList(items) {
  return (Array.isArray(items) ? items : []).map((item) => normalizeMovie(item)).filter((item) => item.title);
}

function normalizeSources(input) {
  if (Array.isArray(input)) return { online: input, download: [], other: [] };
  const sources = input && typeof input === 'object' ? input : {};
  const online = [
    ...(Array.isArray(sources.online) ? sources.online : []),
    ...(Array.isArray(sources.play) ? sources.play : []),
    ...(Array.isArray(sources.playlist) ? sources.playlist : [])
  ];
  const download = [
    ...(Array.isArray(sources.download) ? sources.download : []),
    ...(Array.isArray(sources.downloads) ? sources.downloads : []),
    ...(Array.isArray(sources.cloud) ? sources.cloud : [])
  ];
  const used = new Set(['online', 'play', 'playlist', 'download', 'downloads', 'cloud']);
  const other = Object.entries(sources)
    .filter(([key, value]) => !used.has(key) && Array.isArray(value))
    .flatMap(([, value]) => value);
  return { online, download, other };
}

function normalizeCalendar(calendar) {
  const now = new Date();
  const year = Number(calendar?.year || now.getFullYear());
  const month = Number(calendar?.month || now.getMonth() + 1);
  const days = calendar?.days && typeof calendar.days === 'object' ? calendar.days : groupCalendarMovies(calendar?.movies || calendar?.items || []);
  const count = new Date(year, month, 0).getDate();
  const first = new Date(year, month - 1, 1).getDay();
  const cells = Array.from({ length: first }, () => ({ day: '', items: [] }));
  const items = [];
  for (let day = 1; day <= count; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayItems = normalizeList(days[key] || []);
    items.push(...dayItems);
    cells.push({ day, items: dayItems });
  }
  while (cells.length % 7 !== 0) cells.push({ day: '', items: [] });
  return { title: `${year}-${String(month).padStart(2, '0')}`, cells, items };
}

function groupCalendarMovies(items) {
  const out = {};
  for (const item of Array.isArray(items) ? items : []) {
    const key = String(item.date || item.release_date || item.day || '').slice(0, 10);
    if (!key) continue;
    out[key] = [...(out[key] || []), item];
  }
  return out;
}

function toast(message) {
  const box = root.querySelector('.toast');
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
  clearTimeout(app.toastTimer);
  app.toastTimer = setTimeout(() => {
    box.hidden = true;
  }, 2600);
}

function readPayload(element) {
  return safeJsonParse(element.dataset.payload || '{}', {});
}

function payload(value) {
  return escapeAttr(JSON.stringify(value || {}));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
