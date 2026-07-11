#!/usr/bin/env bash
# dry-pants 前端一鍵部署到 GitHub Pages（build → 推 gh-pages 分支）
set -euo pipefail
cd "$(dirname "$0")/frontend"

# ⚠️ output:"export" + 自訂 distDir(NEXT_BUILD_DIR) 時，靜態產物匯出到「distDir 根目錄」
#    （不是 out/）。這裡固定用 .next-deploy，之後也從 .next-deploy 推，兩邊必須一致，
#    否則會推到陳年舊 out/（曾導致線上前端打 localhost:8000 的災情）。
DIST=.next-deploy

echo "▶ build（含 basePath + Fly 後端，獨立 distDir 不擾 dev）…"
env -u NODE_OPTIONS PAGES_BASE_PATH=/dry-pants-v2 \
  NEXT_BUILD_DIR="$DIST" \
  NEXT_PUBLIC_API_URL=https://dry-pants-api.fly.dev npx next build

# 防呆：確認匯出產物存在，且 Fly 後端網址真的被烤進 bundle（沒烤進去就中止，不推壞版）。
[ -f "$DIST/index.html" ] || { echo "✗ 找不到 $DIST/index.html，build 匯出位置有變，中止。"; exit 1; }
if ! grep -rq "dry-pants-api.fly.dev" "$DIST/_next/static/chunks/"; then
  echo "✗ bundle 內找不到 dry-pants-api.fly.dev（API 網址沒烤進去），中止部署。"; exit 1
fi

touch "$DIST/.nojekyll"
echo "▶ 推 gh-pages…"
cd "$DIST"
rm -rf .git
git init -q && git checkout -q -b gh-pages
git add -f -A
git -c user.email="lorie0779@gmail.com" -c user.name="lorie" commit -q -m "deploy $(date +%F_%T)"
git remote add origin https://github.com/lorie0779-stack/dry-pants-v2.git
git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 push -f -q origin gh-pages
echo "✓ 完成 → https://lorie0779-stack.github.io/dry-pants-v2/"
