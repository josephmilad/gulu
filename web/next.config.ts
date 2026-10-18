import type { NextConfig } from "next";

const isExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isExport
    ? {
        output: "export",
        trailingSlash: true,
        basePath: process.env.BASE_PATH || "",
        images: { unoptimized: true },
      }
    : {
        cacheComponents: true,
        partialPrefetching: true,
        images: {
          remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
          formats: ["image/avif", "image/webp"],
        },
      }),
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
