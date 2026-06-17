# dry-pants 部署指南：Fly.io（後端）+ Vercel（前端）
> 目標：脫離 EC2，月費趨近 0、全程 HTTPS。建立：2026-06-15

整體：**後端 FastAPI+SQLite → Fly.io**（含持久 volume）、**前端 Next 14 → Vercel**。
備份 DB 在 `~/Desktop/ec2-backup-2026-06-15/dry_pants.db`。

---

## A. 後端 → Fly.io

### 前置（一次性）
```bash
brew install flyctl          # 安裝 flyctl
fly auth login               # 瀏覽器登入/註冊（需綁卡，但低用量趨近 0）
```

### 部署（在 backend/ 目錄，已備好 fly.toml）
```bash
cd ~/Desktop/dry-pants-v2/backend
fly apps create dry-pants-api                                   # 建立 app（名稱需全域唯一，被佔用就換名並同步改 fly.toml 的 app=）
fly volumes create dry_pants_data --region iad --size 1         # 建 1GB volume 放 SQLite
fly deploy                                                      # 用 Dockerfile build + 部署
```

### 還原備份資料（把 EC2 的 DB 灌進 volume）
```bash
fly machine start                                              # 確保機器醒著（scale-to-zero 可能已停）
fly ssh sftp put ~/Desktop/ec2-backup-2026-06-15/dry_pants.db /data/dry_pants.db
fly apps restart dry-pants-api                                 # 重啟讓後端讀新 DB
```

### 驗證
```bash
curl https://dry-pants-api.fly.dev/api/health                 # 應回 200/健康狀態
curl https://dry-pants-api.fly.dev/api/error-reasons          # 應看到資料
```

---

## B. 前端 → GitHub Pages（靜態網站）

> 演進：原本丟 AWS S3，但 AWS 6 個月免費方案到期（資源會停），故改放 GitHub Pages
>（免費、HTTPS、不綁 AWS）。Vercel 全新帳號被逼 Pro、Netlify OAuth 失敗，皆放棄。

- **正式網址（固定）：`https://lorie0779-stack.github.io/dry-pants-v2/`**
- 前端設 `output:"export"`（靜態匯出）；GitHub Pages 專案頁是子路徑，故 build 時帶
  `PAGES_BASE_PATH=/dry-pants-v2`（見 `frontend/next.config.mjs`）。
- 部署方式：把 `out/` 推到 repo 的 `gh-pages` 分支；Settings→Pages 設 source = gh-pages /root。
- **repo 必須維持 public**（免費方案 Pages 限公開 repo）。Ryder 資料 JSON 不可進此 repo。

### 日後更新前端（一鍵腳本）
```bash
~/Desktop/dry-pants-v2/deploy-frontend.sh
```
（內容：build → push gh-pages，見該檔。手動等價見「附錄」。）

### 日後更新後端
```bash
cd ~/Desktop/dry-pants-v2/backend && fly deploy
```

---

## C. 端到端驗證
- 開 `https://lorie0779-stack.github.io/dry-pants-v2/` → 頁面正常、能讀寫紀錄
  （首次開有 Fly 冷啟動約 3–5 秒，正常）
- DevTools → Network，確認 API 打的是 `https://dry-pants-api.fly.dev/api/...` 且 200

---

## D. 注意事項 / 已知坑
- **冷啟動**：Fly scale-to-zero，閒置後第一個請求約慢數秒喚醒（家庭用可接受，換取趨近 0 成本）。
- **HTTPS**：S3 靜態網站端點僅 HTTP（與原 EC2 相同）。頁面用 http、API 用 https 相容無誤。
  要整站 HTTPS 再前置 CloudFront 或 Cloudflare（後話）。
- **CORS**：後端是 `allow_origins=["*"]`，前端沒帶 credentials → 跨來源 OK。若日後改帶 cookie，
  wildcard + credentials 會被瀏覽器擋，需把 origin 改成明確的前端網址。
- **DB 路徑**：靠 `fly.toml` 的 `SQLALCHEMY_DATABASE_URL=sqlite:////data/dry_pants.db` + volume 掛 `/data`。
  Dockerfile 內 `COPY . .` 帶進的舊 db 不會被用到（被 env 指向的 volume 蓋過）。

---

## E. 切換完成後（Phase 4）
dry-pants 在新網址穩定數天後，才在 EC2 上 `docker compose down` 移除 dry-pants 三個容器
（FamiWarRoom 處理完後再整台 EC2 退役）。備份網：snapshot `snap-0c0a221bedbb50cce` + 本機 DB 副本。
