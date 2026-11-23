const OVERVIEW_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbywV6iqZ3yV5qlmpejFtsy6QmhdABj4yqLIqIf4LQyI-6knsrmPjOa5wNJYbf1Zg7Th0A/exec'
};
const ADMIN_SESSION_KEY = 'bible-truth-admin-session';
const BOOKS = [
  ['創世記', 1], ['出埃及記', 2], ['利未記', 3], ['民數記', 4], ['申命記', 5], ['約書亞記', 6], ['士師記', 7], ['路得記', 8], ['撒母耳記上', 9], ['撒母耳記下', 10], ['列王紀上', 11], ['列王紀下', 12], ['歷代志上', 13], ['歷代志下', 14], ['以斯拉記', 15], ['尼希米記', 16], ['以斯帖記', 17], ['約伯記', 18], ['詩篇', 19], ['箴言', 20], ['傳道書', 21], ['雅歌', 22], ['以賽亞書', 23], ['耶利米書', 24], ['耶利米哀歌', 25], ['以西結書', 26], ['但以理書', 27], ['何西阿書', 28], ['約珥書', 29], ['阿摩司書', 30], ['俄巴底亞書', 31], ['約拿書', 32], ['彌迦書', 33], ['那鴻書', 34], ['哈巴谷書', 35], ['西番雅書', 36], ['哈該書', 37], ['撒迦利亞書', 38], ['瑪拉基書', 39], ['馬太福音', 40], ['馬可福音', 41], ['路加福音', 42], ['約翰福音', 43], ['使徒行傳', 44], ['羅馬書', 45], ['哥林多前書', 46], ['哥林多後書', 47], ['加拉太書', 48], ['以弗所書', 49], ['腓立比書', 50], ['歌羅西書', 51], ['帖撒羅尼迦前書', 52], ['帖撒羅尼迦後書', 53], ['提摩太前書', 54], ['提摩太後書', 55], ['提多書', 56], ['腓立門書', 57], ['希伯來書', 58], ['雅各書', 59], ['彼得前書', 60], ['彼得後書', 61], ['約翰一書', 62], ['約翰二書', 63], ['約翰三書', 64], ['猶大書', 65], ['啟示錄', 66]
];
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let session = null;
let currentOverview = null;
let videoInfo = { title: '', videoId: '' };

function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function loadSession() { try { return JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || 'null'); } catch { return null; } }
function setMessage(message, success = false) { const node = $('#overviewMessage'); node.textContent = message; node.style.color = success ? 'var(--sage-deep)' : 'var(--coral)'; }
function showToast(message) { const node = $('#overviewToast'); node.textContent = message; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 3600); }
function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callback = `__bibleOverview_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('查詢逾時，請稍後再試。')); }, 30000);
    const cleanup = () => { clearTimeout(timer); delete window[callback]; script.remove(); };
    window[callback] = (payload) => { cleanup(); resolve(payload); };
    script.onerror = () => { cleanup(); reject(new Error('Apps Script 部署網址無效或目前無法連線，請確認 Web App 部署網址。')); };
    script.src = `${OVERVIEW_CONFIG.appsScriptUrl}?${new URLSearchParams({ ...params, callback }).toString()}`;
    document.body.appendChild(script);
  });
}
async function postAndWait(payload) {
  const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  await fetch(OVERVIEW_CONFIG.appsScriptUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, requestId }) });
  for (let attempt = 0; attempt < 18; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 250 : attempt === 1 ? 350 : 500));
    const receipt = await jsonp({ action: 'status', requestId });
    if (receipt?.result?.status === 'pending') continue;
    return receipt;
  }
  throw new Error('Google 試算表尚未回覆，請稍後再試。');
}
function renderBooks() { $('#overviewBookInput').innerHTML = `<option value="">請選擇書卷</option>${BOOKS.map(([name, code]) => `<option value="${code}">${escapeHtml(name)}</option>`).join('')}`; }
function parseVideoId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') return url.searchParams.get('v') || (url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/i) || [])[1] || '';
  } catch { return ''; }
  return '';
}
function renderVideo(url, title) {
  const videoId = parseVideoId(url);
  if (!videoId) return '<div class="empty-overview-block">尚未設定本章鳥瞰影片。</div>';
  return `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0" title="${escapeHtml(title || '本章鳥瞰影片')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
}
function renderAdminState() {
  const isAdmin = Boolean(session?.credential && session?.user);
  $$('.admin-only').forEach((element) => { element.hidden = !isAdmin; });
  $('#adminName').textContent = isAdmin ? (session.user.displayName || session.user.email || '管理者') : '';
  $('#loginButton').hidden = isAdmin;
  $('#logoutButton').hidden = !isAdmin;
}
function logout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  session = null;
  currentOverview = currentOverview ? { ...currentOverview } : null;
  renderAdminState();
  showToast('已登出管理者模式。');
}
function renderOverview(overview) {
  currentOverview = overview;
  $('#overviewContent').hidden = false;
  $('#scriptureTitle').textContent = `${overview.book} 第 ${overview.chapter} 章`;
  $('#scriptureSource').href = overview.sourceUrl || '#';
  $('#scriptureText').innerHTML = (overview.verses || []).map((verse) => `<p><span class="scripture-verse-number">${escapeHtml(verse.verse)}</span>${escapeHtml(verse.text)}</p>`).join('');
  $('#overviewVideoPlayer').innerHTML = renderVideo(overview.youtubeUrl, overview.youtubeTitle);
  $('#truthPointsDisplay').textContent = overview.truthPoints || '尚未整理本章真理要點。';
  $('#overviewYoutubeUrl').value = overview.youtubeUrl || '';
  $('#overviewVideoTitleValue').textContent = overview.youtubeTitle ? `目前影片：${overview.youtubeTitle}` : '';
  $('#truthPointsInput').value = overview.truthPoints || '';
  videoInfo = { title: overview.youtubeTitle || '', videoId: overview.youtubeVideoId || parseVideoId(overview.youtubeUrl || '') };
  $('#overviewDeleteButton').hidden = !overview.id;
}
async function queryChapter(event) {
  event.preventDefault();
  const option = $('#overviewBookInput').selectedOptions[0];
  const chapter = Number($('#overviewChapterInput').value);
  if (!option?.value || !Number.isInteger(chapter) || chapter < 1) { setMessage('請選擇書卷並輸入有效的章數。'); return; }
  const button = $('#overviewQueryButton'); button.disabled = true; button.textContent = '查詢中…'; $('#overviewContent').hidden = true; setMessage('正在查詢官方恢復本本章內容，請稍候…', true);
  try {
    const result = await jsonp({ action: 'bibleOverviewGet', book: option.textContent, bookCode: option.value, chapter });
    if (!result?.ok || !result.overview) {
      if (result?.error === '不支援的讀取操作') throw new Error('目前使用的 Apps Script 尚未更新到聖經鳥瞰版本，請更新部署最新版 Code.gs。');
      throw new Error(result?.error || '本章查詢失敗。');
    }
    renderOverview(result.overview); setMessage(`已載入 ${result.overview.book} 第 ${result.overview.chapter} 章。`, true);
  } catch (error) { setMessage(error.message || '本章查詢失敗。'); }
  finally { button.disabled = false; button.textContent = '查詢本章'; }
}
async function loadVideoInfo() {
  const url = $('#overviewYoutubeUrl').value.trim();
  if (!url) { $('#overviewVideoTitleValue').textContent = '請先輸入 YouTube 影片網址。'; return; }
  const button = $('#overviewVideoInfoButton'); button.disabled = true; button.textContent = '讀取中…';
  try {
    const result = await jsonp({ action: 'videoInfo', url });
    if (!result?.ok) throw new Error(result?.error || '影片資料讀取失敗。');
    videoInfo = { title: result.title || '', videoId: result.videoId || parseVideoId(url) };
    $('#overviewVideoTitleValue').textContent = `影片標題：${videoInfo.title || '未讀取到標題'}`;
    $('#overviewVideoPlayer').innerHTML = renderVideo(url, videoInfo.title);
  } catch (error) { $('#overviewVideoTitleValue').textContent = error.message || '影片資料讀取失敗。'; }
  finally { button.disabled = false; button.textContent = '讀取影片資料'; }
}
async function saveOverview() {
  if (!session?.credential || !currentOverview) return;
  const button = $('#overviewSaveButton'); button.disabled = true; button.textContent = '儲存中…';
  const youtubeUrl = $('#overviewYoutubeUrl').value.trim();
  const record = { ...currentOverview, youtubeUrl, youtubeVideoId: videoInfo.videoId || parseVideoId(youtubeUrl), youtubeTitle: videoInfo.title || '', truthPoints: $('#truthPointsInput').value.trim() };
  try {
    const receipt = await postAndWait({ action: 'bibleOverviewSave', credential: session.credential, record });
    if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || '聖經鳥瞰儲存失敗。');
    currentOverview = { ...currentOverview, ...record, id: receipt.result.overview?.id || currentOverview.id };
    renderOverview(currentOverview); $('#truthPointsDisplay').textContent = currentOverview.truthPoints || '尚未整理本章真理要點。'; showToast('本章聖經鳥瞰已儲存。');
  } catch (error) { showToast(error.message || '聖經鳥瞰儲存失敗。'); }
  finally { button.disabled = false; button.textContent = '儲存本章鳥瞰'; }
}
async function deleteOverview() {
  if (!session?.credential || !currentOverview?.id || !window.confirm('確定要刪除本章聖經鳥瞰資料嗎？')) return;
  const button = $('#overviewDeleteButton'); button.disabled = true; button.textContent = '刪除中…';
  try {
    const receipt = await postAndWait({ action: 'bibleOverviewDelete', credential: session.credential, overviewId: currentOverview.id });
    if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || '刪除失敗。');
    currentOverview = { ...currentOverview, id: '', youtubeUrl: '', youtubeTitle: '', youtubeVideoId: '', truthPoints: '' }; renderOverview(currentOverview); showToast('本章聖經鳥瞰資料已刪除。');
  } catch (error) { showToast(error.message || '刪除失敗。'); }
  finally { button.disabled = false; button.textContent = '刪除本章資料'; }
}
function init() {
  session = loadSession(); renderBooks(); renderAdminState();
  $('#overviewQueryForm').addEventListener('submit', queryChapter);
  $('#overviewVideoInfoButton').addEventListener('click', loadVideoInfo);
  $('#overviewSaveButton').addEventListener('click', saveOverview);
  $('#overviewDeleteButton').addEventListener('click', deleteOverview);
  $('#logoutButton').addEventListener('click', logout);
}
init();
