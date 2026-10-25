/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare compresses responses on the way out; gzip in Node only costs server time.
  compress: false,
  // other names people try for the schedule assistant
  async redirects() {
    return ['scheduler', 'scheduling'].map((name) => ({
      source: `/${name}/:path*`,
      destination: '/schedule/:path*',
      permanent: true,
    }));
  },
}

module.exports = nextConfig
