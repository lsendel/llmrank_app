# Architecture Improvement Target

## Canonical UI

- `apps/web` is the primary user-facing application.
- `apps/api/src/routes/app.tsx` and `apps/api/src/routes/marketing.tsx` are legacy transition surfaces and should not receive new feature work.

## Authorization

- Admin access must be enforced through shared middleware and explicit role data.
- Hardcoded email or plan-based admin fallbacks are not allowed.

## Marketing Delivery

- Production marketing pages must not depend on browser-side Tailwind CDN compilation.
- Prefer prebuilt assets in `apps/web`; if a worker route remains, it should serve bundled local assets.

## Route Structure

- Route bootstrap files should register routers, not contain product logic.
- Prefer route modules grouped by bounded context: settings, team, projects, admin, marketing, scheduled.

## File Size Guardrails

- Warn above 800 lines for app logic files.
- Fail above 1200 lines for app logic files.
