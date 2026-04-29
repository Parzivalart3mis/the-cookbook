import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Notion internal file uploads (S3)
      { protocol: 'https', hostname: 'prod-files-secure.s3.us-west-2.amazonaws.com' },
      // Notion external image blocks (any https source)
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
