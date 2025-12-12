import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark server-only packages as external
  // This ensures they're only used in server-side code (API routes)
  serverExternalPackages: ['pdf-parse', 'docx'],
};

export default nextConfig;
