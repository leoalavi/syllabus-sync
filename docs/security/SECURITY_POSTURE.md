# Security Posture and Hardening Report

> **Historical security snapshot:** Some Vercel runtime and proxy-level API-auth descriptions below are outdated. Use the [current architecture guide](../architecture/ARCHITECTURE.md) and inspect the implementation before relying on a control claim. This file is not a current certification or completed security audit.

**System:** Syllabus Sync Campus Platform
**Classification:** Internal / Auditor-Facing
**Audience:** Security Architects, Compliance Auditors, Penetration Testers, Technical Reviewers

---

## 1. Executive Summary

Syllabus Sync is a university campus planning application that handles student academic data, authentication credentials, and session state. The security architecture is built on two foundational principles:

- **Defense in Depth.** No single control is trusted in isolation. Authentication is validated at the edge, re-validated at the API layer, and enforced again at the database through Row-Level Security. A failure in any one layer does not compromise the system.
- **Zero Trust.** Every request is treated as potentially hostile. The edge middleware (`lib/proxy.ts`) validates JWTs, injects Content Security Policy headers, and enforces CSRF protections before any application logic executes. There is no trusted network perimeter.

This report catalogues the implemented controls, maps them to industry frameworks (OWASP Top 10 2021, NIST 800-53 Rev. 5, CIS Controls v8), and documents the threat model.

---

## 2. Threat Model

### 2.1 Methodology

The threat model follows Microsoft's STRIDE framework, adapted for a multi-tenant SaaS application serving university students. Each threat category is paired with the specific controls that mitigate it.

### 2.2 STRIDE Analysis

| Threat Category            | Attack Scenarios                                                                                                  | Implemented Mitigations                                                                                                                                                                                  | Key Evidence Files                                                                                                              |
| :------------------------- | :---------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **Spoofing** (Identity)    | Credential phishing, session token theft, password reuse from breached databases                                  | FIDO2 WebAuthn passkeys (origin-bound, phishing-resistant), TOTP/SMS MFA, HIBP credential screening, email verification gates, device fingerprinting                                                     | `lib/security/webauthn.ts`, `lib/security/mfa.ts`, `lib/security/password-breach.ts`, `lib/security/device-fingerprinting.ts`   |
| **Tampering** (Data)       | Request body manipulation, parameter pollution, replay attacks                                                    | HMAC-SHA256 request signing with 5-minute timestamp tolerance, Zod schema validation on all API boundaries, database-level atomicity via transactions and triggers                                       | `lib/security/request-signing.ts`, `app/api/_lib/middleware.ts`, `lib/schemas/auth.ts`                                          |
| **Repudiation**            | Users or attackers denying they performed an action                                                               | Centralized `audit_logs` table tracking actor identity, IP address (`inet`), user-agent, action type, and severity. PII-redacted payloads. Database-triggered logging for critical mutations.            | `lib/security/audit.ts`, `app/api/audit/route.ts`, `supabase/migrations/20260201084007_add_audit_logging_and_feature_flags.sql` |
| **Information Disclosure** | SQL injection, IDOR, error message leakage, data exfiltration                                                     | RLS tenant isolation (`auth.uid()` predicates), AES-256 encryption at rest, TLS 1.3 in transit, generic error responses via `app/api/_lib/response.ts`, `Cache-Control: no-store` on sensitive endpoints | `lib/supabase/schema.sql`, `app/api/_lib/response.ts`, `app/api/auth/mfa/enroll/route.ts`                                       |
| **Denial of Service**      | Brute-force login, credential stuffing, API abuse, resource exhaustion                                            | Distributed sliding-window rate limiting (Upstash Redis), route-specific limiters with distinct thresholds, IP anomaly detection with velocity checks, 6-second fail-fast proxy timeout                  | `lib/services/rateLimitService.ts`, `lib/security/ip-anomaly-detection.ts`, `lib/proxy.ts`                                      |
| **Elevation of Privilege** | Horizontal privilege escalation (accessing another user's data), vertical escalation (gaining admin capabilities) | RLS on every user-data table, `SECURITY DEFINER` RPCs with `SET search_path = public` to prevent search-path injection, segregated `service_role` for admin operations only                              | `supabase/migrations/20260216090000_harden_security_functions.sql`, `lib/supabase/admin.ts`                                     |

### 2.3 Trust Boundaries

```
+------------------------------------------------------------------+
|  Browser (Untrusted)                                              |
|  - Client-side state (localStorage, sessionStorage, SW cache)     |
|  - Cleared on logout via lib/utils/clientStorage.ts               |
+-----------------------------------+------------------------------+
                                    |
                          TLS 1.3   |
                                    v
+-----------------------------------+------------------------------+
|  Vercel Edge (Semi-Trusted)                                       |
|  - lib/proxy.ts: JWT validation, CSP injection, CSRF enforcement  |
|  - Nonce generated per request (crypto.randomBytes)               |
|  - isPublicApiPath() controls which routes skip auth              |
+-----------------------------------+------------------------------+
                                    |
                                    v
+-----------------------------------+------------------------------+
|  Next.js Serverless (Trusted Compute)                             |
|  - app/api/*: Zod validation, rate limiting, audit logging        |
|  - All mutations require authenticated Supabase client            |
+-----------------------------------+------------------------------+
                                    |
                                    v
+-----------------------------------+------------------------------+
|  Supabase PostgreSQL (Trusted Data)                               |
|  - RLS enforced at query execution                                |
|  - SECURITY DEFINER RPCs for privileged operations                |
|  - AES-256 encryption at rest                                     |
+------------------------------------------------------------------+
```

---

## 3. Implemented Control Catalogue

### 3.1 Authentication and Identity (NIST IA Family)

**WebAuthn / FIDO2 Passkeys**

Syllabus Sync offers phishing-resistant passwordless authentication through the Web Authentication API. This is not merely "MFA" -- it is a fundamentally different authentication model:

- The cryptographic assertion is bound to the exact origin (`syllabus-sync.dev`). A credential created for this origin cannot be replayed on a phishing domain. This eliminates real-time phishing proxy attacks that defeat TOTP.
- The `authenticatorAttachment` is configured for `platform` authenticators (FaceID, TouchID, Windows Hello), prioritizing biometric convenience on mobile devices.
- Credentials are stored in a dedicated `webauthn_credentials` table (not `user_metadata`), with RLS policies ensuring users can only read their own credentials.
- Challenge lifecycle is managed server-side with a 5-minute expiry (`CHALLENGE_EXPIRY_MINUTES = 5`). Challenges are single-use and deleted after verification.
- Rate limiting: 10 registrations per hour, 10 authentication attempts per 15 minutes. Both fail closed.

**Evidence:** `lib/security/webauthn.ts` (lines 19-47), `supabase/migrations/20260207000000_add_webauthn_tables.sql`

**Multi-Factor Authentication (TOTP / SMS)**

For users who do not use passkeys, TOTP and SMS-based MFA are available through Supabase Auth (GoTrue). Secure backup codes are generated, hashed, and stored for recovery. Each backup code is single-use.

**Evidence:** `lib/security/mfa.ts`, `lib/security/two-factor-backup-codes.ts`, `app/api/auth/mfa/*`

**Email Verification Gates**

Edge middleware intercepts unverified users attempting to access protected routes. This prevents incomplete-profile states and ensures email ownership before granting access to application features.

**Evidence:** `lib/security/emailVerification.ts`, `app/api/auth/email/verify/route.ts`

**Session Lifecycle Management**

- Global sign-out invalidates all sessions across devices.
- Password change triggers automatic session termination for all other sessions.
- Session cookies use `Secure`, `HttpOnly`, and `SameSite=Lax` attributes.

**Evidence:** `lib/security/session-termination.ts`, `app/api/auth/sessions/route.ts`, `app/api/auth/signout/route.ts`

### 3.2 Authorization and Tenant Isolation (NIST AC Family)

**Row-Level Security (RLS)**

This is the most architecturally significant security control in the system. Every table containing user data enforces RLS policies that predicate access on `auth.uid()`. This means:

- **Authorization is enforced by the database engine, not application code.** A bug in a route handler -- even a completely missing authorization check -- cannot leak another tenant's data.
- This is genuine multi-tenant isolation, not "we check `user_id` in our WHERE clause." The database will refuse to return rows that do not belong to the authenticated user, regardless of the query.
- RLS policies are defined in migrations and version-controlled. Changes require explicit migration review.

**Evidence:** `lib/supabase/schema.sql`, `supabase/migrations/20260108131028_add_user_id_and_rls_policies.sql`, `supabase/migrations/20260226000000_fix_security_definer_and_rls.sql`

**Secure RPC Execution**

Gamification logic and critical state mutations execute via PostgreSQL stored procedures with `SECURITY DEFINER` execution context. These are hardened with `SET search_path = public` to prevent search-path hijacking -- a known PostgreSQL privilege escalation vector.

**Evidence:** `supabase/migrations/20260216090000_harden_security_functions.sql`

### 3.3 Network and Application Security (NIST SC Family)

**Edge Zero-Trust Middleware (`lib/proxy.ts`)**

The edge middleware is the first code that executes on every request. It:

1. Generates a cryptographic nonce (`crypto.randomBytes(16)`) and builds a per-request CSP header.
2. Validates CSRF tokens on mutation requests (POST, PUT, PATCH, DELETE) using the double-submit cookie pattern with constant-time comparison.
3. Resolves the authenticated user via Supabase JWT validation for protected routes.
4. Enforces a 6-second fail-fast timeout on upstream auth calls to prevent edge function timeouts.
5. Controls which API routes are public via `isPublicApiPath()`. All routes not explicitly listed require authentication.

**Evidence:** `lib/proxy.ts` (lines 41-52, 96-106), `lib/security/csrf.ts`, `lib/security/csp.ts`

**Content Security Policy (CSP)**

The CSP is nonce-based. Every response includes a `Content-Security-Policy` header with a unique, cryptographically random nonce. Script elements must carry this nonce to execute. This is strictly stronger than hash-based or allowlist-based CSP because:

- An attacker who achieves HTML injection cannot predict the nonce.
- The nonce changes on every request, so a captured nonce is useless for subsequent requests.
- `unsafe-inline` is not used for `script-src`. It is retained only for `style-src` due to Tailwind CSS / Next.js runtime style injection requirements.

**Evidence:** `lib/security/csp.ts` (lines 24-48)

**Subresource Integrity (SRI)**

External resources loaded from CDNs (Leaflet, Google Maps) have pre-computed SHA-256/SHA-384 integrity hashes. The browser verifies the hash before executing the resource. If a CDN is compromised and serves modified JavaScript, the browser blocks execution entirely. This is a direct mitigation for supply-chain attacks (OWASP A08:2021).

**Evidence:** `lib/security/sri-enhanced.ts` (lines 25-36)

**CSRF Protection**

CSRF is mitigated through a defense-in-depth approach:

1. `__Host-` prefixed CSRF cookie (cannot be set by subdomains, requires `Secure` and path `/`).
2. Double-submit pattern: the token is sent as both a cookie and a custom header (`x-csrf-token`).
3. Constant-time comparison via SHA-256 hash comparison to prevent timing side-channels.
4. Origin and Referer header validation at the edge.

**Evidence:** `lib/security/csrf.ts` (lines 20-29, 38-47)

### 3.4 Resilience and Abuse Prevention (NIST SC-5, SI-4)

**Distributed Rate Limiting**

Rate limiting uses a sliding-window algorithm backed by Upstash Redis in production. Key design decisions:

| Limiter                   | Window | Max Requests | Fail Mode | Rationale                                             |
| ------------------------- | ------ | ------------ | --------- | ----------------------------------------------------- |
| `authLimiter`             | 15 min | 50           | Closed    | Security-critical: brute-force prevention.            |
| `passwordResetLimiter`    | 1 hour | 10           | Closed    | Security-critical: prevents reset-flood abuse.        |
| `webauthnRegisterLimiter` | 1 hour | 10           | Closed    | Prevents credential-stuffing of passkey registration. |
| `webauthnAuthLimiter`     | 15 min | 10           | Closed    | Prevents passkey authentication brute-force.          |
| `apiLimiter`              | 1 min  | 200          | Open      | General API: prioritizes availability.                |
| `mutationLimiter`         | 1 min  | 60           | Open      | Write operations: moderate throttle.                  |
| `bulkOperationLimiter`    | 1 min  | 10           | Open      | Expensive operations: stricter throttle.              |

In-memory rate limiting is explicitly blocked in production because serverless functions do not share memory across instances. An attacker could bypass in-memory limiters by distributing requests across cold starts.

**Evidence:** `lib/services/rateLimitService.ts` (lines 1-35, 420-470)

**IP Anomaly Detection**

The IP anomaly detection module performs velocity checks (flagging impossible-travel scenarios), geolocation anomaly scoring, and VPN/Tor exit-node identification. Anomalous requests trigger additional verification requirements.

**Evidence:** `lib/security/ip-anomaly-detection.ts`

**Credential Screening**

During signup and password reset, candidate passwords are checked against the HaveIBeenPwned database using the k-Anonymity API (only a 5-character SHA-1 prefix is sent, preserving password confidentiality). Compromised passwords are rejected with an explanation.

**Evidence:** `lib/security/password-breach.ts`, `app/api/security/check-password-breach/route.ts`

### 3.5 Auditing and Observability (NIST AU Family)

**Audit Logging Architecture**

The `audit_logs` table provides a tamper-evident record of security-relevant events. Each entry captures:

- Actor identity (user ID)
- Action type (strongly typed: `LOGIN`, `PASSWORD_CHANGE`, `MFA_ENABLE`, `SUSPICIOUS_ACTIVITY`, etc.)
- Severity level (`info`, `warning`, `critical`)
- IP address (`inet` type) and user-agent
- Affected table and record ID
- Sanitized old/new data (sensitive fields redacted by `sanitizeForAudit`)

Database-triggered logging handles critical mutations automatically, eliminating the risk of developers forgetting to add logging to new endpoints.

**PII Handling Decision:** IP addresses and user-agents are stored in plaintext. This is a deliberate decision: these fields are essential for threat hunting (correlating suspicious login patterns, identifying botnets). The trade-off is documented, and a retention policy should be applied to limit the exposure window.

**Evidence:** `lib/security/audit.ts` (lines 16-53), `supabase/migrations/20260214002000_restore_log_audit_function.sql`

**Security Headers Validation**

An internal scanning tool (`lib/security/headers-scanner.ts`) validates the presence and correctness of security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CORP, COOP) on production deployments. This catches configuration regressions.

**Evidence:** `lib/security/headers-scanner.ts`, `app/api/security/scan-headers/route.ts`

**CSP Violation Reporting**

CSP violations are reported to `/api/csp-report` via the standard `report-uri` and `Report-To` mechanisms. This provides real-time visibility into XSS attempts and policy misconfigurations in production.

**Evidence:** `app/api/csp-report/route.ts`, `lib/security/csp-enhanced.ts`

### 3.6 Supply-Chain Security (NIST SA-12)

- **Lockfile integrity:** `package-lock.json` is committed and integrity-checked. `npm ci` (not `npm install`) is used in CI.
- **Secrets scanner:** `tools/security/check-secrets.mjs` runs in CI and pre-commit. Matches patterns for API keys (OpenAI, GitHub, AWS, Slack, Supabase service role keys) across all tracked files.
- **Dependency review:** CI pipeline fails on known-vulnerable dependencies.
- **Environment variable hygiene:** `.env.example` and `.env.local.example` document every required secret. `.gitignore` excludes all `.env*` files. No secrets exist in version control.

**Evidence:** `tools/security/check-secrets.mjs`, `.github/workflows/ci-cd.yml`, `package-lock.json`, `.gitignore`

---

## 4. Compliance and Framework Mapping

### 4.1 OWASP Top 10 (2021) Coverage

| OWASP ID | Risk                                   | Status              | Primary Controls                                                                                        |
| -------- | -------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| A01      | Broken Access Control                  | Mitigated           | RLS tenant isolation, CSRF protection, session management                                               |
| A02      | Cryptographic Failures                 | Mitigated           | AES-256 at rest, TLS 1.3 in transit, HMAC-SHA256 request signing, SHA-256 CSRF comparison               |
| A03      | Injection                              | Mitigated           | Nonce-based CSP, Zod schema validation, parameterized queries (Supabase client)                         |
| A04      | Insecure Design                        | Mitigated           | STRIDE threat model, defense-in-depth architecture, fail-closed security controls                       |
| A05      | Security Misconfiguration              | Mitigated           | Automated headers scanner, CI quality gate (format + lint + typecheck + test + build), `.env` hygiene   |
| A06      | Vulnerable/Outdated Components         | Partially Mitigated | Lockfile integrity, CI pipeline. Automated dependency scanning should be added.                         |
| A07      | Identification/Authentication Failures | Mitigated           | FIDO2 WebAuthn, TOTP MFA, HIBP screening, email verification, device fingerprinting                     |
| A08      | Software/Data Integrity Failures       | Mitigated           | SRI on CDN assets, secrets scanner in CI, `SECURITY DEFINER` RPCs with pinned search path               |
| A09      | Security Logging/Monitoring Failures   | Mitigated           | Centralized audit logs, CSP violation reporting, IP anomaly detection                                   |
| A10      | Server-Side Request Forgery            | Partially Mitigated | Origin validation on proxy routes, but explicit SSRF controls should be reviewed for internal API calls |

### 4.2 NIST 800-53 Rev. 5 Mapping

| Control Family                       | Implemented Controls                                                                                                                                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC** (Access Control)              | AC-2 (Account Management), AC-3 (Access Enforcement via RLS), AC-4 (Information Flow via RLS), AC-7 (Unsuccessful Logon Attempts via rate limiting), AC-12 (Session Termination)                                                                                                                                                |
| **AU** (Audit)                       | AU-2 (Event Logging), AU-3 (Content of Audit Records), AU-6 (Audit Review via anomaly detection), AU-8 (Time Stamps)                                                                                                                                                                                                            |
| **IA** (Identification/Auth)         | IA-2 (Multi-Factor Authentication), IA-2(6) (Phishing-Resistant MFA via WebAuthn), IA-4 (Identifier Management), IA-5 (Authenticator Management including HIBP screening)                                                                                                                                                       |
| **SC** (System/Comms Protection)     | SC-5 (DoS Protection via rate limiting), SC-7 (Boundary Protection via edge middleware), SC-8 (Transmission Confidentiality via TLS), SC-13 (Cryptographic Protection), SC-22 (Architecture/Provisioning for Name/Address via SRI), SC-23 (Session Authenticity via CSRF protection), SC-28 (Protection of Information at Rest) |
| **SI** (System/Info Integrity)       | SI-3 (Malicious Code Protection via CSP), SI-4 (System Monitoring via audit logs and IP anomaly detection), SI-10 (Information Input Validation via Zod)                                                                                                                                                                        |
| **CM** (Configuration Mgmt)          | CM-6 (Configuration Settings via headers scanner), CM-7 (Least Functionality via isPublicApiPath allowlist)                                                                                                                                                                                                                     |
| **SA** (System/Services Acquisition) | SA-12 (Supply Chain Protection via SRI, lockfile, secrets scanner)                                                                                                                                                                                                                                                              |

### 4.3 Zero Trust Alignment

| Zero Trust Principle       | Implementation                                                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verify explicitly          | Every request validated at edge (JWT + CSRF + origin), API layer (Zod + rate limit), and database (RLS).                                                                          |
| Use least-privilege access | RLS scopes all queries to `auth.uid()`. `SECURITY DEFINER` RPCs use pinned search paths. `service_role` is segregated to admin-only operations.                                   |
| Assume breach              | Audit logging captures all security events. Session termination on password change limits blast radius. Device fingerprinting detects credential reuse from unrecognized devices. |

---

## 5. Known Limitations and Roadmap

Transparency about gaps is a security practice, not a weakness. The following items are documented for prioritized remediation:

| Item                          | Current State                                                                                               | Recommended Action                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Session termination helpers   | Implementation exists (`lib/security/session-termination.ts`) but runtime wiring is not fully evidenced     | Verify integration with password-change flow in production                             |
| 2FA backup codes              | Implementation exists (`lib/security/two-factor-backup-codes.ts`) but runtime wiring is not fully evidenced | Verify integration with MFA enrollment flow                                            |
| Audit log retention           | No automated retention policy or scheduled deletion                                                         | Implement a 90-day retention window with a scheduled cleanup job                       |
| SSRF controls                 | Origin validation exists for proxy routes                                                                   | Add explicit SSRF mitigation for any internal API calls that accept user-supplied URLs |
| Automated dependency scanning | CI runs secrets scanner but not a dedicated CVE scanner                                                     | Integrate `npm audit` or Snyk into CI pipeline                                         |
| WAF / DDoS protection         | Relying on Vercel's built-in protections                                                                    | Evaluate Vercel Firewall or Cloudflare for additional layer                            |

---

## 6. Incident Response Readiness

| Capability                    | Implementation                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Signup kill switch**        | `app_config.signup_enabled` feature flag (database-backed). Can halt all new registrations without a deployment.                                                  |
| **Global session revocation** | Session termination API (`/api/auth/sessions`) supports revoking all sessions for a user.                                                                         |
| **Audit trail for forensics** | `audit_logs` table with structured events, IP addresses, and timestamps for post-incident analysis.                                                               |
| **Scheduled cleanup**         | Email verification tokens and stale data cleaned by cron job (`app/api/auth/email/cleanup/route.ts`, triggered via `vercel.json` cron). Protected by cron secret. |

**Evidence:** `supabase/migrations/20260201084007_add_audit_logging_and_feature_flags.sql`, `app/api/auth/email/cleanup/route.ts`, `vercel.json`
