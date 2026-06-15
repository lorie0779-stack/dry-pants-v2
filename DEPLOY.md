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

## B. 前端 → AWS S3（靜態網站）

> 原計畫用 Vercel，但全新 Vercel 帳號被強制走 Pro 付費團隊、Netlify OAuth 又出錯，
> 故改用「Next 靜態匯出 + S3」——零第三方登入、用既有 AWS 憑證、成本趨近 0。

前端已設 `output: "export"`（見 `frontend/next.config.mjs`），可純靜態託管。

實際使用的 bucket / 網址：
- Bucket：`dry-pants-ryder-app`（us-east-1，已設 public-read + 靜態網站）
- 網址：`http://dry-pants-ryder-app.s3-website-us-east-1.amazonaws.com`

### 首次建置（已完成，記錄備查）
```bash
BK=dry-pants-ryder-app; REGION=us-east-1
aws s3api create-bucket --bucket "$BK" --region "$REGION"
aws s3api put-public-access-block --bucket "$BK" --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
aws s3api put-bucket-policy --bucket "$BK" --policy \
  '{"Version":"2012-10-17","Statement":[{"Sid":"PublicRead","Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::dry-pants-ryder-app/*"}]}'
aws s3 website "s3://$BK/" --index-document index.html --error-document 404.html
```

### 日後更新前端（改 code 後重跑這三行）
```bash
cd ~/Desktop/dry-pants-v2/frontend
NEXT_PUBLIC_API_URL=https://dry-pants-api.fly.dev npx next build
aws s3 sync out/ s3://dry-pants-ryder-app/ --delete
```

### 日後更新後端
```bash
cd ~/Desktop/dry-pants-v2/backend && fly deploy
```

---

## C. 端到端驗證
- 開 `http://dry-pants-ryder-app.s3-website-us-east-1.amazonaws.com` → 頁面正常、能讀寫紀錄
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
