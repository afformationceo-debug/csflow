import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Debug in development
  debug: false,

  // Environment
  environment: process.env.NODE_ENV,

  // Custom tags
  initialScope: {
    tags: {
      app: "cs-automation",
      component: "edge",
    },
  },
});
