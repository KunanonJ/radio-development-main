import type { NextConfig } from "next";

const stationMode = process.env.NEXT_PUBLIC_STATION_MODE === "true";

const nextConfig: NextConfig = {
  ...(stationMode
    ? { distDir: ".next-station", output: "export" as const, trailingSlash: true }
    : {}),
  images: {
    ...(stationMode ? { unoptimized: true } : {}),
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
