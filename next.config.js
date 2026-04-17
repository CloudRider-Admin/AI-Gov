/** @type {import('next').NextConfig} */
const path = require("path");

const reactDir = path.resolve(__dirname, "node_modules/react");
const reactDomDir = path.resolve(__dirname, "node_modules/react-dom");

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    workerThreads: false,
  },
  webpack(config, { dev, isServer }) {
    // Sanity uses `useEffectEvent` which only exists in stable react@19.
    // In production, Next.js aliases `react` to its own compiled canary that
    // lacks this export — but only in the CLIENT bundle where Sanity runs.
    // Applying the alias server-side breaks SSR (React becomes null).
    if (!dev && !isServer) {
      config.resolve.alias["react"] = reactDir;
      config.resolve.alias["react-dom"] = reactDomDir;
      config.resolve.alias["next/dist/compiled/react"] = reactDir;
      config.resolve.alias["next/dist/compiled/react-dom"] = reactDomDir;
    }
    return config;
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      },
    ],
  },
};

module.exports = nextConfig;
