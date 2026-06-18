# Ryder 乾爽大冒險 V2 — CLAUDE.md

## 專案目的
Ryder（5歲）如廁訓練遊戲化 App。以寶可夢搜集 + 扭蛋機制強化正向回饋，
並記錄失誤資料供家長分析規律。

## 架構總覽
```
dry-pants-v2/
├── frontend/          # Next.js + TypeScript + Tailwind
│   ├── app/           # Next.js App Router entry
│   ├── components/    # DryPantsApp.tsx（主元件）
│   └── lib/api.ts     # API client（所有 fetch 集中於此）
├── backend/           # FastAPI + SQLAlchemy + SQLite
│   ├── main.py        # 路由定義
│   ├── models.py      # ORM 模型
│   ├── schemas.py     # Pydantic schemas
│   └── database.py    # DB 連線設定
├── docker-compose.yml # backend + frontend + nginx
├── nginx.conf         # 反向代理設定
└── infra/ec2-setup.sh # EC2 部署初始化腳本
```

## 技術棧
| 層 | 技術 |
|---|---|
| 前端 | Next.js、TypeScript、Tailwind CSS、Recharts |
| 後端 | FastAPI、SQLAlchemy（sync）、Pydantic v2、SQLite |
| 基礎設施 | Docker Compose、Nginx、AWS EC2 |

## 本機開發
```bash
# 後端
cd backend && uvicorn main:app --reload   # :8000

# 前端
cd frontend && npm run dev                # :3000
```

前端吃 `frontend/.env.local` 的 `NEXT_PUBLIC_API_URL`，本機預設 `http://localhost:8000`。

## 部署（Fly.io + GitHub Pages，已脫離 AWS/EC2）
```bash
# 1. 推原始碼（不觸發部署，僅同步 GitHub + 跑 CI）
git push origin master
# 2. 後端上 Fly.io（app=dry-pants-api）
cd backend && fly deploy
# 3. 前端 build + 推 gh-pages（用獨立 distDir，不擾 dev server）
bash deploy-frontend.sh
```
後端改了邏輯時前後端都要重部署。線上：
前端 https://lorie0779-stack.github.io/dry-pants-v2/ 、後端 https://dry-pants-api.fly.dev/

## API 端點（backend/main.py）
| Method | Path | 說明 |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/errors` | 新增失誤紀錄 |
| GET | `/api/errors` | 列出所有失誤 |
| GET | `/api/error-reasons` | 失誤原因清單 |
| GET/PUT | `/api/collection-state` | 讀取／儲存搜集狀態 |
| POST | `/api/collection-state/reset` | 重置所有進度 |
| GET/POST | `/api/honor-entries` | 榮譽榜讀寫 |

## 資料庫模型（backend/models.py）
- **CollectionState**：singleton（id=1）— energy / unlocked_count / coins / slot_order
- **ErrorRecord**：失誤紀錄（type: 💩/💧、location、time_of_day、incident_date、reason_id）
- **ErrorReason**：正規化原因文字（Get or Create，reason_text UNIQUE）
- **HonorEntry**：兌換榮譽榜

## 關鍵常數
```python
FULL_POOL_SIZE = 94   # 傳說＋幻獸寶可夢總池（Gen 1–9）
ROUND_SIZE = 30       # 每輪隨機抽取的格數
```
`slot_order` 為每輪開始時隨機抽取的 30 個索引，reset 時重新洗牌。

## DB Migration 規則
新增欄位**不可只改 ORM**，必須在 `main.py` 的 `init_db()` 加 `ALTER TABLE` try/except block，
避免已存在欄位報錯（現有 `incident_date`、`slot_order` 均以此方式上線）。

## 前端 API 規則
所有 API 呼叫集中在 `frontend/lib/api.ts`，元件不直接 `fetch`。
新增端點時先在 `api.ts` 定義 DTO + function，再由元件 import 使用。

## 操作權限規則

### 自動執行（不需要詢問）
- 讀取任何檔案
- 寫入/修改程式碼檔案
- 安裝 npm/pip 套件
- 執行 dev server、build、測試
- 建立新檔案或資料夾

### 必須暫停等我同意才能執行
- 任何包含 rm 的指令
- git commit
- git push
- 修改 .env 檔案
- 任何可能影響生產環境的操作

## 工作模式
- 放手執行，不需要每步驟詢問確認
- 完成一個階段後給我摘要就好
- 不需要逐行解釋每個改動
- 請用繁體中文回覆

## 語言設定
請一律使用繁體中文回覆。
