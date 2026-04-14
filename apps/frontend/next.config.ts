import type { NextConfig } from "next";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:3000';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@flowbot/flow-shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
