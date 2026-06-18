/** @type {import('next').NextConfig} */
// GitHub Pages 專案頁是子路徑（/dry-pants-v2/），build 時設 PAGES_BASE_PATH=/dry-pants-v2；
// 不設時（S3 / 根路徑）維持原樣。
const basePath = process.env.PAGES_BASE_PATH || "";
const nextConfig = {
  output: "export",              // 靜態匯出 → 可丟 GitHub Pages/S3/任何靜態主機
  images: { unoptimized: true }, // 靜態匯出不支援 Next 圖片最佳化伺服器
  trailingSlash: true,           // 目錄式路由（/encounter/ → encounter/index.html）
  // 部署 build 用獨立 distDir（deploy-frontend.sh 設 NEXT_BUILD_DIR=.next-deploy），
  // 避免覆蓋 dev server 正在使用的 .next 而造成 chunk 失蹤（Cannot find module）。
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;