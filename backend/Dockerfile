# 使用官方 Python 3.12 輕量版，檔案小、部署快，省下我們寶貴的頻寬
FROM python:3.12-slim

# 設定工作目錄，就像是我們在 Server 裡劃一塊專屬空間
WORKDIR /app

# 1. 先複製 requirements.txt
COPY requirements.txt .

# 2. 安裝套件（這步會被 Docker 快取，下次改 Code 不用重裝，超快！）
RUN pip install --no-cache-dir -r requirements.txt

# 3. 複製所有後端程式碼進去
COPY . .

# 4. 啟動 FastAPI，使用 --reload 模式讓你邊改 Code 網頁邊更新
# 注意：正式部署到 EC2 時要把 --reload 拿掉
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]