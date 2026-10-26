import * as Sentry from '@sentry/nextjs';

// Runs once per server runtime (Node for pages and API routes, edge for middleware).
export function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

export const onRequestError = Sentry.captureRequestError;
