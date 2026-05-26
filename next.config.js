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
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      // Sanity Studio + Next dev/HMR + Three.js shaders need 'unsafe-eval' in dev only
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"} https://js.stripe.com https://cdn.sanity.io`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://cdn.sanity.io https://images.unsplash.com https://*.stripe.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api.openai.com https://api.anthropic.com https://api.stripe.com https://*.sanity.io https://*.ingest.sentry.io wss: https:",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
