const { withSentryConfig } = require('@sentry/nextjs/config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare compresses responses on the way out; gzip in Node only costs server time.
  compress: false,
}

module.exports = withSentryConfig(nextConfig, {
  org: 'sentry',
  project: 'boilerclasses',
  sentryUrl: 'https://sentry.boilerexams.com',
  silent: true,
  telemetry: false,
  // drop SDK code this site never runs from the browser bundle
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
})
