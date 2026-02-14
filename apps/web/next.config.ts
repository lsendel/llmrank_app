import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@llm-boost/shared", "@react-pdf/renderer"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
