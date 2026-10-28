# 聖經真理

以 Google 試算表保存影音、影音類型與管理者名單的簡化版影音收集 Web App。前端參考 `https://notemaker.github.io/youtube/` 的收藏清單概念，但只保留搜尋、影音類型篩選、Google 管理者登入與必要的新增按鈕。

## 本機預覽

```bash
npm start
```

開啟 `http://localhost:3000`。未設定 Apps Script 時，畫面會顯示示範資料；示範管理者模式只用於預覽，不是正式權限驗證。

## Google 試算表設定

1. 建立一份專用 Google 試算表，開啟「擴充功能 → Apps Script」。
2. 將 `apps-script/Code.gs` 的全部內容貼到 `Code.gs`。
3. 在 `Code.gs` 的 `CONFIG` 設定 `SPREADSHEET_ID` 與 `GOOGLE_CLIENT_ID`。試算表 ID 只放在 Apps Script，不放公開前端。
4. 執行 `setup()` 並完成 Google 授權。它會建立 `Media`、`Types`、`Admins` 三張工作表。
5. 在 `Admins` 第一筆資料填入管理者 Google 帳號 email，`active` 填 `TRUE`。
6. 在 Google Cloud Console 建立 Web application OAuth Client ID，把網站來源加入 Authorized JavaScript origins。
7. Apps Script 選擇「部署 → 新增部署 → 網頁應用程式」，執行身分選「我」，誰可以存取選「任何人」，使用正式 `/exec` 網址。
8. 回到網站，點選「管理者登入」，在連線設定填入 `/exec` 網址與 Google OAuth Client ID。

## 試算表欄位

- `Media`: `id | title | url | type | description | createdAt | createdBy | thumbnail`
- `Types`: `id | name | createdAt`
- `Admins`: `email | displayName | active`

Apps Script 會在伺服器端驗證 Google Identity Services 的 ID token，再比對 `Admins` 工作表；前端不自行決定正式管理權限。正式資料驗收需要使用者部署自己的 `/exec` 並連接自己的試算表，本專案不宣稱已完成真實雲端讀寫驗收。

## 重要安全提醒

「任何人可存取」的 Apps Script `/exec` 網址是前端連線入口，請不要公開分享或提交到公開原始碼。試算表本身不必公開。若未來需要更細緻的角色與稽核，應把驗證與資料 API 移到正式後端服務。
