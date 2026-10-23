/** @type {import('next').NextConfig} */
const basePath = process.env.FINCITY_BASE_PATH || '';
const nextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  reactStrictMode: false,
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};
export default nextConfig;
