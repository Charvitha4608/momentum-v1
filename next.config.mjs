/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // The help assistant reads lib/help/app-knowledge.md at runtime; make sure the
  // file is bundled into the serverless function in production.
  outputFileTracingIncludes: {
    "/help": ["./lib/help/**"],
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

