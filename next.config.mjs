/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
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
