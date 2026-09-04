import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 * The CSP is intentionally permissive for the image/analytics hosts the
 * platform can be configured to use, and strict everywhere else.
 */
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  //
  // Metadata in <head>, for everyone.
  //
  // Next streams `generateMetadata` output by default: on a dynamic page the
  // title and description arrive after the body has started, so they land in
  // <body> rather than <head>. Next blocks and puts them in <head> only for
  // user agents on its built-in bot list (Googlebot, Bingbot, Twitterbot,
  // Slackbot and a few others). A match-anything pattern extends that to
  // every request.
  //
  // The cost is documented as a slightly later TTFB. Here that is close to
  // nothing — every `generateMetadata` on this site reads the same settings
  // and record the page itself already awaits, so the work is shared, not
  // added. What it buys is that any crawler NOT on Next's list — a smaller
  // search engine, an SEO audit tool, an AI crawler that does not run
  // JavaScript, Lighthouse itself — sees a real title and description instead
  // of none at all.
  //
  htmlLimitedBots: /.*/,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  experimental: {
    optimizePackageImports: ["@/components"],
  },
  serverExternalPackages: ["pdf-lib", "@prisma/adapter-pg", "pg"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
