import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker için yalın, kendi kendine yeten sunucu çıktısı (.next/standalone).
  output: "standalone",
};

export default nextConfig;
