// GitHub Pages(프로젝트 사이트)는 /<repo> 하위 경로로 서빙되므로 basePath가 필요하다.
// 로컬 dev에서는 비워 두고, CI 빌드에서만 NEXT_PUBLIC_BASE_PATH를 주입한다.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // 정적 export (GitHub Pages 배포용)
  images: { unoptimized: true }, // 정적 호스팅은 이미지 최적화 서버가 없음
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  transpilePackages: ["@ai-benchmark/core", "@ai-benchmark/db"],
  webpack(config, { isServer, webpack }) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    if (!isServer) {
      config.resolve.fallback = { ...(config.resolve.fallback ?? {}), fs: false };
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
    }
    return config;
  },
};
export default nextConfig;
