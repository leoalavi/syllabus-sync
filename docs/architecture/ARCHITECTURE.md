# Syllabus Sync architecture

Syllabus Sync is an independent student platform for academic planning and university-life management. It is currently developed and validated around Macquarie University and is not an official Macquarie University service. Support for other institutions, institution-specific data adapters, and multi-institution architecture are future directions, not implemented rollout claims.

## Product boundary

- **Syllabus Sync:** the core web platform for units, schedules, assignments, exams, deadlines, events, and campus information.
- **Sylla:** the connected AI-assisted study layer. It is a separate application; the Syllabus Sync sidebar can link to it when `NEXT_PUBLIC_SYLLA_URL` is configured. Shared authentication depends on deployment configuration.
- **Campus Navigation:** a connected mobile wayfinding companion. The current web map provides campus context and route features; a complete mobile-app handoff is not claimed here.
- **Astronomy Open Night 2026:** a separate event project by the same team, outside the Syllabus Sync product boundary.

## Runtime and code layout

| Area               | Current implementation                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Web                | Next.js 16 App Router and React 19 in `app/`; shared UI in `components/`; feature modules in `features/`              |
| Client state       | Zustand stores in `lib/store/`, plus TanStack Query where used                                                        |
| API                | Next.js route handlers in `app/api/`, with shared response and auth helpers in `app/api/_lib/`                        |
| Auth and database  | Supabase Auth and PostgreSQL; clients in `lib/supabase/`, schema history and RLS policies in `supabase/migrations/`   |
| Production adapter | OpenNext for Cloudflare Workers; source config in `open-next.config.ts`, `wrangler.jsonc`, and `cloudflare/worker.js` |
| Tests              | Vitest and Testing Library under `tests/`; configuration in `config/vitest/vitest.config.ts`                          |

The current production Worker is `syllabus-sync-production` at `www.syllabus-sync.app`. The public information site has a separate Worker, `syllabus-sync-info`, at `info.syllabus-sync.app`; its checkout is ignored by this repository. Historical Vercel configuration and scripts remain in the repository, but the [production checklist](../operations/deployment-checklist.md) describes the verified Cloudflare path.

## Request and authentication flow

1. `middleware.ts` exports the `lib/proxy.ts` request handler using the middleware convention required by this project's Cloudflare/OpenNext setup. It sets response security headers and handles CSRF checks for matched requests.
2. For protected **page** routes, the proxy asks Supabase for the user, then applies login, email-verification, and MFA redirects. If auth resolution times out, the page can continue; the rendered feature must still handle its own data and errors.
3. API routes intentionally skip proxy-level user resolution to avoid competing refresh-token requests during parallel API calls. Each protected route must authenticate with `requireAuth`, `requireAuthWithRateLimit`, or an explicitly reviewed inline `getUser()` check. The shared helpers check MFA assurance for authenticated API requests.
4. Handlers validate inputs, query through the user-scoped Supabase client where possible, and rely on PostgreSQL RLS as the final authorization boundary. Service-role clients bypass RLS and must remain limited to reviewed server-side operations.

This split is important for contributors: the proxy is **not** an automatic authentication gate for new API routes. See `app/api/_lib/middleware.ts` and the route's own tests before adding an endpoint.

## Data and integrations

- Migration files under `supabase/migrations/` are the source-controlled schema history. They cannot prove the state of a live Supabase project; check the linked project before migration work.
- Some routes use a service-role Supabase client for operations such as cleanup, verification, push, and passkeys. The service role key is server-only and bypasses RLS.
- `lib/services/rateLimitService.ts` chooses a distributed rate-limit backend when configured and can use an in-memory fallback in development. Security-critical routes use fail-closed behavior when an acceptable store is unavailable in production.
- The campus map uses Leaflet and optional Google Maps/Routes integrations. API keys and corresponding features depend on environment configuration.
- `cloudflare/worker.js` wraps OpenNext's generated Worker so the three configured cleanup schedules reach existing API routes. Push reminders are scheduled separately through GitHub Actions.
- Optional Resend, Sentry, Web Push, and Sylla integrations each require their own configuration. See [environment setup](../setup/ENVIRONMENT_SETUP.md).

## Future architecture

Institution-specific academic and campus data adapters, broader university support, and a multi-institution or multi-tenant model are directions for future design. The current Macquarie-oriented data and UI should not be described as a completed reusable adapter layer or an Australia-wide rollout.

## Further reading

- [API reference](../api/API_REFERENCE.md)
- [Environment setup](../setup/ENVIRONMENT_SETUP.md)
- [Production checklist](../operations/deployment-checklist.md)
- [Security policy](../../SECURITY.md)
