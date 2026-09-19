import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: {
    // Default 1MB is too small for tradebook uploads — the upload action
    // itself already enforces a 10MB file-size limit (src/server/actions/imports.ts);
    // this just needs to be at least that plus multipart/form-data overhead.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
