# 集集召會生活：照片收集功能設計方案

## 需求與設計決策

照片功能採用「獨立照片頁面、共用 Apps Script、共用 Google 試算表、Google Drive 專用資料夾」的架構。主頁只增加入口與管理者可見的「新增照片」按鈕，不在影音首頁載入照片資料，避免照片清單、縮圖與檔案處理影響影音顯示速度。

網站的 `/photos` 頁面負責照片瀏覽與管理者上傳。訪客不登入時只能觀看已核准照片；管理者登入後才顯示「新增照片」按鈕與上傳表單。既有影音登入、讀取、篩選、播放器、刪除與修改流程保持不變。

照片檔案只建立在 `notemaker@gmail.com` 所擁有的 Google Drive 專用資料夾內。Google 試算表只保存照片的索引資料，不保存 Base64 或原始影像內容。

## 系統流程

```text
主頁
 ├─ 訪客：觀看影音；可進入「照片」頁面
 └─ 管理者：多出「新增照片」按鈕，進入 /photos?upload=1

/photos
 ├─ public：GAS photosList 只回傳 approved 照片的索引與縮圖網址
 └─ admin：Google 登入後，照片壓縮、上傳至 GAS、建立 Drive 檔案與 Photos 索引

Google Apps Script
 ├─ Media / Types / Admins：沿用現有影音流程，不重寫
 └─ Photos：新增照片索引與管理操作

Google Drive（notemaker@gmail.com）
 └─ 集集召會生活－照片收集
     ├─ originals：實際上傳的壓縮原圖
     └─ thumbnails：網站列表用縮圖
```

## Google 試算表資料設計

在現有試算表新增 `Photos` 工作表，欄位如下：

```text
id | title | description | driveFileId | thumbnailFileId | driveUrl | thumbnailUrl | createdAt | createdBy | status
```

`status` 使用 `pending`、`approved`、`rejected`。公開 `photosList` 只回傳 `approved`，因此管理者上傳後不會直接公開，後續可增加審核介面。第一版可讓管理者上傳後直接建立為 `approved`，但保留欄位以便日後啟用審核。

Apps Script 設定新增：

```text
PHOTO_FOLDER_ID       Drive 專用資料夾 ID
PHOTO_THUMB_FOLDER_ID Drive thumbnails 子資料夾 ID，可選
```

若未設定縮圖資料夾，Apps Script 可先把壓縮後的照片與縮圖放在同一個專用資料夾；正式版本建議分成 `originals` 與 `thumbnails` 子資料夾，方便管理及清理。

公開觀看需要讓「已核准」照片可被瀏覽器讀取。上傳成功後，檔案設定為「知道連結的任何人可檢視」，但不把未核准照片的網址回傳給訪客。檔案所有權仍屬於 `notemaker@gmail.com`；若 Google Workspace 管理政策禁止公開連結，需改採登入觀看或另設圖片代理服務。

## GAS API 設計

新增讀取動作，不修改現有 `list` 回應格式：

- `action=photosList&page=1&pageSize=24`：只回傳已核准照片的索引資料，最新上傳優先。
- `action=photoHealth`：檢查照片資料夾設定與 Photos 工作表是否可用。

新增寫入動作，沿用現有 Google ID Token 管理者驗證：

- `addPhoto`：驗證管理者、檔案 MIME、檔案大小與欄位，建立 Drive 檔案、縮圖檔案及 Photos 索引。
- `deletePhoto`：驗證管理者後，刪除 Photos 索引與對應 Drive 檔案。
- `updatePhoto`：修改標題、說明與狀態，不重新上傳檔案。

照片上傳不與 `listData_()` 合併，避免首頁每次載入影音時讀取照片工作表。現有 `Media`、`Types`、`Admins` 讀寫函式只做必要的 `SHEETS.PHOTOS` 設定擴充，不改變既有欄位與回傳結構。

## 效能設計

照片頁初始只載入 24 筆索引資料，使用「載入更多」或分頁，不一次回傳全部照片。列表使用小縮圖，`loading="lazy"` 延遲載入，點擊縮圖才載入較大的 Drive 圖片檢視器。

瀏覽器在上傳前將照片縮放至最長邊 1600px，轉成 JPEG/WebP，目標檔案大小 2–5 MB，單張硬性上限 10 MB；每次最多 5 張。這可降低 GAS POST payload、Drive 空間與手機上傳時間。

主頁不載入 Photos API、不載入照片圖片、不建立照片元件，因此既有影音首頁效能不受影響。照片頁的 GAS 讀取使用獨立的 `photosList` 動作，並只回傳必要欄位。

## 前端檔案安排

- `public/index.html`：新增訪客可見的「照片」入口，以及管理者登入後顯示的「新增照片」按鈕。
- `public/photos.html`：獨立照片瀏覽頁與上傳介面；不把照片清單塞入影音首頁。
- `public/photos.js`：照片資料載入、縮圖分頁、管理者登入、上傳壓縮、預覽與管理操作。
- `public/styles.css`：沿用目前深灰、墨綠與米白視覺；增加照片牆、檢視器與上傳面板樣式。
- `public/manus-routes.json`：新增 `/photos` 頁面路由。
- `apps-script/Code.gs`：增加 Photos 工作表初始化、Drive 寫入與照片 API；保留既有影音流程。

## 介面設計

主頁頂端只增加一個訪客可見的「照片」入口；管理者登入後，在同一區域增加「新增照片」按鈕。訪客進入 `/photos` 後看到「照片集」標題、照片數量與縮圖牆。管理者看到上傳面板，包含照片選擇、縮圖預覽、標題、說明與送出按鈕。

照片列表採兩欄至四欄響應式縮圖牆，手機改為兩欄。點擊縮圖開啟本站檢視器，不跳往 Google Drive。管理者在每張照片下看到修改與刪除操作，訪客看不到管理按鈕。

## 設計風格

候選風格：

1. 深色檔案室／安靜編目感（0.07）：以現有影音網站的深灰背景、墨綠狀態色與米白字體延伸，讓影音與照片像同一個內容庫。
2. 明亮相簿／卡片瀑布感（0.05）：以白底與大圖為主，較像一般活動相簿。
3. 教會公告欄／暖色紙張感（0.08）：使用米色底、細線與印刷式標籤，強調活動紀錄。

選定「深色檔案室／安靜編目感」。

### Design Movement

以數位檔案室與安靜編目介面為方向：內容優先、少裝飾、清楚標示時間與狀態，讓照片成為可快速瀏覽的活動紀錄。

### Core Principles

- 主頁影音與照片解耦，降低首頁負擔。
- 縮圖優先，點擊才載入完整照片。
- 公開觀看簡單，管理寫入必須驗證。
- 用清楚的狀態、日期與說明保存內容脈絡。

### Color Philosophy

沿用接近黑色的深灰背景降低長時間瀏覽的疲勞；墨綠表示已核准、可安心觀看；珊瑚色只用於主要動作與警示，避免照片內容被介面搶走注意力。

### Layout Paradigm

照片頁使用「編目牆」：上方是簡短工具列，下方是自適應縮圖牆；不在影音首頁插入第二套內容牆。上傳表單以側邊或彈出面板呈現，完成後回到照片牆。

### Signature Elements

- 照片左下角顯示簡短日期與狀態標籤。
- 深色縮圖框與細墨綠邊線，與影音卡片呼應。
- 檢視器使用寬幅黑色畫布，保留完整照片的視覺焦點。

### Interaction Philosophy

訪客只需點擊照片即可觀看；管理者的上傳、修改與刪除入口集中在管理動作區，不讓一般瀏覽被表單干擾。所有上傳都先顯示本機預覽與檔案大小，送出前讓管理者確認。

### Animation

只使用短暫淡入、縮圖載入淡出與檢視器開合，不使用持續動畫。圖片載入失敗時保留檔名與重新載入提示，不讓版面跳動。

### Typography System

沿用 `Noto Sans TC` 作為介面字體，`Noto Serif TC` 作為照片標題與區塊標題。照片標題最多兩行，說明文字最多三行，避免長文字使照片牆高度失控。

### Brand Essence

集集召會生活是供教會成員快速保存、尋找與回看影音和活動照片的內容庫。個性為安靜、可靠、清楚。

### Brand Voice

按鈕使用直接動詞，例如「新增照片」、「上傳照片」、「查看照片」。提示語清楚說明狀態，例如「照片已送出，正在建立縮圖」與「目前沒有已核准的照片」。

### Wordmark & Logo

沿用目前使用者提供的召會 Logo，不新增另一套照片品牌標誌；照片頁只用「集集召會生活／照片」作為文字層級。

### Signature Brand Color

沿用目前的墨綠 `var(--sage-deep)` 作為已連線、已核准和主要動作的識別色。

## 專案結構

```text
public/index.html       影音首頁，只增加照片入口與管理者新增照片入口
public/app.js           既有影音與登入邏輯，必要時提供跨頁登入資訊
public/photos.html      獨立照片頁
public/photos.js        照片 API、上傳、縮圖、檢視器與管理操作
public/styles.css       影音與照片共用視覺樣式
public/manus-routes.json 頁面路由，新增 /photos
apps-script/Code.gs     共用 GAS；維持既有 Media/Types/Admins，新增 Photos/Drive
TODO.md                 需求與進度追蹤
```

## 實作順序

先新增 `Photos` 工作表初始化與只讀 `photosList`，確認不改變既有 `list` 回應；再建立獨立 `photos.html` 與 `photos.js`，加入縮圖與分頁；接著加入管理者上傳與 Drive 寫入；最後才在影音首頁加入入口按鈕並更新路由與上傳包。每一階段都執行既有 JavaScript 語法檢查、GAS 語法檢查與首頁讀取檢查。

## 風險與處理

Google Drive 公開圖片需要檔案分享權限；若帳戶政策禁止「知道連結的任何人」，訪客無法直接讀取圖片，屆時必須改為只限登入觀看或採用圖片代理。Apps Script 的照片上傳採小檔案、單批次限制與前端壓縮，避免 6 分鐘執行時間與每日配額成為瓶頸。照片資料不併入首頁 `list`，避免既有影音流程因照片數量增加而變慢。
