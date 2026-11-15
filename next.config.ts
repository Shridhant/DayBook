import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders({ dev: process.env.NODE_ENV === "development" }) }];
  },
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
