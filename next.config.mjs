/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client'],
  // Disable the Next.js development indicator (the "N" logo in bottom left)
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: '/preview/:workspaceId/:path*',
        destination: '/api/preview/:workspaceId/:path*',
      },
    ];
  },
};

export default nextConfig;
