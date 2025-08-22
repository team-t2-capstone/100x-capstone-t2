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
}

export default nextConfig
