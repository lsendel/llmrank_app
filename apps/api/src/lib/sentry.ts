export { withSentry } from "@sentry/cloudflare";
import { captureException, withScope } from "@sentry/cloudflare";

/** No-op — Sentry inits via withSentry wrapper in the export. */
export function initSentry(_env: unknown) {}

export function captureError(
  error: Error,
  context?: Record<string, string>,
): void {
  withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setTag(key, value);
      }
    }
    captureException(error);
  });
}
