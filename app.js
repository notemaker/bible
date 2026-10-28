const DEMO_TYPES = [
  { id: 'type-1', name: '主日講道' },
  { id: 'type-2', name: '查經分享' },
  { id: 'type-3', name: '信仰見證' }
];

const DEMO_MEDIA = [
  { id: 'demo-1', title: '在盼望中持守信仰', url: 'https://www.youtube.com/results?search_query=在盼望中持守信仰', type: '主日講道', description: '從聖經的信息重新看見盼望，學習在日常生活裡持守所信的道路。', createdAt: '2026-10-24', createdBy: '示範資料' },
  { id: 'demo-2', title: '約翰福音：光照在黑暗裡', url: 'https://www.youtube.com/results?search_query=約翰福音+光照在黑暗裡', type: '查經分享', description: '一起讀約翰福音開頭的經文，思想光、生命與真理之間的關係。', createdAt: '2026-10-20', createdBy: '示範資料' },
  { id: 'demo-3', title: '一段重新學會禱告的見證', url: 'https://www.youtube.com/results?search_query=重新學會禱告+信仰見證', type: '信仰見證', description: '在看似安靜的時候，如何重新回到禱告與信靠的起點。', createdAt: '2026-10-16', createdBy: '示範資料' },
  { id: 'demo-4', title: '聽見真理，也活出真理', url: 'https://www.youtube.com/results?search_query=聽見真理+活出真理+講道', type: '主日講道', description: '真理不只停留在理解，也邀請我們用選擇與行動回應。', createdAt: '2026-10-09', createdBy: '示範資料' }
];

const CONFIG_KEY = 'bible-truth-config';
const LEGACY_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby7SL4pFi-SSnR2_i58V9tfBI6T1_K4bGIzpAq457UdbL_wu4cBjzqFs4LMzh-TUkmRyg/exec';
const DEFAULT_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwb-JHphis9OXKiSVzK-Eo7wsveS0ZiOfsHF0Y6uP-RYtGyyEquEJm_4UzI2ED0YMIO2Q/exec',
  googleClientId: '736171088462-ias9uqmm9j7crschd80ddj0je2mf8a2k.apps.googleusercontent.com'
};
const state = {
  media: [...DEMO_MEDIA],
  types: [...DEMO_TYPES],
  filteredMedia: [],
  config: loadConfig(),
  isLive: false,
  isAdmin: false,
  user: null,
  credential: null,
  modal: null,
  search: '',
  type: 'all',
  toastTimer: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    if (saved.appsScriptUrl === LEGACY_APPS_SCRIPT_URL) saved.appsScriptUrl = DEFAULT_CONFIG.appsScriptUrl;
    return { ...DEFAULT_CONFIG, ...saved };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig() {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({
    appsScriptUrl: (state.config.appsScriptUrl || '').trim(),
    googleClientId: (state.config.googleClientId || '').trim()
  }));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function formatDate(value) {
  if (!value) return '尚未標記日期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function setConnectionState(live) {
  const el = $('#connectionState');
  el.classList.toggle('connected', live);
  el.innerHTML = `<span class="status-dot"></span>${live ? '已連線 Google 試算表' : '示範資料'}`;
  $('#demoNotice').hidden = live;
}

function renderTypeOptions() {
  const options = [`<option value="all">全部類型</option>`, ...state.types.map((type) => `<option value="${escapeHtml(type.name)}">${escapeHtml(type.name)}</option>`)];
  const filter = $('#typeFilter');
  filter.innerHTML = options.join('');
  filter.value = state.types.some((type) => type.name === state.type) ? state.type : 'all';
  const mediaType = $('#mediaTypeInput');
  mediaType.innerHTML = state.types.length ? state.types.map((type) => `<option value="${escapeHtml(type.name)}">${escapeHtml(type.name)}</option>`).join('') : '<option value="">請先新增影音類型</option>';
}

function renderMedia() {
  const query = state.search.trim().toLowerCase();
  state.filteredMedia = state.media.filter((item) => {
    const inType = state.type === 'all' || item.type === state.type;
    const haystack = `${item.title} ${item.description} ${item.type}`.toLowerCase();
    return inType && (!query || haystack.includes(query));
  });
  $('#collectionCount').textContent = `${state.filteredMedia.length} 部影音`;
  const grid = $('#mediaGrid');
  if (!state.filteredMedia.length) {
    grid.innerHTML = `<div class="empty-state"><strong>還沒有符合條件的影音</strong><span>${state.media.length ? '換個搜尋字詞或清除影音類型篩選。' : '管理者登入後，可以把第一段影音收進來。'}</span></div>`;
    return;
  }
  grid.innerHTML = state.filteredMedia.map((item) => {
    const link = isHttpsUrl(item.url) ? `<a class="watch-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">開啟影音</a>` : '';
    return `<article class="media-card">
      <div class="card-topline"><span class="type-tag">${escapeHtml(item.type || '未分類')}</span><span class="card-date">${formatDate(item.createdAt)}</span></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description || '這段影音尚未加上說明。')}</p>
      <div class="card-footer"><span class="card-source">${escapeHtml(item.createdBy || (state.isLive ? 'Google 試算表' : '示範資料'))}</span>${link}</div>
    </article>`;
  }).join('');
}

function renderAdminState() {
  $$('.admin-only').forEach((element) => { element.hidden = !state.isAdmin; });
  $('#loginButton').hidden = state.isAdmin;
  $('#adminActions').hidden = !state.isAdmin;
  $('#adminName').textContent = state.user?.displayName || state.user?.email || '管理者';
}

function render() {
  renderTypeOptions();
  renderMedia();
  renderAdminState();
  setConnectionState(state.isLive);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}

function openModal(name) {
  state.modal = name;
  $('#modalBackdrop').hidden = false;
  $$('.modal').forEach((modal) => { modal.hidden = modal.id !== `${name}Modal`; });
  if (name === 'login') {
    $('#appsScriptUrlInput').value = state.config.appsScriptUrl || '';
    $('#googleClientIdInput').value = state.config.googleClientId || '';
    $('#loginMessage').textContent = state.config.appsScriptUrl && state.config.googleClientId ? '已設定連線，請使用 Google 帳號登入。' : '請先填入連線設定，或使用下方示範管理者模式預覽。';
    renderGoogleButton();
  }
}

function closeModal() {
  state.modal = null;
  $('#modalBackdrop').hidden = true;
  $$('.modal').forEach((modal) => { modal.hidden = true; });
}

function updateLoginMessage(message, tone = 'error') {
  const node = $('#loginMessage');
  node.textContent = message;
  node.style.color = tone === 'success' ? 'var(--sage-deep)' : 'var(--coral)';
}

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (document.querySelector('script[data-google-identity]')) return new Promise((resolve) => { document.querySelector('script[data-google-identity]').addEventListener('load', resolve, { once: true }); });
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function renderGoogleButton() {
  const target = $('#googleSignInButton');
  target.innerHTML = '';
  if (!state.config.googleClientId) {
    target.innerHTML = '<p class="helper-text">尚未設定 Google OAuth Client ID，完成上方設定後即可顯示 Google 登入按鈕。</p>';
    return;
  }
  loadGoogleScript().then(() => {
    if (!window.google?.accounts?.id) throw new Error('Google 登入元件尚未就緒。');
    window.google.accounts.id.initialize({ client_id: state.config.googleClientId, callback: handleGoogleCredential, auto_select: false, cancel_on_tap_outside: true });
    window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 340, logo_alignment: 'left' });
  }).catch(() => {
    target.innerHTML = '<p class="helper-text">Google 登入元件載入失敗，請確認網路連線與 Client ID。</p>';
  });
}

window.handleGoogleCredential = async function handleGoogleCredential(response) {
  state.credential = response.credential;
  if (!state.config.appsScriptUrl) {
    updateLoginMessage('請先填入 Apps Script Web App URL。');
    return;
  }
  updateLoginMessage('正在向 Google 試算表確認管理者權限…', 'success');
  try {
    const result = await submitAndWait({ action: 'auth', credential: state.credential });
    if (!result?.ok || !result.result?.ok) throw new Error(result?.result?.error || result?.error || '登入驗證失敗。');
    state.user = result.result;
    state.isAdmin = Boolean(result.result.isAdmin);
    if (!state.isAdmin) {
      updateLoginMessage(`帳號 ${result.result.email || ''} 尚未被加入管理者名單。`);
      state.credential = null;
      return;
    }
    closeModal();
    render();
    showToast(`已登入：${state.user.displayName || state.user.email}`);
  } catch (error) {
    updateLoginMessage(error.message || '登入驗證失敗。');
    state.credential = null;
  }
};

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callbackName = `__bibleTruth_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const query = new URLSearchParams({ ...params, callback: callbackName });
    const timer = setTimeout(() => { cleanup(); reject(new Error('連線逾時，請檢查 Apps Script 網址。')); }, 10000);
    const cleanup = () => { clearTimeout(timer); delete window[callbackName]; script.remove(); };
    window[callbackName] = (payload) => { cleanup(); resolve(payload); };
    script.src = `${state.config.appsScriptUrl.replace(/\/$/, '')}?${query.toString()}`;
    script.onerror = () => { cleanup(); reject(new Error('無法讀取 Google 試算表。')); };
    document.body.appendChild(script);
  });
}

async function submitAndWait(payload) {
  const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const body = { ...payload, requestId };
  await fetch(state.config.appsScriptUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    const receipt = await jsonp({ action: 'status', requestId });
    if (receipt?.result?.ok === false || receipt?.result?.code) return receipt;
    if (receipt?.result || receipt?.ok === false) return receipt;
  }
  throw new Error('Google 試算表尚未回覆，請稍後重新整理確認。');
}

async function loadLiveData() {
  if (!state.config.appsScriptUrl) return;
  try {
    const result = await jsonp({ action: 'list' });
    if (!result?.ok) throw new Error(result?.error || '資料讀取失敗。');
    state.media = Array.isArray(result.media) ? result.media : [];
    state.types = Array.isArray(result.types) && result.types.length ? result.types : [...DEMO_TYPES];
    state.isLive = true;
    render();
  } catch (error) {
    state.isLive = false;
    render();
    showToast(error.message || '目前先使用示範資料。');
  }
}

async function saveConnectionSettings() {
  state.config.appsScriptUrl = $('#appsScriptUrlInput').value.trim();
  state.config.googleClientId = $('#googleClientIdInput').value.trim();
  saveConfig();
  if (state.config.appsScriptUrl && !state.config.appsScriptUrl.endsWith('/exec')) {
    updateLoginMessage('請使用以 /exec 結尾的正式 Apps Script Web App 網址。');
    return;
  }
  closeModal();
  if (state.config.appsScriptUrl) {
    showToast('正在讀取 Google 試算表…');
    await loadLiveData();
  } else {
    state.isLive = false;
    render();
  }
}

function enterDemoAdmin() {
  state.isLive = false;
  state.isAdmin = true;
  state.user = { displayName: '示範管理者', email: 'demo@local.preview' };
  state.credential = 'demo-credential';
  closeModal();
  render();
  showToast('已進入示範管理者模式；正式環境請使用 Google 登入。');
}

function logout() {
  state.isAdmin = false;
  state.user = null;
  state.credential = null;
  render();
  showToast('已登出管理者模式。');
}

function openMediaModal() {
  if (!state.isAdmin) return;
  renderTypeOptions();
  if (!state.types.length) {
    showToast('請先新增至少一個影音類型。');
    openModal('type');
    return;
  }
  $('#mediaForm').reset();
  titleLookupRequest += 1;
  $('#mediaUrlStatus').textContent = '';
  $('#mediaThumbnailStatus').textContent = '';
  $('#mediaForm [name="title"]').dataset.manual = 'false';
  openModal('media');
}

function getYouTubeUrl(value) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'youtu.be') return `https://www.youtube.com/watch?v=${url.pathname.slice(1)}`;
    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      const videoId = url.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    }
  } catch {
    return '';
  }
  return '';
}

function getYouTubeThumbnail(value) {
  const youtubeUrl = getYouTubeUrl(value);
  if (!youtubeUrl) return '';
  try {
    const videoId = new URL(youtubeUrl).searchParams.get('v');
    return videoId ? `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` : '';
  } catch {
    return '';
  }
}

function updateVideoThumbnail() {
  const form = $('#mediaForm');
  const thumbnailInput = form.elements.thumbnail;
  const status = $('#mediaThumbnailStatus');
  const thumbnail = getYouTubeThumbnail(form.elements.url.value);
  thumbnailInput.value = thumbnail;
  status.textContent = thumbnail ? '已自動帶入 YouTube 影片縮圖網址。' : (form.elements.url.value.trim() ? '目前只會自動產生 YouTube 縮圖網址。' : '');
}

let titleLookupTimer;
let titleLookupRequest = 0;

async function lookupVideoTitle() {
  const form = $('#mediaForm');
  const urlInput = form.elements.url;
  const titleInput = form.elements.title;
  const status = $('#mediaUrlStatus');
  const youtubeUrl = getYouTubeUrl(urlInput.value);
  if (!youtubeUrl) {
    status.textContent = urlInput.value.trim() ? '目前只會自動讀取 YouTube 影片標題，其他影音可手動輸入。' : '';
    return;
  }
  const request = ++titleLookupRequest;
  status.textContent = '正在讀取影片標題…';
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`);
    if (!response.ok) throw new Error('title lookup failed');
    const data = await response.json();
    if (request !== titleLookupRequest) return;
    if (!titleInput.value.trim() || titleInput.dataset.manual !== 'true') {
      titleInput.dataset.filling = 'true';
      titleInput.value = data.title || '';
      titleInput.dataset.filling = 'false';
    }
    status.textContent = data.title ? '已自動帶入 YouTube 影片標題，可再自行修改。' : '找不到影片標題，請手動輸入。';
  } catch {
    if (request === titleLookupRequest) status.textContent = '無法自動取得影片標題，請手動輸入。';
  }
}

function scheduleVideoTitleLookup() {
  clearTimeout(titleLookupTimer);
  titleLookupTimer = setTimeout(lookupVideoTitle, 450);
}

async function handleMediaSubmit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const record = Object.fromEntries(form.entries());
  if (!isHttpsUrl(record.url)) { showToast('影音網址必須使用 https://。'); return; }
  if (!state.isLive) {
    state.media.unshift({ ...record, id: `local-${Date.now()}`, createdAt: new Date().toISOString(), createdBy: state.user?.displayName || '示範管理者' });
    closeModal();
    render();
    showToast('已加入示範清單。');
    return;
  }
  try {
    const receipt = await submitAndWait({ action: 'addMedia', credential: state.credential, record });
    if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || '影音儲存失敗。');
    closeModal();
    await loadLiveData();
    showToast('影音已加入收藏清單。');
  } catch (error) { showToast(error.message || '影音儲存失敗。'); }
}

async function handleTypeSubmit(event) {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get('name').trim();
  if (!name) return;
  if (!state.isLive) {
    state.types.push({ id: `local-type-${Date.now()}`, name });
    closeModal();
    render();
    showToast('已新增示範影音類型。');
    return;
  }
  try {
    const receipt = await submitAndWait({ action: 'addType', credential: state.credential, name });
    if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || '影音類型儲存失敗。');
    closeModal();
    await loadLiveData();
    showToast('影音類型已新增。');
  } catch (error) { showToast(error.message || '影音類型儲存失敗。'); }
}

function wireEvents() {
  $('#loginButton').addEventListener('click', () => openModal('login'));
  $('#openSettingsButton').addEventListener('click', () => openModal('login'));
  $('#logoutButton').addEventListener('click', logout);
  $('#addMediaButton').addEventListener('click', openMediaModal);
  $('#addTypeButton').addEventListener('click', () => openModal('type'));
  $('#saveSettingsButton').addEventListener('click', saveConnectionSettings);
  $('#demoAdminButton').addEventListener('click', enterDemoAdmin);
  $('#searchInput').addEventListener('input', (event) => { state.search = event.target.value; renderMedia(); });
  $('#typeFilter').addEventListener('change', (event) => { state.type = event.target.value; renderMedia(); });
  $('#mediaForm [name="url"]').addEventListener('input', () => { updateVideoThumbnail(); scheduleVideoTitleLookup(); });
  $('#mediaForm [name="url"]').addEventListener('blur', lookupVideoTitle);
  $('#mediaForm [name="title"]').addEventListener('input', (event) => {
    if (event.target.dataset.filling !== 'true') event.target.dataset.manual = 'true';
  });
  $('#mediaForm').addEventListener('submit', handleMediaSubmit);
  $('#typeForm').addEventListener('submit', handleTypeSubmit);
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  $('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.modal) closeModal(); });
}

wireEvents();
render();
loadLiveData();
