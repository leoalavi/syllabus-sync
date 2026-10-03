# Security Evidence Index

> **Historical evidence index:** File paths and line references may have changed, and the earlier proxy-level API auth description is no longer current. Verify controls in code and see the [current architecture guide](../architecture/ARCHITECTURE.md).

**Purpose:** This index provides auditors, penetration testers, and security reviewers with a structured map from security control categories to the specific files that implement them. Each section includes the control objective, the files that satisfy it, and notes on what to look for during review.

**How to use this document:** Start with the control category relevant to your review scope. Each file path is relative to the repository root. Where specific functions or configuration values are critical, they are called out.

---

## 1. Authentication and Session Management

**Control Objective:** Verify that user identity is established through strong, phishing-resistant mechanisms and that sessions are managed securely throughout their lifecycle.

**NIST:** IA-2, IA-4, IA-5, AC-12 | **OWASP:** A07:2021

| File                             | What to Review                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `app/api/auth/signin/route.ts`   | Credential validation flow, rate limiter application                                                          |
| `app/api/auth/signup/route.ts`   | Account creation, HIBP password screening integration, signup kill-switch check (`app_config.signup_enabled`) |
| `app/api/auth/signout/route.ts`  | Session cookie clearing, client storage purge trigger                                                         |
| `app/api/auth/sessions/route.ts` | Multi-session listing, individual and global session revocation                                               |
| `app/api/auth/password/route.ts` | Password change with session termination for other devices                                                    |
| `app/api/auth/user/route.ts`     | Authenticated user resolution                                                                                 |
| `app/login/actions.ts`           | Server action for login form submission                                                                       |
| `lib/supabase/middleware.ts`     | Supabase SSR client creation with cookie management                                                           |
| `lib/supabase/server.ts`         | Server-side Supabase client (authenticated context)                                                           |
| `lib/supabase/admin.ts`          | Admin client with `service_role` -- verify it is never exposed to client code                                 |
| `app/auth/callback/route.ts`     | OAuth callback handling, token exchange                                                                       |

## 2. Multi-Factor Authentication (TOTP / SMS)

**Control Objective:** Verify that MFA enrollment, verification, and recovery flows are secure and that backup codes are hashed before storage.

**NIST:** IA-2(1), IA-2(2) | **OWASP:** A07:2021

| File                                         | What to Review                                                 |
| -------------------------------------------- | -------------------------------------------------------------- |
| `app/api/auth/mfa/enroll/route.ts`           | TOTP secret generation, `Cache-Control: no-store` on response  |
| `app/api/auth/mfa/verify/route.ts`           | TOTP code verification                                         |
| `app/api/auth/mfa/challenge-verify/route.ts` | MFA challenge-response during login                            |
| `app/api/auth/mfa/status/route.ts`           | MFA enrollment status check                                    |
| `app/api/auth/mfa/unenroll/route.ts`         | MFA factor removal                                             |
| `app/api/auth/mfa/sms/enroll/route.ts`       | SMS factor enrollment                                          |
| `app/api/auth/mfa/sms/verify/route.ts`       | SMS verification code validation                               |
| `lib/security/mfa.ts`                        | MFA orchestration logic                                        |
| `lib/security/two-factor-backup-codes.ts`    | Backup code generation (hashed storage), single-use validation |

## 3. Passkeys / WebAuthn (FIDO2)

**Control Objective:** Verify that WebAuthn credential registration and authentication use proper challenge lifecycle management, counter verification, and origin binding. This is the primary phishing-resistant authentication mechanism.

**NIST:** IA-2(6) | **OWASP:** A07:2021

| File                                                                          | What to Review                                                                                                 |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `lib/security/webauthn.ts`                                                    | Challenge expiry (5 min), rate limiters (`failClosed: true`), max passkeys per user (10), counter verification |
| `app/api/webauthn/register/options/route.ts`                                  | Registration options generation, `authenticatorAttachment: "platform"`                                         |
| `app/api/webauthn/register/verify/route.ts`                                   | Registration verification, credential storage                                                                  |
| `app/api/webauthn/authenticate/options/route.ts`                              | Authentication challenge generation                                                                            |
| `app/api/webauthn/authenticate/verify/route.ts`                               | Assertion verification, counter increment                                                                      |
| `app/api/webauthn/credentials/route.ts`                                       | Credential listing (RLS-scoped) and deletion                                                                   |
| `app/api/auth/passkey/options/route.ts`                                       | Alternative passkey options endpoint                                                                           |
| `app/api/auth/passkey/verify/route.ts`                                        | Alternative passkey verification endpoint                                                                      |
| `app/api/auth/passkey/register-options/route.ts`                              | Alternative registration options                                                                               |
| `app/api/auth/passkey/register/route.ts`                                      | Alternative registration verification                                                                          |
| `app/api/auth/passkey/status/route.ts`                                        | Passkey enrollment status                                                                                      |
| `app/api/auth/passkey/_lib.ts`                                                | Shared passkey utilities                                                                                       |
| `supabase/migrations/20260207000000_add_webauthn_tables.sql`                  | `webauthn_credentials` and `webauthn_challenges` table schemas, RLS policies                                   |
| `supabase/migrations/20260214003000_restore_missing_core_security_tables.sql` | Ensures security table integrity                                                                               |

## 4. Authorization and Tenant Isolation (Row-Level Security)

**Control Objective:** Verify that every table containing user data enforces RLS policies predicated on `auth.uid()`. Confirm that `SECURITY DEFINER` RPCs use pinned `search_path` to prevent privilege escalation.

**NIST:** AC-3, AC-4 | **OWASP:** A01:2021

| File                                                                  | What to Review                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `lib/supabase/schema.sql`                                             | Master schema with RLS policy definitions                          |
| `supabase/migrations/20260108131028_add_user_id_and_rls_policies.sql` | Initial RLS policy creation                                        |
| `supabase/migrations/20260216090000_harden_security_functions.sql`    | `SECURITY DEFINER` functions with `SET search_path = public`       |
| `supabase/migrations/20260226000000_fix_security_definer_and_rls.sql` | Comprehensive RLS and SECURITY DEFINER audit                       |
| `supabase/migrations/20260214001000_align_code_db_objects.sql`        | Database object alignment                                          |
| `app/api/_lib/middleware.ts`                                          | API-layer auth enforcement (defense-in-depth, not primary control) |
| `app/api/units/route.ts`                                              | Example CRUD route -- verify Supabase client is user-scoped        |
| `app/api/units/[id]/route.ts`                                         | Single-resource route -- verify no direct SQL bypassing RLS        |
| `app/api/events/route.ts`                                             | Events CRUD                                                        |
| `app/api/events/[id]/route.ts`                                        | Single event operations                                            |
| `app/api/deadlines/route.ts`                                          | Deadlines CRUD                                                     |
| `app/api/deadlines/[id]/route.ts`                                     | Single deadline operations                                         |
| `app/api/todos/route.ts`                                              | Todos CRUD                                                         |
| `app/api/todos/[id]/route.ts`                                         | Single todo operations                                             |
| `app/api/notifications/route.ts`                                      | Notifications (user-scoped)                                        |
| `app/api/notifications/[id]/route.ts`                                 | Single notification operations                                     |

## 5. Input Validation and Output Safety

**Control Objective:** Verify that all API inputs are validated against strict schemas (Zod) before reaching business logic, and that error responses do not leak internal state.

**NIST:** SI-10 | **OWASP:** A03:2021

| File                         | What to Review                                                                |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `app/api/_lib/middleware.ts` | Centralized validation middleware, body size limits                           |
| `app/api/_lib/response.ts`   | Standardized error responses -- verify no stack traces or internal paths leak |
| `lib/schemas/auth.ts`        | Zod schemas for authentication payloads                                       |
| `app/api/units/route.ts`     | Example: verify Zod `.parse()` or `.safeParse()` before DB operations         |
| `app/api/weather/route.ts`   | Coordinate validation for external API calls                                  |
| `app/api/navigate/route.ts`  | Route coordinate validation                                                   |

## 6. CSRF, CORS, and Security Headers

**Control Objective:** Verify that mutation requests require CSRF tokens, that CORS policies restrict origins, and that response headers enforce browser security controls.

**NIST:** SC-23, SC-8, CM-6 | **OWASP:** A01:2021, A05:2021

| File                           | What to Review                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `lib/security/csrf.ts`         | `__Host-csrf` cookie (lines 20-29), double-submit pattern, constant-time comparison (line 45-47), exempt paths         |
| `lib/security/csp.ts`          | Nonce generation (`crypto.randomBytes(16)` at line 24), `buildNonceCSP()` -- verify no `unsafe-inline` in `script-src` |
| `lib/security/csp-enhanced.ts` | Enhanced CSP with `Report-To` and `report-uri` configuration                                                           |
| `lib/proxy.ts`                 | Edge middleware: CSP injection, CSRF enforcement, origin validation, `isPublicApiPath()` allowlist (lines 41-52)       |
| `lib/utils/api.ts`             | Client-side API utilities -- verify CSRF header inclusion on mutations                                                 |
| `app/api/_lib/middleware.ts`   | Server-side header enforcement                                                                                         |
| `app/api/csp-report/route.ts`  | CSP violation report ingestion                                                                                         |
| `config/next/next.config.ts`   | Next.js security headers configuration                                                                                 |

## 7. Rate Limiting and Abuse Prevention

**Control Objective:** Verify that security-critical endpoints use fail-closed rate limiting backed by distributed storage, and that in-memory limiting is blocked in production.

**NIST:** SC-5, SI-4 | **OWASP:** A04:2021

| File                                              | What to Review                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/services/rateLimitService.ts`                | Sliding-window algorithm, `failClosed` flag semantics (lines 28-34), production storage backend check, per-route limiter configurations (lines 420-470) |
| `lib/security/ip.ts`                              | Client IP extraction -- verify proxy-aware header parsing (`X-Forwarded-For`)                                                                           |
| `lib/security/ip-anomaly-detection.ts`            | Velocity checks, geolocation anomaly scoring, VPN/Tor detection                                                                                         |
| `lib/security/password-breach.ts`                 | k-Anonymity HIBP integration -- verify only 5-char SHA-1 prefix is sent                                                                                 |
| `lib/security/headers-scanner.ts`                 | Production headers validation                                                                                                                           |
| `app/api/security/check-password-breach/route.ts` | HIBP API route with rate limiting                                                                                                                       |
| `app/api/security/scan-headers/route.ts`          | Headers scan API route with rate limiting                                                                                                               |
| `lib/utils/rate-limit.ts`                         | Rate limiting utilities                                                                                                                                 |

## 8. Data Protection, Secrets Management, and Privacy

**Control Objective:** Verify that secrets are never committed to version control, that sensitive data is encrypted, and that email verification uses hashed, time-limited tokens.

**NIST:** SC-28, SC-13, MP-5 | **OWASP:** A02:2021

| File                                            | What to Review                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `.gitignore`                                    | Verify `.env*` exclusion (except `.env.example` and `.env.local.example`)  |
| `.env.example`                                  | Verify no actual secret values, only placeholder documentation             |
| `.env.local.example`                            | Same as above                                                              |
| `tools/security/check-secrets.mjs`              | Regex patterns for API keys (lines 36-39+), excluded directories and files |
| `lib/supabase/admin.ts`                         | `service_role` key usage -- verify no client-side exposure                 |
| `lib/security/emailVerification.ts`             | Token hashing, 20-minute expiry, single-use enforcement                    |
| `lib/services/emailService.ts`                  | Email content -- verify no sensitive data in email bodies                  |
| `app/api/auth/email/send-verification/route.ts` | Verification email dispatch                                                |
| `app/api/auth/email/verify/route.ts`            | Token validation and consumption                                           |
| `app/api/auth/email/cleanup/route.ts`           | Expired token cleanup (cron-secret protected)                              |

## 9. Client-Side Data Hygiene

**Control Objective:** Verify that client-side storage is cleared on logout, that the service worker cache does not retain sensitive data, and that MFA enrollment responses include `Cache-Control: no-store`.

**NIST:** SC-28, AC-12 | **OWASP:** A01:2021

| File                               | What to Review                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `lib/utils/clientStorage.ts`       | Logout cleanup -- verify `localStorage` and `sessionStorage` clearing         |
| `public/sw.js`                     | Service worker cache management -- verify cache clearing on auth state change |
| `lib/utils/serviceWorker.ts`       | Service worker registration and lifecycle                                     |
| `lib/store/profilesStore.ts`       | Zustand store with persistence -- verify cleanup integration                  |
| `app/api/auth/mfa/enroll/route.ts` | `Cache-Control: no-store` on TOTP secret response                             |

## 10. Audit Logging and Monitoring

**Control Objective:** Verify that security-relevant events are logged with sufficient detail for forensic analysis, that PII is redacted from payloads, and that the logging mechanism is tamper-resistant (database triggers, `SECURITY DEFINER` RPCs).

**NIST:** AU-2, AU-3, AU-6, AU-8 | **OWASP:** A09:2021

| File                                                                          | What to Review                                                                            |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `lib/security/audit.ts`                                                       | Audit action types (lines 16-41), severity levels (line 43), `sanitizeForAudit` redaction |
| `app/api/audit/route.ts`                                                      | Audit log query API -- verify user-scoped access                                          |
| `lib/utils/requestLogger.ts`                                                  | HTTP request logging                                                                      |
| `supabase/migrations/20260201084007_add_audit_logging_and_feature_flags.sql`  | `audit_logs` table schema, `app_config` feature flags                                     |
| `supabase/migrations/20260214002000_restore_log_audit_function.sql`           | `log_audit` RPC with `SECURITY DEFINER`                                                   |
| `supabase/migrations/20260214003000_restore_missing_core_security_tables.sql` | `audit_logs` and `auth_audit_logs` table integrity                                        |

## 11. Supply-Chain and Dependency Security

**Control Objective:** Verify that third-party dependencies are integrity-checked, that secrets do not exist in version control, and that external resources are loaded with SRI.

**NIST:** SA-12, SC-22 | **OWASP:** A06:2021, A08:2021

| File                               | What to Review                                                             |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `package.json`                     | Dependency declarations                                                    |
| `package-lock.json`                | Lockfile with integrity hashes -- verify committed and used with `npm ci`  |
| `lib/security/sri-enhanced.ts`     | SRI hash registry for CDN resources (lines 25-36), runtime hash generation |
| `tools/security/check-secrets.mjs` | Pre-commit and CI secrets scanner patterns                                 |
| `.github/workflows/ci-cd.yml`      | CI pipeline: secrets scan, lint, typecheck, test, build                    |

## 12. Deployment and Operations Hardening

**Control Objective:** Verify that production configuration enforces security headers, that health checks do not leak internal state, and that Docker images follow least-privilege principles.

**NIST:** CM-6, CM-7, SC-7 | **OWASP:** A05:2021

| File                              | What to Review                                                         |
| --------------------------------- | ---------------------------------------------------------------------- |
| `.github/workflows/ci-cd.yml`     | CI/CD pipeline steps, environment secrets handling                     |
| `config/next/next.config.ts`      | Next.js security headers, image domain allowlists, source map settings |
| `vercel.json`                     | Vercel deployment configuration, cron schedules                        |
| `infra/docker/Dockerfile`         | Base image, non-root user, multi-stage build                           |
| `infra/docker/docker-compose.yml` | Service configuration, volume mounts                                   |
| `app/api/health/route.ts`         | Health check endpoint -- verify no sensitive info exposed              |

## 13. Incident Response and Recovery

**Control Objective:** Verify that operational kill switches, scheduled cleanup jobs, and session revocation capabilities exist for incident response.

**NIST:** IR-4, IR-5 | **OWASP:** A04:2021

| File                                                                         | What to Review                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `app/api/auth/signup/route.ts`                                               | Signup kill-switch consumption (`app_config.signup_enabled`) |
| `supabase/migrations/20260201084007_add_audit_logging_and_feature_flags.sql` | `app_config` table with `signup_enabled` flag                |
| `app/api/auth/email/cleanup/route.ts`                                        | Cron-secret protected expired token cleanup                  |
| `vercel.json`                                                                | Cron schedule for cleanup jobs                               |
| `lib/security/session-termination.ts`                                        | Global and per-device session termination helpers            |
| `lib/security/two-factor-backup-codes.ts`                                    | Backup code generation and validation                        |

## 14. Documentation and Disclosure

| File                                 | Purpose                                                               |
| ------------------------------------ | --------------------------------------------------------------------- |
| `SECURITY.md`                        | Root security policy and coordinated vulnerability disclosure process |
| `SECURITY_IMPLEMENTATION_SUMMARY.md` | Complete control inventory with integration guide                     |
| `docs/security/SECURITY_POSTURE.md`  | STRIDE threat model, control catalogue, compliance mapping            |
| `docs/policies/privacy-policy.md`    | Data inventory, retention, GDPR alignment                             |
| `docs/policies/security-policy.md`   | Extended responsible disclosure program                               |
| `public/security.txt`                | RFC 9116 machine-readable security contact                            |
| `AGENT.md`                           | Development workflow and change protocol documentation                |
| `CHANGELOG.md`                       | Version history including security changes                            |
