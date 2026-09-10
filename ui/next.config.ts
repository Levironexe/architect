import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // prompt.txt was the pre-1.0 name; keep old links alive.
      { source: "/prompt.txt", destination: "/llms.txt", permanent: true },
      // /docs/skills was the pre-1.0 name for the rules reference.
      { source: "/docs/skills", destination: "/docs/rules", permanent: true },
    ];
  },
};

export default nextConfig;
