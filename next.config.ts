import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds to complete despite ESLint warnings
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
