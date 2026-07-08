/** @type {import('next').NextConfig} */
const nextConfig = {
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
