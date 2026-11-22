const VERSE_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbywV6iqZ3yV5qlmpejFtsy6QmhdABj4yqLIqIf4LQyI-6knsrmPjOa5wNJYbf1Zg7Th0A/exec'
};
const ADMIN_SESSION_KEY = 'bible-truth-admin-session';
const BOOKS = [
  ['創世記', 1], ['出埃及記', 2], ['利未記', 3], ['民數記', 4], ['申命記', 5], ['約書亞記', 6], ['士師記', 7], ['路得記', 8], ['撒母耳記上', 9], ['撒母耳記下', 10], ['列王紀上', 11], ['列王紀下', 12], ['歷代志上', 13], ['歷代志下', 14], ['以斯拉記', 15], ['尼希米記', 16], ['以斯帖記', 17], ['約伯記', 18], ['詩篇', 19], ['箴言', 20], ['傳道書', 21], ['雅歌', 22], ['以賽亞書', 23], ['耶利米書', 24], ['耶利米哀歌', 25], ['以西結書', 26], ['但以理書', 27], ['何西阿書', 28], ['約珥書', 29], ['阿摩司書', 30], ['俄巴底亞書', 31], ['約拿書', 32], ['彌迦書', 33], ['那鴻書', 34], ['哈巴谷書', 35], ['西番雅書', 36], ['哈該書', 37], ['撒迦利亞書', 38], ['瑪拉基書', 39], ['馬太福音', 40], ['馬可福音', 41], ['路加福音', 42], ['約翰福音', 43], ['使徒行傳', 44], ['羅馬書', 45], ['哥林多前書', 46], ['哥林多後書', 47], ['加拉太書', 48], ['以弗所書', 49], ['腓立比書', 50], ['歌羅西書', 51], ['帖撒羅尼迦前書', 52], ['帖撒羅尼迦後書', 53], ['提摩太前書', 54], ['提摩太後書', 55], ['提多書', 56], ['腓利門書', 57], ['希伯來書', 58], ['雅各書', 59], ['彼得前書', 60], ['彼得後書', 61], ['約翰一書', 62], ['約翰二書', 63], ['約翰三書', 64], ['猶大書', 65], ['啟示錄', 66]
];
const $ = (selector) => document.querySelector(selector);
let session = null;
let preview = [];

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || 'null'); } catch { return null; }
}
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function showMessage(message, success = false) { const node = $('#verseMessage'); node.textContent = message; node.style.color = success ? 'var(--sage-deep)' : 'var(--coral)'; }
function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callback = `__bibleVerse_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('查詢逾時，請稍後再試。')); }, 15000);
    const cleanup = () => { clearTimeout(timer); delete window[callback]; script.remove(); };
    window[callback] = (payload) => { cleanup(); resolve(payload); };
    script.onerror = () => { cleanup(); reject(new Error('目前無法連線 Apps Script。')); };
    script.src = `${VERSE_CONFIG.appsScriptUrl}?${new URLSearchParams({ ...params, callback }).toString()}`;
    document.body.appendChild(script);
  });
}
async function postAndWait(payload) {
  const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  await fetch(VERSE_CONFIG.appsScriptUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, requestId }) });
  for (let attempt = 0; attempt < 18; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 250 : attempt === 1 ? 350 : 500));
    const receipt = await jsonp({ action: 'status', requestId });
    if (receipt?.result?.status === 'pending') continue;
    return receipt;
  }
  throw new Error('Google 試算表尚未回覆，請稍後再試。');
}
function renderBooks() {
  const options = `<option value="">請選擇書卷</option>${BOOKS.map(([name, code]) => `<option value="${code}" data-book="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}`;
  [1, 2, 3].forEach((index) => { $(`#bookInput${index}`).innerHTML = options; });
}
function readEntry(index) {
  const option = $(`#bookInput${index}`).selectedOptions[0];
  const chapterValue = $(`#chapterInput${index}`).value.trim();
  const verseValue = $(`#verseInput${index}`).value.trim();
  const empty = !option?.value && !chapterValue && !verseValue;
  if (empty) return null;
  const chapter = Number(chapterValue);
  const verse = Number(verseValue);
  if (!option?.value || !Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) throw new Error(`第 ${index} 處經節的書卷、章與節尚未填完整。`);
  return { book: option.dataset.book, bookCode: option.value, chapter, verse };
}
async function lookupVerse(event) {
  event.preventDefault();
  let entries;
  try {
    entries = [1, 2, 3].map(readEntry).filter(Boolean);
    if (!entries.length) throw new Error('請至少輸入第 1 處經節。');
    if (!readEntry(1)) throw new Error('第 1 處經節為必填。');
  } catch (error) { showMessage(error.message); return; }
  const button = $('#lookupButton'); button.disabled = true; button.textContent = '查詢中…'; $('#versePreview').hidden = true; showMessage(`正在查詢 ${entries.length} 處官方恢復本經節…`, true);
  try {
    const results = await Promise.all(entries.map((entry) => jsonp({ action: 'bibleLookup', ...entry })));
    const failed = results.find((result) => result?.error === '不支援的讀取操作');
    if (failed) throw new Error('Apps Script 尚未更新到新增經節版本，請先部署最新版 Code.gs。');
    const invalid = results.find((result) => !result?.ok || !result.verse);
    if (invalid) throw new Error(invalid?.error || '其中一處經節查詢失敗。');
    preview = results.map((result) => result.verse);
    $('#previewList').innerHTML = preview.map((verse) => `<li><strong>${escapeHtml(verse.reference)}</strong><blockquote>${escapeHtml(verse.text)}</blockquote><a class="verse-source" href="${escapeHtml(verse.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看官方恢復本來源</a></li>`).join('');
    $('#versePreview').hidden = false;
    showMessage(`查詢成功，共 ${preview.length} 處，請確認後儲存。`, true);
  } catch (error) { preview = []; showMessage(error.message || '經節查詢失敗。'); }
  finally { button.disabled = false; button.textContent = '查詢經節'; }
}
async function saveVerse() {
  if (!preview.length || !session?.credential) return;
  const button = $('#saveButton'); button.disabled = true; button.textContent = '儲存中…';
  try {
    for (let index = 0; index < preview.length; index += 1) {
      showMessage(`正在儲存第 ${index + 1} / ${preview.length} 處經節…`, true);
      const receipt = await postAndWait({ action: 'addVerse', credential: session.credential, record: preview[index] });
      if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || `第 ${index + 1} 處經節儲存失敗。`);
    }
    showMessage(`已儲存 ${preview.length} 處經節，正在返回首頁…`, true);
    setTimeout(() => { window.location.href = './'; }, 650);
  } catch (error) { showMessage(error.message || '經節儲存失敗。'); button.disabled = false; button.textContent = '儲存經節'; }
}
function logout() { sessionStorage.removeItem(ADMIN_SESSION_KEY); window.location.href = './'; }
function init() {
  session = loadSession();
  if (!session?.credential || !session?.user) { document.body.innerHTML = '<main class="app-shell"><section class="verse-panel"><h1>需要管理者登入</h1><p class="helper-text">請先在首頁使用核准的 Google 帳號登入，再開啟新增經節功能。</p><a class="button button-primary" href="./">返回首頁</a></section></main>'; return; }
  $('#adminName').textContent = session.user.displayName || session.user.email || '管理者';
  renderBooks();
  $('#verseForm').addEventListener('submit', lookupVerse);
  $('#saveButton').addEventListener('click', saveVerse);
  $('#logoutButton').addEventListener('click', logout);
}
init();
