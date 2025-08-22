/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Disable SSR and static generation for build process
  output: 'export',
  // Disable static optimization
  experimental: {
    // Disable static optimization
    disableOptimizedLoading: true,
  },
}

export default nextConfig
