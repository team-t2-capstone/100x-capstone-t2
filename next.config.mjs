/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable static optimization
  experimental: {
    disableOptimizedLoading: true,
  },
  // Skip middleware URL normalization (moved from experimental)
  skipMiddlewareUrlNormalize: true,
  // Skip trailing slash redirect (moved from experimental)
  skipTrailingSlashRedirect: true,
  // Skip all types of pre-rendering
  trailingSlash: true,
  // Disable image optimization
  images: {
    unoptimized: true,
  },
  // Disable static generation
  distDir: '.next',
  // Disable compression
  compress: false,
  // Disable React strict mode during build
  reactStrictMode: false,
  // Disable powered by header
  poweredByHeader: false,
  // Disable prerendering
  generateEtags: false,
}

export default nextConfig
