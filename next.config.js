/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare compresses responses on the way out; gzip in Node only costs server time.
  compress: false,
}

module.exports = nextConfig
