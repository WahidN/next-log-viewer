/** @type {import('next').NextConfig} */
const nextConfig = {
  // next-log-viewer is a locally linked package; transpilePackages ensures Next
  // processes its "use client" boundary and ESM correctly.
  transpilePackages: ['next-log-viewer'],
}

export default nextConfig
