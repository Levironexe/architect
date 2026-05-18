/** @type {import('next').NextConfig} */
const nextConfig = {
  // BAD: strict mode disabled
  reactStrictMode: false,

  // BAD: TypeScript errors ignored in production build
  typescript: {
    ignoreBuildErrors: true,
  },

  // BAD: ESLint ignored in production build
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    // BAD: allow all domains — security risk
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    // BAD: unoptimized images
    unoptimized: true,
  },

  // BAD: all these headers are needed but applied globally
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // BAD: permissive CSP
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },

  // BAD: rewrites pointing to separate Express server
  // (the two backends are running simultaneously)
  async rewrites() {
    return [
      {
        source: "/api/server/:path*",
        destination: `${process.env.API_SERVER_URL || "http://localhost:3001"}/api/:path*`,
      },
    ];
  },

  // YAGNI: experimental features enabled with no plan to use them
  experimental: {
    optimizeCss: false,
    // typedRoutes: true, // commented out — causes issues
  },
};

module.exports = nextConfig;
