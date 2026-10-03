# Privacy Policy

**Syllabus Sync -- Data Protection and Privacy Practices**

Last Updated: 2026-03-21

---

## 1. Purpose and Scope

This privacy policy describes the personal data that Syllabus Sync collects, the legal basis for processing it, how it is stored and protected, and the rights available to data subjects. It applies to:

- The Syllabus Sync web application and all routes under `app/api/*`
- Database objects managed through `supabase/migrations/*`
- Client-side data stored in browser storage (localStorage, sessionStorage, service worker cache)
- Third-party services integrated with the application

This policy is written to be implementation-aware. Where possible, it references the specific code and schema that govern data handling, so that claims can be independently verified against the codebase.

---

## 2. Data Minimization Principle

Syllabus Sync follows the principle of data minimization (GDPR Article 5(1)(c)). We collect only the data necessary to deliver academic planning functionality and secure user accounts. We do not collect data speculatively, and we do not monetize personal data.

**What we do not do:**

- We do not sell personal data.
- We do not serve advertising or build advertising profiles.
- We do not perform behavioral tracking beyond what is necessary for security (IP anomaly detection, device fingerprinting for account protection).
- We do not retain data beyond its stated purpose.

---

## 3. Data Inventory

The following table enumerates every category of personal data processed by the application, the purpose for which it is collected, and the code that implements the collection.

| Data Category                | Specific Data Elements                                                                                                                     | Purpose and Legal Basis                                                                                             | Evidence (Code / Schema)                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Account identity**         | Email address, authentication identifier (Supabase Auth UID), password hash (managed by Supabase Auth, never stored in application tables) | Account creation, authentication, session management. Basis: contractual necessity.                                 | `app/api/auth/signup/route.ts`, `app/api/auth/signin/route.ts`, `supabase/migrations/20260104000000_initial_schema.sql`                                                      |
| **Profile**                  | `full_name`, `student_id`, `course`, `year`, `avatar_url`, `email`                                                                         | Personalize academic dashboard and user profile. Basis: contractual necessity.                                      | `app/api/profiles/route.ts`, `docs/database/database-schema.sql` (`public.profiles`)                                                                                         |
| **Academic planning**        | Units (subjects), class times, deadlines, events, todos                                                                                    | Core application functionality. Basis: contractual necessity.                                                       | `docs/database/database-schema.sql` (`public.units`, `public.class_times`, `public.deadlines`, `public.events`), `supabase/migrations/20260124001000_create_todos_table.sql` |
| **Notification preferences** | In-app notifications, notification preference toggles (email/push, reminder timing)                                                        | Deliver user-configured reminders and alerts. Basis: consent (user-configured).                                     | `docs/database/database-schema.sql` (`public.notifications`, `public.user_preferences`), `lib/store/notificationPreferencesStore.ts`                                         |
| **Security and audit**       | Audit event metadata: action type, severity, IP address (`inet`), user-agent, timestamp                                                    | Security monitoring, abuse detection, incident investigation. Basis: legitimate interest (security of the service). | `lib/security/audit.ts`, `supabase/migrations/20260214003000_restore_missing_core_security_tables.sql` (`public.audit_logs`, `public.auth_audit_logs`)                       |
| **MFA credentials**          | TOTP factors (managed by Supabase Auth), WebAuthn credential public keys, challenge records, hashed backup codes                           | Strong authentication and account recovery. Basis: legitimate interest (account security).                          | `app/api/auth/mfa/*`, `app/api/webauthn/*`, `supabase/migrations/20260207000000_add_webauthn_tables.sql`                                                                     |
| **Email verification**       | Token hash, user ID, expiry timestamp, used flag                                                                                           | Verify email ownership, prevent token replay. Basis: contractual necessity.                                         | `lib/security/emailVerification.ts`, `supabase/migrations/20260213000000_email_verifications.sql`                                                                            |
| **Session metadata**         | Session device label (derived from user-agent string), session scope, session cookies                                                      | Session display and user session management. Basis: contractual necessity.                                          | `app/api/auth/sessions/route.ts`, `lib/supabase/middleware.ts`                                                                                                               |
| **Location (feature-gated)** | Latitude/longitude, only when user invokes navigation or weather features                                                                  | Navigation routing and weather display. Basis: consent (user-initiated action).                                     | `app/api/navigate/route.ts`, `app/api/weather/route.ts`, `features/map/hooks/useMapLocation.ts`                                                                              |
| **Client-side preferences**  | Theme, language, persisted application state                                                                                               | UX continuity and offline/resume behavior. Basis: legitimate interest.                                              | `lib/utils/clientStorage.ts`, `lib/store/*Store.ts`, `public/sw.js`                                                                                                          |

---

## 4. How Data Is Used

Data is processed exclusively for the following purposes:

1. **Authentication and account management** -- Creating accounts, verifying identity, managing sessions.
2. **Academic planning** -- Providing the core features: unit management, deadline tracking, event scheduling, todo lists.
3. **Notifications** -- Delivering user-configured reminders and alerts through user-selected channels.
4. **Account security** -- Enforcing MFA, passkey authentication, CSRF protection, and abuse detection.
5. **Security monitoring** -- Logging security events for incident investigation and threat detection.
6. **Feature delivery** -- Providing map routing and weather data when explicitly requested by the user.

Data is not used for profiling, automated decision-making, or any purpose not listed above.

---

## 5. Cookies and Client-Side Storage

| Storage Mechanism      | Name / Key                  | Purpose                                           | Duration                          |
| ---------------------- | --------------------------- | ------------------------------------------------- | --------------------------------- |
| Secure HTTP cookie     | `sb-access-token`           | Supabase session access token                     | Session (refreshed automatically) |
| Secure HTTP cookie     | `sb-refresh-token`          | Supabase session refresh token                    | 7 days (configurable)             |
| Secure HTTP cookie     | `__Host-csrf`               | CSRF protection token (double-submit pattern)     | 24 hours                          |
| Browser localStorage   | Application preference keys | Persist UI state (theme, language, sidebar state) | Until logout or manual clear      |
| Browser sessionStorage | Transient application state | Short-lived UI state                              | Browser session                   |
| Service Worker cache   | API response cache          | Offline support and performance                   | Cleared on logout                 |

**Logout behavior:** All client-side storage is explicitly cleared on logout via `lib/utils/clientStorage.ts`. The service worker cache is purged through the `public/sw.js` message handler.

**Evidence:** `lib/supabase/middleware.ts`, `lib/security/csrf.ts`, `lib/utils/clientStorage.ts`, `public/sw.js`

---

## 6. Security Controls Protecting Personal Data

The following controls are implemented to protect the confidentiality, integrity, and availability of personal data:

| Control                             | What It Protects                                                                            | Evidence                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Row-Level Security (RLS)**        | Prevents any user from accessing another user's data at the database query-execution level  | `lib/supabase/schema.sql`, `supabase/migrations/20260108131028_add_user_id_and_rls_policies.sql` |
| **Encryption at rest (AES-256)**    | Protects stored data from unauthorized access to the storage medium                         | Supabase managed encryption                                                                      |
| **Encryption in transit (TLS 1.3)** | Protects data during transmission between client and server                                 | Vercel and Supabase platform configuration                                                       |
| **Input validation (Zod schemas)**  | Prevents injection attacks and ensures data integrity                                       | `app/api/_lib/middleware.ts`, `lib/schemas/auth.ts`                                              |
| **Rate limiting**                   | Prevents brute-force attacks against authentication endpoints                               | `lib/services/rateLimitService.ts`                                                               |
| **Token hashing**                   | Email verification tokens are hashed before storage, preventing replay from database access | `lib/security/emailVerification.ts`                                                              |
| **Cache-Control headers**           | Sensitive responses (MFA enrollment) include `no-store` to prevent caching                  | `app/api/auth/mfa/enroll/route.ts`                                                               |
| **PII redaction in audit logs**     | Sensitive payload data is stripped by `sanitizeForAudit` before storage                     | `lib/security/audit.ts`                                                                          |

---

## 7. Third-Party Data Processors

The following third-party services process data on behalf of the application. Each service receives only the minimum data necessary for its function.

| Processor                             | Purpose                                       | Data Shared                                                           | Data Handling                                                               |
| ------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Supabase** (Supabase Inc.)          | Authentication, database, file storage        | Account identifiers, application data, security/audit records         | Encrypted at rest (AES-256), RLS enforced, hosted in managed infrastructure |
| **Resend** (Resend Inc.)              | Transactional email delivery                  | Recipient email address, verification message content                 | Processed for delivery only, subject to Resend's data processing agreement  |
| **Google Maps Platform**              | Map routing and place search                  | Coordinates and place identifiers submitted by user action            | Processed per Google's data processing terms                                |
| **Google Weather API**                | Weather information display                   | Geographic coordinates (latitude/longitude)                           | Coordinates used for lookup only                                            |
| **Upstash** (Upstash Inc.)            | Distributed rate-limit counters               | Derived request identifiers (hashed IP + route prefix), counter state | No PII stored; only rate-limit metadata                                     |
| **Vercel** (Vercel Inc.)              | Application hosting, edge compute, cron jobs  | HTTP request metadata (IP, headers), application runtime              | Subject to Vercel's data processing agreement                               |
| **Sentry** (Functional Software Inc.) | Error and performance monitoring (if enabled) | Runtime diagnostic metadata, error context, stack traces              | PII scrubbing configured; subject to Sentry's DPA                           |

**Evidence:** `lib/services/emailService.ts`, `app/api/navigate/route.ts`, `app/api/weather/route.ts`, `lib/services/rateLimitService.ts`, `config/sentry/sentry.client.config.ts`

---

## 8. Data Retention and Deletion

### 8.1 Automated Retention Policies

| Data Type                     | Retention Period | Mechanism                             | Evidence                                                                   |
| ----------------------------- | ---------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| Email verification tokens     | 20 minutes       | Expiry timestamp, cleaned by cron job | `lib/security/emailVerification.ts`, `app/api/auth/email/cleanup/route.ts` |
| WebAuthn challenges           | 5 minutes        | Expiry timestamp, deleted after use   | `lib/security/webauthn.ts` (line 19: `CHALLENGE_EXPIRY_MINUTES = 5`)       |
| In-memory route/weather cache | 5 minutes        | TTL-based eviction                    | `app/api/navigate/route.ts`, `app/api/weather/route.ts`                    |
| Client-side storage           | Until logout     | Explicit clearing on logout           | `lib/utils/clientStorage.ts`                                               |

### 8.2 Account Deletion (Right to Erasure)

When a user deletes their account, a cascaded deletion flow removes all associated data:

- User profile and all academic data (units, deadlines, events, todos)
- Notification records and preferences
- WebAuthn credentials and challenges
- Audit log entries associated with the user
- Session data and authentication tokens

### 8.3 Known Retention Gaps

The following retention policies are not yet codified and should be addressed:

- **Audit logs:** No automated retention window is currently enforced. A 90-day retention policy with scheduled deletion is recommended.
- **Rate-limit counter state:** Ephemeral by design (Redis TTL), but the exact cleanup behavior should be documented.

---

## 9. User Rights and Controls

The following data subject rights are supported:

| Right                   | How to Exercise                                                    | Evidence                                                              |
| ----------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| **Access**              | View profile data and settings through the application UI          | `app/api/profiles/route.ts`                                           |
| **Rectification**       | Update profile fields through the settings page                    | `app/api/profiles/route.ts` (PATCH)                                   |
| **Erasure**             | Delete account through settings, triggering cascaded data deletion | Account deletion flow                                                 |
| **Data portability**    | Export application data via the settings export utility            | `lib/hooks/useDataExport.ts`                                          |
| **Restrict processing** | Disable specific notification channels via preferences             | `lib/store/notificationPreferencesStore.ts`                           |
| **Withdraw consent**    | Sign out (clears all sessions), unenroll from MFA, delete account  | `app/api/auth/signout/route.ts`, `app/api/auth/mfa/unenroll/route.ts` |
| **Session management**  | View active sessions, revoke individual or all sessions            | `app/api/auth/sessions/route.ts`                                      |
| **Password management** | Change password (triggers session termination on other devices)    | `app/api/auth/password/route.ts`                                      |
| **MFA management**      | Enroll in, verify, and unenroll from MFA factors                   | `app/api/auth/mfa/*`                                                  |

---

## 10. Children's Privacy

Syllabus Sync is designed for university students and is not directed at children under the age of 16. We do not knowingly collect personal data from children.

---

## 11. International Data Transfers

Application data is processed through Supabase (infrastructure region selected at project creation) and Vercel (edge network with global presence). Where data is transferred outside the user's jurisdiction, it is protected by the data processing agreements of the respective service providers, which include Standard Contractual Clauses where required by GDPR.

---

## 12. Policy Updates

Changes to this privacy policy will be reflected by updating the "Last Updated" date at the top of this document. Material changes that affect user rights will be communicated through the application's notification system.

---

## 13. Contact

For privacy or data protection questions about this repository and its documentation:

- **Non-sensitive repository questions:** open a GitHub issue or discussion with the minimum detail needed to describe the concern
- **Sensitive privacy or security concerns:** use the private reporting flow in [SECURITY.md](../../SECURITY.md)
- **Security policy:** see [security-policy.md](./security-policy.md) for the full disclosure program
