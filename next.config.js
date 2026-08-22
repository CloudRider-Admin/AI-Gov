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
  async headers() {
    // Content-Security-Policy is intentionally permissive on script/style:
    //   - 'unsafe-inline' + 'unsafe-eval' are required by the embedded Sanity
    //     Studio (/studio) and Next.js's runtime.
    //   - blob: workers/children are required by three.js (the 3D globe).
    //   - styled-components emits inline <style> tags.
    // Tighten with nonces once Studio and the globe are verified against a
    // stricter policy.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://cdn.sanity.io",
      "font-src 'self' data:",
      "connect-src 'self' https://*.sanity.io wss://*.sanity.io https://*.api.sanity.io",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
