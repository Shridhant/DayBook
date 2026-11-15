import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Only our own image folders may go through the optimizer (no arbitrary URLs, no query strings).
    localPatterns: [
      { pathname: "/uploads/**", search: "" },
      { pathname: "/placeholders/**", search: "" },
    ],
  },
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
