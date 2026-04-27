import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "1";
const nextConfig = {
  reactStrictMode: true,
  output: process.env.NEXT_STATIC_EXPORT === "1" ? "export" : "standalone",
  outputFileTracingRoot: projectRoot,
  experimental: {
    webpackBuildWorker: false,
    // workerThreads caused DataCloneError during "Generating static pages" on Next 15.5
    workerThreads: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: isStaticExport ? { unoptimized: true } : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
