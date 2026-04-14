import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@flowbot/flow-shared'],
};

export default nextConfig;
