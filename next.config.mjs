/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Completely disable SSR and static generation
  output: 'export',
  // Disable static optimization
  experimental: {
    disableOptimizedLoading: true,
    // Disable server components
    appDir: false,
  },
  // Skip all types of pre-rendering
  trailingSlash: true,
  // Disable image optimization
  images: {
    unoptimized: true,
    disableStaticImages: true,
  },
  // Disable server components
  serverComponents: false,
  // Disable static generation
  distDir: '.next',
  // Disable automatic static optimization
  optimizeFonts: false,
  // Disable compression
  compress: false,
  // Disable React strict mode during build
  reactStrictMode: false,
  // Disable powered by header
  poweredByHeader: false,
}

export default nextConfig
