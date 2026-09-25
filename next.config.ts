import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.8"],
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    // Failed navigations and Server Actions (e.g. the logger's autosave) wait while offline and
    // retry once the connection returns, instead of throwing. See docs/milestones.md (M5).
    useOffline: true,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;