# 恢復本聖經經文來源

本專案新增經節功能使用使用者提供的官方網站：

- 網站：https://www.recoveryversion.com.tw/
- 繁體中文 API：https://www.recoveryversion.com.tw/api/getVerses
- 查詢格式：`GET /api/getVerses?VERSION=1&refs=書卷代碼.章.節`
- 範例：`https://www.recoveryversion.com.tw/api/getVerses?VERSION=1&refs=43.3.16`
- 回傳 JSON 陣列，經文欄位為 `content`，並包含 `chapter_code`、`section_code`、`segment_code`。
- 書卷代碼依官方網站順序為 1 至 66；前端會讓管理者選擇中文書卷名稱，後端只接受 1 至 66 的代碼。
- Apps Script 透過 UrlFetchApp 查詢官方端點；Google 試算表只保存管理者新增的經節索引、經文文字、官方來源網址、時間與管理者帳號，不下載或建立整本聖經資料庫。
