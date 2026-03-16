import type { NextConfig } from "next";
import crypto from "crypto";

// ビルドごとにユニークなIDを生成（デプロイ検知用）
const buildId = crypto.randomBytes(8).toString("hex");

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  headers: async () => [
    {
      // HTMLページのキャッシュを防止（JS/CSSなどの静的アセットは影響しない）
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
