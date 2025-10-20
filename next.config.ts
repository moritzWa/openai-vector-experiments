import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['faiss-node', 'better-sqlite3'],
};

export default nextConfig;
