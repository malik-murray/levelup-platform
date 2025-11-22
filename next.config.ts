import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark pdf-parse as a server-only external package
  // This ensures it's only used in server-side code (API routes)
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
