# Ryder 的乾爽大冒險（Dry-Pants Adventure）V2

全端架構：**FastAPI + SQLite** 後端、**Next.js（App Router）+ Tailwind CSS** 前端。

## 目錄結構

- `backend/`：FastAPI 應用、`dry_pants.db`（SQLite，啟動時自動建立）
- `frontend/`：Next.js 前端

## 環境需求

- **Python 3.10+**（建議 3.11 或 3.12；若使用 3.14，請確認磁碟空間足夠以便安裝依賴）
- **Node.js 18+** 與 npm

若安裝依賴或 `npm run build` 出現 **No space left on device**，請先清理磁碟空間後再重試。

## 後端：安裝與啟動

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API 文件：<http://localhost:8000/docs>
- 健康檢查：`GET /api/health`
- SQLite 檔案會建立在 `backend/dry_pants.db`

### 後端重點 API

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/error-reasons` | 失誤原因清單（含種子資料） |
| `GET` | `/api/errors` | 失誤紀錄列表 |
| `POST` | `/api/errors` | 新增失誤；`reason` 為字串時會與 `ErrorReason` 比對，沒有則自動建立 |

## 前端：安裝與啟動

另開一個終端機：

```bash
cd frontend
npm install
cp .env.local.example .env.local   # 可選；預設後端為 http://localhost:8000
npm run dev
```

瀏覽器開啟：<http://localhost:3001>（`npm run dev` 已固定使用 port 3001，避免與 3000 衝突）

## 同時啟動前後端

1. 終端機 A：`cd backend` → 啟動 `uvicorn`（見上）
2. 終端機 B：`cd frontend` → `npm run dev`

前端會向 `NEXT_PUBLIC_API_URL`（預設 `http://localhost:8000`）呼叫 API；後端已啟用 **CORS**（允許所有來源），方便本機與之後部署。

## 分析模式：自訂失誤原因

在「分析模式」選擇「➕ 其他（手動輸入）」並輸入文字後送出，前端會將該字串作為 `reason` 傳給 `POST /api/errors`，後端執行 **Get or Create** 寫入 `ErrorReason` 與 `ErrorRecord`。
