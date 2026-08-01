/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  distDir: process.env.ORION_NEXT_DIST_DIR || ".next",
};

export default nextConfig;
