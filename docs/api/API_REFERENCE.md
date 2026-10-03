# API reference

Syllabus Sync's current API consists of Next.js App Router handlers in [`app/api/`](../../app/api/). The production base URL is `https://www.syllabus-sync.app/api`; local development normally uses `http://localhost:3000/api`. This document describes the route families and security model visible in the source. It is not a versioned public API contract; check the handler and its tests for exact methods, fields, and response codes before integrating.

## Route families

| Prefix or route                                                                            | Purpose                                                         | Access model                                                                |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `/api/auth/*`, `/api/webauthn/*`                                                           | Sign-in, verification, session, MFA, passkey and password flows | Mixed public and authenticated endpoints; inspect each handler              |
| `/api/units`, `/api/deadlines`, `/api/events`, `/api/todos` and `/:id` routes              | Academic planning data                                          | Authenticated user; user-scoped queries and RLS                             |
| `/api/profiles`, `/api/user-preferences`, `/api/notifications/*`, `/api/push/subscription` | Profile and experience data                                     | Authenticated user; some operations use reviewed service-role access        |
| `/api/gamification/*`, `/api/audit`, `/api/sync`                                           | Progress, audit and offline synchronization                     | Route-specific authentication and validation                                |
| `/api/maps/*`, `/api/navigate`, `/api/weather`                                             | Campus and external data integrations                           | Route-specific access, origin and rate-limit checks                         |
| `/api/security/*`                                                                          | Password breach checks, header scan and maintenance             | Route-specific authentication or privileged secret                          |
| `/api/admin/*`, `/api/cron/*`, `/api/auth/*/cleanup`                                       | Administrative and scheduled work                               | Restricted by route-specific authorization or secret; never treat as public |
| `/api/health`, `/api/csp-report`                                                           | Health and browser security reporting                           | Purpose-specific public handling                                            |

## Authentication and authorization

The request proxy in [`lib/proxy.ts`](../../lib/proxy.ts) handles page redirects, CSRF checks and response headers. It intentionally **does not resolve a user for API routes**: parallel API requests previously caused competing Supabase refreshes. Each protected API handler must authenticate at the route level with `requireAuth`, `requireAuthWithRateLimit`, or an explicitly reviewed inline `auth.getUser()` check. See [`app/api/_lib/middleware.ts`](../../app/api/_lib/middleware.ts) for the shared MFA assurance check.

Data handlers generally use the user-scoped Supabase client and PostgreSQL row-level security. A service-role client bypasses RLS, so its uses need explicit authorization checks and review. Do not assume every route under a prefix has the same access rule.

## Requests and errors

Browser mutations are subject to origin/CSRF validation. Input limits and schemas vary by endpoint; use the handler's schema rather than a generic size limit. Shared response helpers are in [`app/api/_lib/response.ts`](../../app/api/_lib/response.ts), but some older handlers return their own response shape. Rate limiting is selected by [`lib/services/rateLimitService.ts`](../../lib/services/rateLimitService.ts) and depends on runtime configuration. Do not assume a Redis deployment or a single global limit.

## Integration guidance

- Use the app's authenticated client flow and session cookies for user endpoints. Never put a service-role key in browser code.
- Treat cleanup, cron and admin routes as internal even when their path is discoverable.
- For a new route, add input validation, explicit auth/authorization, ownership checks, suitable rate limiting and tests before documenting its contract.
- Use the [current architecture guide](../architecture/ARCHITECTURE.md), [environment setup](../setup/ENVIRONMENT_SETUP.md) and [security policy](../../SECURITY.md) for the production context.
