/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client'],
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
