import * as Sentry from "@sentry/nextjs";

// Browser errors only. No replay, no performance sampling, no default PII.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0,
  // this app carries names, addresses and emails: collect only the stack and the route
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
