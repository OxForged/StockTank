import type { NextConfig } from "next";

// NEXT_PUBLIC_API_URL must be the backend origin (e.g. https://backend.up.railway.app).
// Falls back to localhost for local dev only.
const rawBackendUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
const BACKEND_URL = rawBackendUrl || "http://localhost:8000";

if (rawBackendUrl?.includes("/api")) {
  throw new Error(
    "NEXT_PUBLIC_API_URL must be the backend origin without /api path, e.g. https://backend.up.railway.app",
  );
}

const nextConfig: NextConfig = {
  // Allow LAN access for mobile testing — update IP to match your network
  allowedDevOrigins: ["192.168.68.54"],
  experimental: {
    viewTransition: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
