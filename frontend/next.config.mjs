/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",              // 靜態匯出 → 可丟 S3/任何靜態主機
  images: { unoptimized: true }, // 靜態匯出不支援 Next 圖片最佳化伺服器
  trailingSlash: true,           // S3 靜態網站對應目錄式路由（/encounter/ → encounter/index.html）
};

export default nextConfig;