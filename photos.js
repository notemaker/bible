const PHOTO_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbywV6iqZ3yV5qlmpejFtsy6QmhdABj4yqLIqIf4LQyI-6knsrmPjOa5wNJYbf1Zg7Th0A/exec',
  googleClientId: '736171088462-ias9uqmm9j7crschd80ddj0je2mf8a2k.apps.googleusercontent.com'
};
const PHOTO_PAGE_SIZE = 24;
const MAX_FILES_PER_UPLOAD = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const THUMB_IMAGE_EDGE = 480;
const PHOTO_CONFIG_KEY = 'bible-truth-config';

const state = {
  config: loadPhotoConfig(),
  photos: [],
  page: 1,
  hasMore: false,
  loading: false,
  isAdmin: false,
  user: null,
  credential: null,
  loginOpen: false,
  uploadOpen: false,
  toastTimer: null
};

const $ = (selector) => document.querySelector(selector);

function loadPhotoConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(PHOTO_CONFIG_KEY) || '{}');
    return { ...PHOTO_CONFIG, googleClientId: saved.googleClientId || PHOTO_CONFIG.googleClientId, appsScriptUrl: PHOTO_CONFIG.appsScriptUrl };
  } catch {
    return { ...PHOTO_CONFIG };
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function isHttpsUrl(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function formatPhotoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '') : new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
}

function setConnectionState(connected) {
  const node = $('#connectionState');
  node.classList.toggle('connected', connected);
  node.innerHTML = `<span class="status-dot"></span>${connected ? '已連線' : '連線中…'}`;
}

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callbackName = `__biblePhotos_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const query = new URLSearchParams({ ...params, callback: callbackName });
    let timer;
    const cleanup = () => { clearTimeout(timer); delete window[callbackName]; script.remove(); };
    window[callbackName] = (payload) => { cleanup(); resolve(payload); };
    timer = setTimeout(() => { cleanup(); reject(new Error('照片資料連線逾時，請稍後再試。')); }, 15000);
    script.onerror = () => { cleanup(); reject(new Error('目前無法讀取照片資料。')); };
    script.src = `${state.config.appsScriptUrl.replace(/\/$/, '')}?${query.toString()}`;
    document.body.appendChild(script);
  });
}

async function postAndWait(payload) {
  const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  await fetch(state.config.appsScriptUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, requestId }) });
  for (let attempt = 0; attempt < 18; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    const receipt = await jsonp({ action: 'status', requestId });
    if (receipt?.result?.status === 'pending') continue;
    return receipt;
  }
  throw new Error('照片服務尚未回覆，請稍後重新整理確認。');
}

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (document.querySelector('script[data-google-identity]')) return new Promise((resolve, reject) => {
    const script = document.querySelector('script[data-google-identity]');
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', reject, { once: true });
  });
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

function openLogin() {
  state.loginOpen = true;
  renderAdminState();
  loadGoogleScript().then(() => {
    window.google.accounts.id.initialize({ client_id: state.config.googleClientId, callback: handleGoogleCredential, auto_select: false, cancel_on_tap_outside: true });
    window.google.accounts.id.renderButton($('#googleSignInButton'), { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 300, logo_alignment: 'left' });
  }).catch(() => { $('#loginMessage').textContent = 'Google 登入元件載入失敗，請確認網路連線。'; });
}

async function handleGoogleCredential(response) {
  state.credential = response.credential;
  $('#loginMessage').textContent = '正在確認管理者權限…';
  try {
    const receipt = await postAndWait({ action: 'auth', credential: state.credential });
    if (!receipt?.result?.ok || !receipt.result.isAdmin) throw new Error(receipt?.result?.error || '此 Google 帳號尚未被加入管理者名單。');
    state.user = receipt.result;
    state.isAdmin = true;
    state.loginOpen = false;
    renderAdminState();
    showToast(`已登入：${state.user.displayName || state.user.email}`);
    if (new URLSearchParams(location.search).get('upload') === '1') openUpload();
  } catch (error) {
    state.credential = null;
    $('#loginMessage').textContent = error.message || '登入驗證失敗。';
  }
}

function logout() {
  state.isAdmin = false;
  state.user = null;
  state.credential = null;
  state.uploadOpen = false;
  state.loginOpen = false;
  renderAdminState();
  showToast('已登出管理者模式。');
}

function renderAdminState() {
  $('#loginButton').hidden = state.isAdmin;
  $('#adminActions').hidden = !state.isAdmin;
  $('#adminName').textContent = state.user?.displayName || state.user?.email || '管理者';
  $('#addPhotoButton').hidden = !state.isAdmin;
  $('#photoUploadPanel').hidden = !state.isAdmin || !state.uploadOpen;
  $('#loginPanel').hidden = !state.loginOpen || state.isAdmin;
}

function renderPhotos() {
  $('#photoCount').textContent = `${state.photos.length ? state.photos.length + (state.hasMore ? '+' : '') : 0} 張照片`;
  $('#loadMoreButton').hidden = !state.hasMore || state.loading;
  if (!state.photos.length) {
    $('#photoGrid').innerHTML = '<div class="empty-state"><strong>目前沒有已核准的照片</strong><span>管理者上傳後，照片會顯示在這裡。</span></div>';
    return;
  }
  $('#photoGrid').innerHTML = state.photos.map((photo) => {
    const imageUrl = isHttpsUrl(photo.thumbnailUrl) ? escapeHtml(photo.thumbnailUrl) : '';
    const fallbackUrl = isHttpsUrl(photo.driveUrl) ? escapeHtml(photo.driveUrl) : '';
    const adminActions = state.isAdmin ? `<div class="photo-card-actions"><button type="button" data-delete-photo="${escapeHtml(photo.id)}">刪除</button></div>` : '';
    return `<article class="photo-card" data-view-photo="${escapeHtml(photo.id)}"><div class="photo-card-image"><img src="${imageUrl || fallbackUrl}" alt="${escapeHtml(photo.title)}" loading="lazy" onerror="this.closest('.photo-card-image').classList.add('image-failed')" /></div><div class="photo-card-info"><h2>${escapeHtml(photo.title || '未命名照片')}</h2><p>${escapeHtml(photo.description || '')}</p><time datetime="${escapeHtml(photo.createdAt)}">${escapeHtml(formatPhotoDate(photo.createdAt))}</time>${adminActions}</div></article>`;
  }).join('');
}

async function loadPhotos(reset = false) {
  if (state.loading) return;
  if (reset) { state.photos = []; state.page = 1; state.hasMore = false; }
  state.loading = true;
  $('#loadMoreButton').hidden = true;
  try {
    const result = await jsonp({ action: 'photosList', page: state.page, pageSize: PHOTO_PAGE_SIZE });
    if (!result?.ok) throw new Error(result?.error || '照片資料讀取失敗。');
    state.photos = state.photos.concat(Array.isArray(result.photos) ? result.photos : []);
    state.hasMore = Boolean(result.hasMore);
    state.page += 1;
    setConnectionState(true);
    renderPhotos();
  } catch (error) {
    if (!state.photos.length) $('#photoGrid').innerHTML = `<div class="empty-state"><strong>照片功能尚未連線</strong><span>${escapeHtml(error.message || '請確認 Apps Script 已更新並重新部署。')}</span></div>`;
    showToast(error.message || '照片資料讀取失敗。');
  } finally {
    state.loading = false;
    renderPhotos();
  }
}

function openUpload() {
  if (!state.isAdmin) { openLogin(); return; }
  state.uploadOpen = true;
  renderAdminState();
  $('#photoFileInput').focus();
}

function closeUpload() {
  state.uploadOpen = false;
  renderAdminState();
}

function fileToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('照片無法讀取。')); };
    image.src = url;
  });
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('照片壓縮失敗。')), 'image/jpeg', quality));
}

async function resizePhoto(file, maxEdge, quality) {
  const image = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvasBlob(canvas, quality);
}

function stripDataUrl(dataUrl) {
  return String(dataUrl).split(',')[1] || '';
}

function previewFiles() {
  const files = [...$('#photoFileInput').files].slice(0, MAX_FILES_PER_UPLOAD);
  $('#photoPreview').innerHTML = files.map((file) => `<span class="photo-upload-file">${escapeHtml(file.name)}<small>${Math.round(file.size / 1024)} KB</small></span>`).join('');
  if ($('#photoFileInput').files.length > MAX_FILES_PER_UPLOAD) $('#uploadStatus').textContent = `最多上傳 ${MAX_FILES_PER_UPLOAD} 張，已取前 ${MAX_FILES_PER_UPLOAD} 張。`;
}

async function handleUpload(event) {
  event.preventDefault();
  if (!state.isAdmin) return;
  const files = [...$('#photoFileInput').files].slice(0, MAX_FILES_PER_UPLOAD);
  if (!files.length) { $('#uploadStatus').textContent = '請先選擇照片。'; return; }
  if (files.some((file) => file.size > MAX_FILE_BYTES)) { $('#uploadStatus').textContent = '有照片超過 10 MB，請先縮小後再上傳。'; return; }
  const button = $('#uploadPhotoButton');
  button.disabled = true;
  $('#uploadStatus').textContent = '正在壓縮與上傳照片…';
  try {
    const title = $('#photoTitleInput').value.trim();
    const description = $('#photoDescriptionInput').value.trim();
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const original = await resizePhoto(file, MAX_IMAGE_EDGE, 0.82);
      const thumbnail = await resizePhoto(file, THUMB_IMAGE_EDGE, 0.78);
      const originalData = await fileToDataUrl(original);
      const thumbnailData = await fileToDataUrl(thumbnail);
      const receipt = await postAndWait({ action: 'addPhoto', credential: state.credential, record: { title: title || file.name.replace(/\.[^.]+$/, ''), description, fileName: file.name, mimeType: 'image/jpeg', data: stripDataUrl(originalData), thumbnailData: stripDataUrl(thumbnailData) } });
      if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || '照片上傳失敗。');
      $('#uploadStatus').textContent = `已完成 ${index + 1} / ${files.length} 張。`;
    }
    $('#photoForm').reset();
    $('#photoPreview').innerHTML = '';
    showToast('照片已上傳並加入照片集。');
    await loadPhotos(true);
  } catch (error) {
    $('#uploadStatus').textContent = error.message || '照片上傳失敗。';
  } finally {
    button.disabled = false;
  }
}

function openViewer(photoId) {
  const photo = state.photos.find((item) => String(item.id) === String(photoId));
  if (!photo || !isHttpsUrl(photo.driveUrl)) return;
  $('#viewerImage').src = photo.driveUrl;
  $('#viewerImage').alt = photo.title || '照片';
  $('#viewerTitle').textContent = photo.title || '未命名照片';
  $('#viewerDescription').textContent = photo.description || '';
  $('#photoViewer').hidden = false;
  document.body.classList.add('viewer-open');
}

function closeViewer() {
  $('#photoViewer').hidden = true;
  $('#viewerImage').src = '';
  document.body.classList.remove('viewer-open');
}

async function deletePhoto(photoId) {
  if (!state.isAdmin || !confirm('確定要刪除這張照片嗎？')) return;
  try {
    const receipt = await postAndWait({ action: 'deletePhoto', credential: state.credential, photoId });
    if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || '照片刪除失敗。');
    showToast('照片已刪除。');
    await loadPhotos(true);
  } catch (error) { showToast(error.message || '照片刪除失敗。'); }
}

function wireEvents() {
  $('#loginButton').addEventListener('click', () => { state.loginOpen = !state.loginOpen; renderAdminState(); if (state.loginOpen) openLogin(); });
  $('#logoutButton').addEventListener('click', logout);
  $('#addPhotoButton').addEventListener('click', openUpload);
  $('#closeUploadButton').addEventListener('click', closeUpload);
  $('#photoFileInput').addEventListener('change', previewFiles);
  $('#photoForm').addEventListener('submit', handleUpload);
  $('#loadMoreButton').addEventListener('click', () => loadPhotos(false));
  $('#photoGrid').addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-photo]');
    if (deleteButton) { event.stopPropagation(); deletePhoto(deleteButton.dataset.deletePhoto); return; }
    const card = event.target.closest('[data-view-photo]');
    if (card) openViewer(card.dataset.viewPhoto);
  });
  $('#closeViewerButton').addEventListener('click', closeViewer);
  $('#photoViewer').addEventListener('click', (event) => { if (event.target.id === 'photoViewer') closeViewer(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeViewer(); if (state.loginOpen) { state.loginOpen = false; renderAdminState(); } } });
}

wireEvents();
renderAdminState();
renderPhotos();
loadPhotos(true);
if (new URLSearchParams(location.search).get('upload') === '1') openLogin();
