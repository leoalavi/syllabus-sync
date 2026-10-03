# Technical Architecture & Engineering Decisions

> **Historical design record:** Several sections below describe an earlier Vercel deployment and proxy-level API auth gate. They are retained for decision history, not as an implementation guide. For the current Cloudflare/OpenNext runtime and route-level API authentication, use the [architecture guide](./docs/architecture/ARCHITECTURE.md) and [production checklist](./docs/operations/deployment-checklist.md).

**System:** Syllabus Sync -- A Secure, Edge-First Campus Platform
**Author:** Raouf
**Audience:** Senior Engineers, Security Architects, Technical Reviewers

---

## Overview

Syllabus Sync is a production-grade "Campus OS" built on Next.js 16, Supabase (PostgreSQL), and Vercel Edge infrastructure. This document is an architecture decision record (ADR). It explains the _why_ behind each major technical choice, the trade-offs evaluated, and the problems each decision solves. Every claim maps to a concrete implementation in the repository.

---

## 1. Edge-First Request Pipeline

### 1.1 The Problem: Auth at the Wrong Layer

Most web applications enforce authorization inside API route handlers. This creates two failure modes:

1. **Coverage gaps.** A single forgotten auth check in one route handler exposes an entire resource. In a serverless architecture with dozens of API routes, this is a statistical inevitability.
2. **Wasted compute.** Unauthorized requests still invoke the serverless function, spin up a cold start, and consume billing units before being rejected.

### 1.2 The Decision: Proxy Middleware Auth Gate

All requests -- pages, API calls, and static assets -- pass through a single edge function (`lib/proxy.ts`) before reaching any application code. This function is the system's Zero-Trust boundary.

**Route classification and the allowlist model.** The function `isPublicApiPath()` maintains an explicit allowlist of routes that may bypass authentication (auth callbacks, health checks, public map proxies, CSP reporting). Every other `/api/*` route requires a valid Supabase JWT. This is a deny-by-default model: adding a new API route without updating the allowlist results in a 401, not an accidental data leak.

**Why this matters.** The auth decision happens at the edge, at the CDN layer, before Vercel provisions a serverless function. Unauthorized traffic never reaches the application runtime. This reduces attack surface, eliminates an entire class of "forgot the auth check" bugs, and cuts infrastructure cost under abuse scenarios.

**Security headers as a side effect.** Because every request transits the proxy, security headers (CSP with per-request nonces, HSTS with preload, X-Frame-Options, Permissions-Policy) are injected uniformly. There is no route that can accidentally omit them.

### 1.3 Handling Serverless Edge Constraints

Vercel Edge functions operate under strict execution time limits. A slow upstream Supabase response (network partition, regional outage, connection reset) would hang the edge function and cascade into 504 Gateway Timeouts for all users.

**Fail-fast fetch wrapper (`lib/supabase/fetch.ts`).** Every Supabase call from the edge uses `fetchWithTimeout`, which enforces a hard 15-second deadline (20 seconds in development). The implementation composes `AbortSignal` instances, combining the caller's cancellation signal with the timeout signal so that whichever fires first terminates the request.

**Auth resolution deadline.** The proxy imposes a separate 6-second deadline (`PROXY_AUTH_DEADLINE_MS`) on session validation. If Supabase cannot confirm the session within 6 seconds:

- For protected page routes, the request proceeds as unauthenticated (the user sees a login redirect rather than a blank screen).
- For protected API routes, the proxy returns a `503 AUTH_UNAVAILABLE` response, signaling the client to retry.

This is a deliberate trade-off: during a Supabase outage, users lose access to authenticated features but the application remains responsive. The alternative -- blocking indefinitely -- would make the entire platform appear offline.

**MFA assurance level check.** For users with TOTP or passkey MFA enrolled, the proxy performs a second edge call to verify the authenticator assurance level (AAL). This also races against a deadline (2.5 seconds in production). If MFA status cannot be determined, API routes return 503 rather than silently downgrading the security posture.

---

## 2. Distributed Rate Limiting

### 2.1 The Problem: In-Memory State in Serverless

Traditional rate limiting libraries (e.g., `express-rate-limit`) store counters in process memory. In a serverless environment, each request may execute in a different isolate with its own memory space. An attacker sending 1,000 requests may hit 1,000 different isolates, each of which sees the request as "the first one."

### 2.2 The Decision: Tiered Storage with Fail-Closed Semantics

The rate limiting service (`lib/services/rateLimitService.ts`) implements a pluggable storage backend with a strict priority chain:

1. **Upstash Redis** (preferred) -- stateless REST API, no persistent connections, purpose-built for serverless.
2. **Vercel KV** -- same REST protocol, alternative provider.
3. **Supabase PostgreSQL** -- distributed via RPC calls (`ratelimit_increment`), viable for low-to-medium traffic.
4. **In-memory** -- development only.

**The fail-closed design.** Security-critical endpoints (login, signup, password reset, passkey authentication) are configured with `failClosed: true`. If the rate limit store is unreachable or misconfigured in production, these endpoints _reject all requests_ rather than silently allowing unlimited attempts. This prevents a Redis outage from becoming a brute-force window.

Non-critical endpoints (general API reads, bulk operations) use `failClosed: false`, prioritizing availability over strict enforcement. This is an explicit trade-off documented in the configuration.

**Why not a WAF?** A Web Application Firewall would provide similar protection but introduces vendor lock-in and opaque rules. The application-level implementation allows per-endpoint tuning (20 signups/hour vs. 200 API calls/minute vs. 10 password resets/hour) and makes rate limiting logic auditable alongside the application code.

---

## 3. Database-Level Security & Atomicity

### 3.1 Row-Level Security as the Final Authority

Application-layer authorization is necessary but insufficient. A single missing `WHERE user_id = ?` clause in a query creates an Insecure Direct Object Reference (IDOR) vulnerability. In a codebase with dozens of data access patterns, this is difficult to prevent through code review alone.

**Decision:** Every table in the PostgreSQL database has Row-Level Security (RLS) enabled. Policies are defined at the database level, enforcing that `auth.uid()` matches the row owner for all SELECT, INSERT, UPDATE, and DELETE operations. Even if an API route contains a flawed query, the database engine blocks cross-tenant data access.

This creates true defense-in-depth: the application layer checks authorization, and the database layer independently enforces it. Neither trusts the other.

### 3.2 Signup Atomicity via PostgreSQL Triggers

**The problem.** User signup requires two operations: creating an Auth record (in `auth.users`) and creating a profile row (in `public.profiles`). The original implementation performed these as sequential API calls in the signup route handler. If the profile insertion failed (network error, constraint violation, serverless timeout), the system produced an orphaned Auth user with no corresponding profile -- breaking downstream queries that JOIN on the profile.

**The fix.** A PostgreSQL trigger (`on_auth_user_created`) fires automatically when a row is inserted into `auth.users`, creating a blank `public.profiles` row within the same database transaction. This guarantees atomicity: either both records exist or neither does. The application code cannot bypass this invariant because it is enforced at the storage layer.

### 3.3 Securing the Gamification RPC Layer

The platform includes XP and streak mechanics. Client-controlled XP awards are inherently vulnerable to tampering -- a modified client could award arbitrary XP to any user.

**Decision:** XP mutations are delegated to a PostgreSQL RPC function (`award_xp`) defined as `SECURITY DEFINER SET search_path = public`. The function:

- Validates that `auth.uid()` matches the target `user_id`, preventing cross-user mutation.
- Runs with elevated privileges but has public execution revoked; only the `authenticated` role may call it.
- Executes atomically within a single database transaction, preventing partial XP/streak updates.

This moves the trust boundary from the client to the database. The API route is a thin passthrough; the business logic and authorization live where they cannot be circumvented by client manipulation.

### 3.4 Audit Logging

All sensitive mutations are recorded via the `log_audit` RPC into the `audit_logs` table, capturing the actor, action, old/new data payloads, IP address, and User Agent.

**PII handling trade-off.** The `old_data`/`new_data` JSON payloads are sanitized via `sanitizeForAudit` to strip passwords and API keys. However, IP addresses and User Agents are stored in plaintext (cast to `inet` and `text`) to support IP anomaly detection and incident response. This is a deliberate decision: forensic capability was prioritized over minimizing PII storage, with the understanding that audit log access is restricted to the service role.

---

## 4. Optimistic UI & Concurrency Control

### 4.1 The Problem: The Disappearing Notification

Optimistic UI creates a specific race condition that is easy to overlook:

1. User creates a reminder. The client immediately renders it with a temporary ID (`temp-abc123`).
2. The client sends a POST to the server.
3. Concurrently, a browser focus event triggers a background GET to `/api/notifications` to refresh the list.
4. The GET response returns _before_ the POST is processed. The standard pattern -- "replace local state with server state" -- overwrites the notification list, and the just-created reminder vanishes from the UI.

The user sees their reminder appear, then disappear, then reappear seconds later when the POST completes. This is disorienting and erodes trust in the application.

### 4.2 The Decision: Additive Merge with Protected IDs

The notification store (`lib/store/notificationsStore.ts`) implements a custom merge strategy instead of the naive "replace" pattern:

**Concurrency guard (`_loadInFlight`).** A boolean flag prevents overlapping `loadNotifications` calls. When the `addNotification` function fires a POST, it sets `_loadInFlight = true`, blocking any concurrent background refresh from executing until the POST completes. A 30-second timeout acts as a safety valve against hung fetches.

**Protected ID map (`_protectedIds`).** When a notification is optimistically added, its temporary ID is registered in a `Map<string, number>` with a timestamp. During the merge phase of any subsequent server sync, notifications whose IDs appear in this map are preserved rather than overwritten. When the server confirms the creation, protection transfers from the temporary ID to the server-assigned ID.

**Additive merge logic.** The sync function iterates the server response and:

- Updates existing notifications with server data (picking up read status changes, etc.).
- Adds notifications that exist on the server but not locally.
- Preserves locally-created notifications that the server has not yet acknowledged.

Protection entries expire after 2 minutes, ensuring that genuinely deleted notifications are eventually cleaned up.

**Why not a simple queue?** A request queue would serialize all operations, eliminating the race condition but also eliminating the performance benefit of parallel fetches. The additive merge preserves concurrency while preventing data loss -- the right trade-off for a notification system where eventual consistency is acceptable but UI flicker is not.

---

## 5. Authentication: FIDO2 WebAuthn (Passkeys)

**Decision:** The platform supports hardware-backed passwordless authentication via FIDO2 WebAuthn.

**Authenticator scope constraint.** The `authenticatorAttachment` is explicitly set to `'platform'`, restricting passkeys to built-in device authenticators (FaceID, TouchID, Windows Hello). This was a deliberate UX trade-off: platform authenticators provide a frictionless biometric flow that students will actually use, whereas requiring a roaming authenticator (YubiKey) would introduce friction that reduces adoption on a campus platform.

**CSRF integration.** The proxy middleware validates CSRF tokens (double-submit cookie pattern with `__Host-csrf` prefix) for all mutation requests. WebAuthn authentication endpoints are listed in `isPublicApiPath()` because the challenge-response protocol provides its own replay protection, making CSRF tokens redundant for those routes.

---

## 6. Campus Navigation: Heading Fusion Algorithm

### 6.1 The Problem

Standard HTML5 Geolocation provides unreliable heading data when a user is walking slowly or stationary -- precisely the common case for students navigating between buildings on a compact campus.

### 6.2 The Decision: Multi-Source Heading Fusion

The `useMapLocation` hook fuses three heading sources with a priority cascade:

1. **GPS heading** -- used only when velocity exceeds a threshold, where GPS heading data is reliable.
2. **Movement-derived heading** -- computed by smoothing the vector between the last N coordinate samples. Effective at walking speed but noisy when stationary.
3. **Compass fallback (DeviceOrientation API)** -- used when the user is stationary, providing a stable heading from the device magnetometer.

**Outlier rejection.** GPS samples with large coordinate jumps (exceeding a distance threshold relative to the previous sample) or low accuracy scores are discarded. This prevents the map marker from jumping across buildings when the device briefly triangulates to a distant cell tower.

**Server-side API proxies.** Google Maps API calls (Routes, Places search, Places details) are proxied through server-side API routes (`/api/maps/*`) rather than called directly from the client. This keeps the API key server-side, enables per-route rate limiting via `apiLimiter`, and allows origin validation via `isTrustedOrigin`. The proxy routes are listed in `isPublicApiPath()` because they serve unauthenticated map views.

---

## 7. Development Operations & Quality Gates

**Automated quality pipeline.** The command `npm run check` executes a six-stage gate: secret scanning, formatting (Prettier), type checking (strict TypeScript), linting (ESLint with zero-warning policy), testing (Vitest unit + Playwright E2E, 500+ tests), and production build. All stages must pass before deployment.

**Secret scanning.** A custom pre-commit hook (`tools/security/check-secrets.mjs`) scans staged files for patterns matching API keys, tokens, and credentials. This runs before the commit is created, not in CI, ensuring secrets never enter the repository history.

**Observability.** Sentry is integrated across three runtimes -- Edge Middleware, Server Components, and Client Components -- providing unified error tracking with source maps.

**Deployment.** Production deploys execute via `npx vercel --prod` after the full quality gate passes. Vercel's deployment model (immutable deployments with instant rollback) complements the serverless architecture.

---

## Related Documents

- [Architecture Overview](./docs/architecture/ARCHITECTURE.md) -- Component-level system design and data flow.
- [Security Posture Report](./docs/security/SECURITY_POSTURE.md) -- Complete catalogue of implemented security controls with STRIDE threat model.
- [Route Inventory](./docs/inventory/ROUTE_INVENTORY.md) -- Mapping of the Next.js App Router structure.
