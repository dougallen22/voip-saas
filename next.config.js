/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Redirect all non-production Vercel deployments to production
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: '(?!voip-saas\\.vercel\\.app$).*voip-saas.*\\.vercel\\.app',
          },
        ],
        destination: 'https://voip-saas.vercel.app/:path*',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
