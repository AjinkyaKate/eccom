import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(process.cwd(), '..'),
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
