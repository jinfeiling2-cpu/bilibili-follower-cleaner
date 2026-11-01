import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 浏览器通过 127.0.0.1 打开时，开发服务器默认会拦住客户端脚本和热更新。
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
