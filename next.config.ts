import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow the sandbox preview host + localhost to load dev assets.
  allowedDevOrigins: ["*.e2b.app", "*.e2b.dev", "localhost:3000", "127.0.0.1:3000"],
  // Native / heavy server modules must stay outside the bundler.
  serverExternalPackages: ["better-sqlite3", "sharp", "pg"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "**.ytimg.com" },
      { protocol: "https", hostname: "**.kick.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },
};

export default nextConfig;
