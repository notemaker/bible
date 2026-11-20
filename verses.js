const VERSE_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbywV6iqZ3yV5qlmpejFtsy6QmhdABj4yqLIqIf4LQyI-6knsrmPjOa5wNJYbf1Zg7Th0A/exec'
};
const ADMIN_SESSION_KEY = 'bible-truth-admin-session';
const BOOKS = [
  ['創世記', 1], ['出埃及記', 2], ['利未記', 3], ['民數記', 4], ['申命記', 5], ['約書亞記', 6], ['士師記', 7], ['路得記', 8], ['撒母耳記上', 9], ['撒母耳記下', 10], ['列王紀上', 11], ['列王紀下', 12], ['歷代志上', 13], ['歷代志下', 14], ['以斯拉記', 15], ['尼希米記', 16], ['以斯帖記', 17], ['約伯記', 18], ['詩篇', 19], ['箴言', 20], ['傳道書', 21], ['雅歌', 22], ['以賽亞書', 23], ['耶利米書', 24], ['耶利米哀歌', 25], ['以西結書', 26], ['但以理書', 27], ['何西阿書', 28], ['約珥書', 29], ['阿摩司書', 30], ['俄巴底亞書', 31], ['約拿書', 32], ['彌迦書', 33], ['那鴻書', 34], ['哈巴谷書', 35], ['西番雅書', 36], ['哈該書', 37], ['撒迦利亞書', 38], ['瑪拉基書', 39], ['馬太福音', 40], ['馬可福音', 41], ['路加福音', 42], ['約翰福音', 43], ['使徒行傳', 44], ['羅馬書', 45], ['哥林多前書', 46], ['哥林多後書', 47], ['加拉太書', 48], ['以弗所書', 49], ['腓立比書', 50], ['歌羅西書', 51], ['帖撒羅尼迦前書', 52], ['帖撒羅尼迦後書', 53], ['提摩太前書', 54], ['提摩太後書', 55], ['提多書', 56], ['腓利門書', 57], ['希伯來書', 58], ['雅各書', 59], ['彼得前書', 60], ['彼得後書', 61], ['約翰一書', 62], ['約翰二書', 63], ['約翰三書', 64], ['猶大書', 65], ['啟示錄', 66]
];
const $ = (selector) => document.querySelector(selector);
let session = null;
let preview = null;

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || 'null'); } catch { return null; }
}
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
    await new Promise((resolve) => setTimeout(resolve, 650));
    const receipt = await jsonp({ action: 'status', requestId });
    if (receipt?.result?.status === 'pending') continue;
    return receipt;
  }
  throw new Error('Google 試算表尚未回覆，請稍後重新整理確認。');
}
function renderBooks() {
  $('#bookInput').innerHTML = `<option value="">請選擇書卷</option>${BOOKS.map(([name, code]) => `<option value="${code}" data-book="${name}">${name}</option>`).join('')}`;
}
async function lookupVerse(event) {
  event.preventDefault();
  const option = $('#bookInput').selectedOptions[0];
  const chapter = Number($('#chapterInput').value);
  const verse = Number($('#verseInput').value);
  if (!option?.value || !Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verse) || verse < 1) { showMessage('請選擇書卷並輸入有效的章、節。'); return; }
  const button = $('#lookupButton'); button.disabled = true; button.textContent = '查詢中…'; $('#versePreview').hidden = true; showMessage('正在從官方恢復本網站查詢…', true);
  try {
    const result = await jsonp({ action: 'bibleLookup', book: option.dataset.book, bookCode: option.value, chapter, verse });
    if (result?.error === '不支援的讀取操作') throw new Error('Apps Script 尚未更新到新增經節版本，請先將最新版 Code.gs 部署為新的 Web App 版本。');
    if (!result?.ok || !result.verse) throw new Error(result?.error || '找不到這個經節。');
    preview = result.verse;
    $('#previewReference').textContent = preview.reference;
    $('#previewText').textContent = preview.text;
    $('#previewSource').href = preview.sourceUrl;
    $('#versePreview').hidden = false;
    showMessage('查詢成功，請確認經文後儲存。', true);
  } catch (error) { preview = null; showMessage(error.message || '經節查詢失敗。'); }
  finally { button.disabled = false; button.textContent = '查詢經節'; }
}
async function saveVerse() {
  if (!preview || !session?.credential) return;
  const button = $('#saveButton'); button.disabled = true; button.textContent = '儲存中…'; showMessage('正在寫入 Google 試算表…', true);
  try {
    const receipt = await postAndWait({ action: 'addVerse', credential: session.credential, record: preview });
    if (!receipt?.result?.ok) throw new Error(receipt?.result?.error || '經節儲存失敗。');
    showMessage('經節已儲存，正在返回首頁…', true);
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
