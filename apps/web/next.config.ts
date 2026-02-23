import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@llm-boost/shared", "@react-pdf/renderer"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL || "https://api.llmrank.app";
    return [
      {
        source: "/dashboard/settings",
        destination: `${apiBase}/app/settings`,
        permanent: false,
      },
      {
        source: "/dashboard/team",
        destination: `${apiBase}/app/team`,
        permanent: false,
      },
      {
        source: "/dashboard/admin",
        destination: `${apiBase}/app/admin`,
        permanent: false,
      },
      {
        source: "/dashboard/projects/:id",
        destination: `${apiBase}/app/projects/:id`,
        permanent: false,
      },
      {
        source: "/dashboard/crawl/:id",
        destination: `${apiBase}/app/crawl/:id`,
        permanent: false,
      },
      { source: "/dashboard", destination: `${apiBase}/app`, permanent: false },
    ];
  },
};

export default nextConfig;
