#!/usr/bin/env bash
# dry-pants 前端一鍵部署到 GitHub Pages（build → 推 gh-pages 分支）
set -euo pipefail
cd "$(dirname "$0")/frontend"
echo "▶ build（含 basePath + Fly 後端，獨立 distDir 不擾 dev）…"
env -u NODE_OPTIONS PAGES_BASE_PATH=/dry-pants-v2 \
  NEXT_BUILD_DIR=.next-deploy \
  NEXT_PUBLIC_API_URL=https://dry-pants-api.fly.dev npx next build
touch out/.nojekyll
echo "▶ 推 gh-pages…"
cd out
rm -rf .git
git init -q && git checkout -q -b gh-pages
git add -f -A
git -c user.email="lorie0779@gmail.com" -c user.name="lorie" commit -q -m "deploy $(date +%F_%T)"
git remote add origin https://github.com/lorie0779-stack/dry-pants-v2.git
git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 push -f -q origin gh-pages
echo "✓ 完成 → https://lorie0779-stack.github.io/dry-pants-v2/"
