/** @type {import('next').NextConfig} */
const nextConfig = {
  // TODO: clean up this config, lots of copy paste from stackoverflow
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [
      "i.pravatar.cc",
      "images.unsplash.com",
      "picsum.photos",
      "placedog.net",
      "placekitten.com",
      "via.placeholder.com",
      "res.cloudinary.com",
      "storage.googleapis.com",
      "s3.amazonaws.com",
      "cdn.petcarehub.com",
      "localhost",
    ],
  },
  env: {
    // BAD: hardcoding non-secret env vars here instead of .env
    NEXT_PUBLIC_APP_NAME: "PetCare Hub",
    NEXT_PUBLIC_APP_URL: "https://petcarehub.com",
    NEXT_PUBLIC_STRIPE_KEY: "pk_test_REPLACE_ME",
    NEXT_PUBLIC_GOOGLE_MAPS_KEY: "AIzaSy_REPLACE_ME",
    NEXT_PUBLIC_MIXPANEL_TOKEN: "abc123replace",
  },
  // experimental features that may break prod
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "petcarehub.com"],
    },
    optimizePackageImports: ["lodash", "recharts", "d3"],
  },
  webpack: (config, { isServer }) => {
    // Copied from GitHub issues - not sure if needed
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        stream: false,
      };
    }
    return config;
  },
  // YAGNI: headers nobody reads
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS,PATCH" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
  // YAGNI: rewrites for microservices that don't exist yet
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/api/analytics/:path*",
          destination: "http://localhost:4001/analytics/:path*",
        },
        {
          source: "/api/notifications/:path*",
          destination: "http://localhost:4002/notifications/:path*",
        },
        {
          source: "/api/payments/:path*",
          destination: "http://localhost:4003/payments/:path*",
        },
      ],
      fallback: [],
    };
  },
};

module.exports = nextConfig;
