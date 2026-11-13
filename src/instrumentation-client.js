// The SDK loads in its own chunk after the page, so it doesn't add to the first-load JS.
// Without a DSN (local dev), Sentry stays off.
import('@sentry/nextjs').then((Sentry) => {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
});
