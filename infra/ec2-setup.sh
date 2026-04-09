#!/usr/bin/env bash
# =============================================================================
# EC2 一次性初始化腳本（Ubuntu 22.04 / Amazon Linux 2023）
# 用法：ssh ec2 之後，執行 bash ec2-setup.sh
# =============================================================================
set -euo pipefail

echo "==> [1/5] 更新套件"
sudo apt-get update -y && sudo apt-get upgrade -y

echo "==> [2/5] 安裝 Docker"
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 讓當前 user 不用 sudo 就能執行 docker
sudo usermod -aG docker "$USER"
newgrp docker

echo "==> [3/5] 安裝 Git"
sudo apt-get install -y git

echo "==> [4/5] clone 專案"
read -rp "請輸入 GitHub repo URL（例如 https://github.com/yourname/dry-pants-v2.git）: " REPO_URL
git clone "$REPO_URL" ~/dry-pants-v2

echo "==> [5/5] 設定 .env（填入 EC2 Public IP）"
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "EC2_PUBLIC_IP=${EC2_IP}" > ~/dry-pants-v2/.env
echo ""
echo "✅ 初始化完成！你的 EC2 Public IP 是：${EC2_IP}"
echo ""
echo "下一步："
echo "  cd ~/dry-pants-v2"
echo "  docker compose up -d --build"
echo "  開瀏覽器到 http://${EC2_IP}"
