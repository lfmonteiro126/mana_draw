import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cards.scryfall.io" },
      { protocol: "https", hostname: "images.pokemontcg.io" },
      { protocol: "https", hostname: "images.ygoprodeck.com" },
      { protocol: "https", hostname: "product-images.tcgplayer.com" }
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          }
        ]
      },
      {
        source: "/buylist/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }]
      }
    ];
  }
};

export default nextConfig;
