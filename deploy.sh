#!/usr/bin/env bash
# =============================================================================
# 部署腳本：git pull → 重新 build → 滾動重啟
# 在 EC2 上執行：bash deploy.sh
# =============================================================================
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_ROOT"

echo "==> [1/4] git pull"
git pull origin master

echo "==> [2/4] build images（有快取，通常很快）"
docker compose build

echo "==> [3/4] 滾動重啟服務（零停機：先起新容器，再移除舊的）"
docker compose up -d --remove-orphans

echo "==> [4/4] 清理 dangling images"
docker image prune -f

echo ""
echo "✅ 部署完成！"
docker compose ps
