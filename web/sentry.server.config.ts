import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  // a light trace sample: enough to see a slow route without paying for every request
  tracesSampleRate: 0.1,
  // this app carries names, addresses and emails: collect only the stack and the route
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
});
