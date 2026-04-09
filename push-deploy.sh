#!/usr/bin/env bash
# =============================================================================
# 本機執行：git push → SSH 進 EC2 自動部署
# 用法：bash push-deploy.sh "commit 訊息"
# =============================================================================
set -euo pipefail

EC2_IP="54.237.62.8"
EC2_USER="ubuntu"
SSH_KEY="$HOME/Desktop/FamiWarRoom/famiwarroom-aws-key-2026.pem"
COMMIT_MSG="${1:-update}"

echo "==> [1/3] git add & commit & push"
cd "$(dirname "${BASH_SOURCE[0]}")"
/usr/local/Cellar/git/2.53.0_1/bin/git add -A
/usr/local/Cellar/git/2.53.0_1/bin/git commit -m "$COMMIT_MSG" || echo "    （沒有新變更，略過 commit）"
/usr/local/Cellar/git/2.53.0_1/bin/git push origin master


echo "==> [2/3] SSH 進 EC2 執行 deploy.sh"
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_IP" "cd ~/dry-pants-v2 && bash deploy.sh"

echo ""
echo "✅ 完成！開瀏覽器確認：http://$EC2_IP"
