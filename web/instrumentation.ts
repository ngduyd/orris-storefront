/**
 * Server and edge error reporting. Inert unless SENTRY_DSN is set, so local runs and CI need nothing.
 *
 * No personal data leaves: sendDefaultPii is off, and request bodies are not attached. What arrives
 * is the stack, the route, and the release.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// a server action or route that throws outside its own handler still reaches Sentry
export const onRequestError = Sentry.captureRequestError;
