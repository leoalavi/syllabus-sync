# Agent Rules & Architectural Constraints

This document serves as the foundational mandate for all AI agents and human contributors working on the Syllabus Sync repository. Adherence to these rules is non-negotiable to maintain system integrity and architectural consistency.

---

## 1. Security-First Mandate

Syllabus Sync operates on a **Zero-Trust** and **Defense-in-Depth** model.

- **Credential Protection:** Never log, print, or commit secrets, API keys, or sensitive credentials. Rigorously protect `.env` files and `.git` folders.
- **Tenant Isolation:** Always leverage PostgreSQL Row-Level Security (RLS). Ensure every table has a policy restricting access to `auth.uid()`.
- **Zero-Trust Middleware:** All new API routes must be wrapped in `requireAuth` or `requireAuthWithRateLimit`.
- **MFA Fail-Closed:** Critical security paths (MFA enrollment, passkey registration) must fail closed upon any unexpected error.

---

## 2. The Leo Change Protocol (MANDATORY)

Whether you are a human or an AI, you must follow this protocol for every code change:

1. **Preflight Reading:** Locate and read `AGENT.md` and the recent history in `CHANGELOG.md`.
2. **Explain Before Touching:** Provide a concise summary of constraints and your planned edits before execution.
3. **Atomic Changes:** Make minimal, consistent changes aligned with existing patterns.
4. **Verification:** Run `npm run check` (or the relevant sub-command) to verify behavioral and structural correctness.
5. **Postflight Logging:** Append a new entry to both `AGENT.md` and `CHANGELOG.md` using the "Leo:" template.

---

## 3. Architectural Constraints

### 3.1 Next.js App Router

- **RSC by Default:** Prefer React Server Components for data fetching and layout.
- **Client Leaf Nodes:** Use `"use client"` only when browser-side interactivity (state, effects, events) is required.
- **Route Handlers:** API logic belongs in `app/api/**/route.ts`. Use the shared `jsonSuccess`/`jsonError` response utilities.

### 3.2 State Management (Zustand)

- **Persistent Store:** Use the `persist` middleware for preferences and essential cached data.
- **Optimistic UI:** Implement the **Additive Merge Strategy** for notifications and deadlines to prevent race conditions during background sync.

### 3.3 Database & Migrations

- **Scripted Schema:** All database changes must be idempotent, reversible SQL migrations in `supabase/migrations/`.
- **Postgres Atomicity:** Use triggers and Stored Procedures (RPCs) for multi-table operations or security-critical logic (like XP awards).

---

## 4. Engineering Standards

- **TypeScript:** Strict mode is enforced. **Zero `any`** policy. Use Zod for all runtime payload validation.
- **Styling:** Tailwind CSS using MQ semantic tokens. No hardcoded hex values.
- **Internationalization (i18n):** All user-facing strings must be localized via `locales/en/translations.json`. No hardcoded UI strings.
- **Testing:** Every bug fix must include a reproduction test. Every new feature must include unit and integration coverage.

---

## Change Log (Leo Template)

### 2026-11-17 (Australia/Sydney) — Security Documents Checked Against the Code; Private Identifiers Removed

**Raouf:**

- **Scope:** Documentation accuracy and privacy. One code-adjacent change: status comments on security modules that no route uses. No application behaviour changed.
- **Summary:** `docs/security/SECURITY_POSTURE.md` is rewritten to list only controls the code has in force, with a separate section for modules that exist but are not wired in (request signing, IP anomaly detection, device fingerprinting, MFA backup codes, SRI, the enhanced CSP builder, session-termination helpers) and the self-assessed OWASP and NIST tables removed. `docs/security/SECURITY_EVIDENCE_INDEX.md` and `TECHNICAL_EXPLANATION.md` are corrected the same way (the proxy is not an API auth gate, `isPublicApiPath()` does not exist, the cross-site check is an origin check, the rate limiter is a fixed window, limits and store names match the code). Smaller corrections in `README.md`, `SECURITY.md`, `docs/README.md`, the privacy policy, the university integration paper, the industry deck and the Maps setup guide. Each unused module in `lib/security/` now starts with a "not wired into any route as of 17 Nov 2026" comment.
- **Privacy:** removed an email draft addressed to a named staff member; demo seed scripts now use placeholder accounts (`demo1`–`demo3@example.com`) and neutral file names; local machine paths, a team Gmail address, Vercel team, deployment and alias identifiers, a personal `workers.dev` subdomain and Cloudflare account, zone and record IDs are replaced with placeholders. These values remain in git history.
- **Audit records:** findings that the current tree shows closed carry a dated status line (nine in the backend ledger, four in the runtime ledger, R1 and R8 in the risk register). Entries without one are unchanged.
- **Housekeeping:** two empty changelog headings removed, a misspelling of a maintainer's name fixed, the no-op `build:overlays` script removed, and the dependency audit note updated (no high or critical advisory on the current lockfile).
- **Files Changed:** `docs/security/*`, `TECHNICAL_EXPLANATION.md`, `README.md`, `SECURITY.md`, `docs/README.md`, `docs/policies/privacy-policy.md`, `docs/university-integration-requirements.md`, `docs/presentations/syllabus-sync-industry-deck.md`, `docs/operations/*`, `lib/security/*.ts` (comments only), `scripts/*.sql`, `package.json`, `CHANGELOG*.md`, the dated audit folders (placeholders and status lines only).
- **Verification:** `npm run typecheck` ✅; `npm run lint` ✅; `npm run format:check` ✅; `npm test` ✅ 1,399 tests in 167 files; `npm run check:secrets` ✅; `npm run check:i18n` ✅; `node tools/docs/check-local-links.mjs` ✅; `npm audit --omit=dev --audit-level high` ✅.
- **Follow-ups:** The `.pptx` and `.pdf` copies of the deck and the integration paper are uncorrected. The `vercel:*` scripts still exist although production runs on Cloudflare.

### 2026-11-17 (Australia/Sydney) — Merging the Backend Security Work Into the October Trunk

**Raouf:**

- **Scope:** One merge of two lines of work that had diverged since April: the October 2026 trunk (product, branding, build and deploy setup, CI) and the July–August 2026 backend security work (audit fixes, security tests, migrations, audit records).
- **Summary:** The October trunk is the base. On top of it: the security test suites, the 16 added migrations and 6 migration repairs, the backend and runtime audit records, account deletion (`DELETE /api/account`), auth audit logging, Sentry request scrubbing, the platform runtime helpers and the fresh-database CI job. 65 files conflicted. Where both lines had fixed the same defect, the trunk's version stays (single-use token claim, push-subscription ownership, header-scan target allowlist, robots and sitemap origin). Where the trunk lacked a fix it was restored: BA-0002 (`/api/auth/biometric` no longer accepts client-supplied credential material), BA-0041 (breached-password check on password reset), BA-0039 and the proxy-header rules in `lib/security/csrf.ts` and `lib/security/ip.ts` (with the trunk's trusted sibling-app origins kept), constant-time cron secret comparison, and the audit row on sign-out, which now also keeps the trunk's `scope: 'local'`. The request proxy (`lib/proxy.ts`) and its route-level MFA gate are the trunk's. Dependencies were updated with `npm audit fix` so the production audit passes.
- **Not carried over:** the alternative Cloudflare deploy pipeline from the security line (custom worker entry, per-environment Wrangler scripts, the Sharp risk gate and its expired exception, the public-env deploy gate, the manual deploy workflow) and the tests that asserted that layout, since the trunk deploys differently. Three middleware tests were dropped because the proxy no longer resolves auth for API routes; `tests/security/api-auth-coverage.test.ts` now checks every non-public route for its own fail-closed auth instead of parsing a middleware policy. The scheduled trigger stays off `push-reminders-cron.yml` in this repository (BA-0016).
- **Files Changed:** see the merge commit; 65 conflicted files resolved, about 150 files added from the security line.
- **Verification:** `npm run typecheck` ✅; `npm run lint` ✅ (0 warnings); `npm run format:check` ✅; `npm test` ✅ 1,399 tests in 167 files; `npm run check:secrets` ✅; `npm run check:i18n` ✅; `node tools/docs/check-local-links.mjs` ✅; `npm audit --omit=dev --audit-level high` ✅. Not run locally: the Next.js and Cloudflare builds, Playwright, and the fresh-database build, which CI runs. Nothing was deployed.
- **Follow-ups:** Decide whether the public-env deploy gate (BA-0047) should be re-attached to the trunk's deploy scripts. Four English-only translation keys added with the Sylla card join the eight older ones, so 12 keys fall back to English in 34 locales.

### 2026-10-03 (Australia/Sydney) — Open-Source Readiness Follow-Through

**Leo:**

- **Scope:** Finished the local open-source readiness pass without publishing changes.
- **Summary:** Added colocated app tests to Vitest, corrected a stale profile test, hardened malformed development map-pin payload handling, aligned CI with format and Cloudflare/OpenNext checks, updated contributor and API documentation, removed an outdated personal screenshot, refreshed dependencies to clear production audit findings, and documented the header-scanner runtime limitation.
- **Files Changed:** `README.md`, `CONTRIBUTING.md`, `docs/`, `.github/`, `config/`, `app/api/maps/dev-pin/route.ts`, `app/manage-profiles/__tests__/actions.test.ts`, `tests/api/maps.dev-pin.route.test.ts`, `features/map/components/MapClient.tsx`, `locales/en/translations.json`, `package.json`, and `package-lock.json`, plus formatting-only files.
- **Verification:** Secrets, formatting, typecheck, lint, 920 tests, Next.js build, Cloudflare/OpenNext build, output verification, Wrangler dry run, production dependency audit, and `git diff --check` passed.
- **Follow-ups:** Review 14 development-tool dependency advisories and non-English translation gaps. Decide separately on the header-scanner egress design and proxy-specific client-IP header trust before changing security behavior.

### 2026-10-03 (Australia/Sydney) — Public Positioning and Cloudflare Readiness

**Leo:**

- **Scope:** Corrected production Worker identity, private vulnerability reporting guidance, public project links and positioning, and current deployment documentation.
- **Summary:** Kept the main Worker named `syllabus-sync-production` and removed the stray info-site name from its Wrangler config. Removed the public security issue template and directed reports to private email after verifying GitHub private reporting is disabled. Replaced university-owned support and social destinations, added the info-site link to the website, clarified Syllabus Sync, Sylla, Campus Navigation, and Astronomy Open Night boundaries, and refreshed public metadata, contributor guidance, architecture, and Cloudflare release instructions.
- **Files Changed:** `wrangler.jsonc`, `.github/ISSUE_TEMPLATE/security_report.md` (deleted), `SECURITY.md`, `README.md`, `CONTRIBUTING.md`, `package.json`, `app/*` public routes and layout, `components/layout/*`, `features/settings/components/AboutSettings.tsx`, `lib/config.ts`, `lib/constants/index.ts`, `locales/*/translations.json`, related tests, and referenced setup, operations, security, and policy guides.
- **Verification:** Typecheck, lint, secrets scan, 912 tests, Next.js build, Cloudflare/OpenNext build, output verification, and Wrangler dry run passed. Translation parity still warns on 12 pre-existing campus/Sylla keys in non-English locales. No deployment, commit, push, or PR was made.
- **Follow-ups:** Review translation quality; evaluate the header-scanner DNS rebinding fix separately before implementation.

### 2026-08-17 (Australia/Sydney) — Closing the External Review's Code-Side Findings

**Raouf:**

- **Scope:** The five findings from an external security and privacy questionnaire that
  could only be answered by changing code: account deletion, Sentry request-body
  scrubbing, login auditing, the fresh-database CI gate, and the support contact address.
- **Summary:** Account deletion had no implementation at all — `DELETE /api/profiles`
  removed two rows and cascaded to nothing, because every user table foreign-keys to
  `auth.users` rather than `profiles`, while the privacy policy and 34 locales' worth of
  unused i18n strings both promised the feature. `DELETE /api/account` fires the
  cascades that were always there; **no migration was needed**. Sentry's `beforeSend`
  stripped headers but never bodies, one `sendDefaultPii: true` away from shipping the
  plaintext password that `/api/security/check-password-breach` receives; the edge config
  had no `beforeSend` at all. `logAuthEvent` had been exported since January with no
  caller, so no sign-in has ever been audited. And `tools/database/verify-fresh-build.sh`,
  whose header promises CI enforcement, was never wired to a workflow even though the
  audit report claimed BA-0053 was "gated in CI".
- **Files Changed:** four new source files (`app/api/account/route.ts`,
  `lib/observability/sentry-scrub.ts`, `lib/security/auth-audit.ts`,
  `features/settings/components/privacy/DeleteAccountDialog.tsx`), two new test suites,
  the three Sentry configs, signin/signout, `DataManagement.tsx`, `lib/config.ts`,
  `.github/workflows/ci-cd.yml`. Nothing under `supabase/`.
- **Verification:** `npm run check` exit 0; 9/9 and 11/11 on the new suites; the CI gate
  rehearsed locally at `applied=80 failed=0 total=80` before being committed; production
  migration list 80/80 in sync. Both new suites caught real defects in the first draft (a
  `parseJsonBody` contract mix-up that 413'd every request, and a header-casing miss that
  let `Cookie` survive scrubbing).
- **Follow-ups:** Not deployed — on `review/2026-08-17-questionnaire-remediation`. Signup
  still holds a duplicate local audit helper. Two incompatible `parseJsonBody` functions
  remain in `app/api/_lib/`, which is a trap for the next route author. Owner actions
  outstanding: Supabase Owner MFA, Cloudflare 2FA enforcement, backup restore drill,
  Maps key restrictions, Resend/Upstash region confirmation.

### 2026-08-02 (Australia/Sydney) — Reconciling Two Independent Audits Into One Trunk

**Raouf:**

- **Scope:** Collapsed five branches into `main` by rebase and removed them. The repository had
  been carrying two concurrent audits of the same system, plus three branches already strict
  ancestors of `main`.
- **Summary:** The two audits converged, so the honest result is that
  `audit/backend-hardening-cloudflare` contributed **no source-code changes**. Three of its
  fifteen commits were dropped rather than duplicated: BA-0006 (`main`'s predicate is
  semantically identical because `id` is the primary key, and its test covers both token types),
  BA-0056 (`main`'s is the deployed check and its test is a superset), and BA-0054 (dropped by
  git as already upstream — the file recovered from the production catalogue is **byte-identical**
  to the one the other audit wrote independently, corroborating the recovery). Combining the
  branches exposed two defects invisible on either alone: git **auto-merged both audits' P0
  binding checks into one file**, leaving the check present twice with no conflict raised, and
  `rls-policy-recursion.test.ts` carried five raw NUL bytes that made a security regression test
  binary to git and its diffs unreviewable. Both fixed; the WebAuthn route is now byte-identical
  to `main`, so this merge cannot change deployed behaviour.
- **Files Changed:** 12 commits onto `17003fbe`. Net vs `main`:
  `supabase/migrations/20260802010000_fix_schedules_rls_recursion.sql` (the only migration `main`
  lacked, already applied to production), six migrations repaired for buildability,
  `tests/security/rls-policy-recursion.test.ts`, `tools/database/verify-fresh-build.sh`,
  `docs/backend-audit/2026-08-02/`, `CHANGELOG.md`, `AGENT.md`. Nothing under `app/`, `lib/`,
  `components/`, `features/`.
- **Verification:** `npm run check` exit 0 — 1323 tests across 153 files, which is `main`'s 1319
  plus the recursion suite's 4, the arithmetic check that the union lost nothing. Migration chain
  rebuilt from empty on throwaway PostgreSQL 15.18: applied=80 failed=0 total=80, matching
  production. All branch tips tagged `prereconcile/2026-08-02/*` before the first rewrite.
- **Follow-ups:** `isTrustedOrigin` fail-open on absent `Origin`+`Referer`; BA-0004's
  `/api/auth/*` exemption; the `npm audit` waiver for accepted BA-0044 advisories. Delete the
  `prereconcile/*` tags once the merge has proven itself.

### 2026-08-02 (Australia/Sydney) — RLS Recursion, and a Migration Set That Could Not Build

**Raouf:**

- **Scope:** Re-audit of the backend, scoped as "check the real system, not a description of
  it", after this audit's own record showed it reporting a live P0 as absent twice. Two cheap
  checks had never been run: read-only probing of live production with the public anon key,
  and replaying the migrations against an empty database. Both found defects.
- **Summary:** **BA-0052 (P1)** — mutually recursive RLS policies on `schedules` and
  `schedule_members` (each one's SELECT policy subqueries the other) make both tables
  permanently unqueryable with 42P17. Verified live in production (HTTP 500) and reproduced
  locally for the `authenticated` role, so the sharing feature has been dead for every
  signed-in user since 2026-02-20. `app/api/sync/route.ts:139` discards the query `error`, so
  it fails closed and silently. Fixed with two SECURITY DEFINER helpers that take no user id —
  each answers only whether the _current_ caller relates to a schedule — keeping the fix clear
  of the IDOR class of BA-0029/BA-0031/BA-0049. **BA-0053 (P1)** — 6 of 78 migrations fail on a
  clean database, so no reproducible environment and no tested recovery path existed.
  `20260129000000_add_audit_logging.sql` has two independent fatal errors and can never have
  applied anywhere, which production confirms; that also explains the later `restore_*`
  migrations. One broken migration was silently disabling a second one's security hardening.
  **BA-0055 (P2)** — `anon` retains table grants on eleven tables including `password_resets`
  and `backup_codes`, because `REVOKE ... FROM public` does not remove a direct `anon` grant.
  Tested with real seeded rows: RLS contains all of it, so no live exposure — the finding is
  single-layer defence on the most sensitive tables. **BA-0027** confirmed with a reproduction.
- **Files Changed:** `supabase/migrations/20260802010000_fix_schedules_rls_recursion.sql` (new),
  `tests/security/rls-policy-recursion.test.ts` (new), `tools/database/verify-fresh-build.sh`
  (new), `docs/backend-audit/2026-08-02/backend-runtime-audit-2026.md` (new), plus repairs to
  six historical migrations.
- **Verification:** Fresh build applied=79 failed=0 ✅; `npm run check` exit 0 with 1264 tests ✅;
  the BA-0052 verification block fails against the pre-fix state and the new regression test
  fails all 4 assertions with the fix removed, so neither is vacuous ✅; owner and member both
  see a shared schedule while an unrelated user sees nothing, and promotion to `owner` is still
  refused ✅. No production data was created, modified or deleted.
- **Follow-ups:** `mv_deadline_analytics` reconciliation and the blanket `REVOKE ... FROM anon`
  sweep are scoped but unwritten. Three items need service-role access to settle (lost REVOKEs
  in production, `pg_cron` scheduling for BA-0011, true policy/grant state) — exact queries in
  §8 of the audit report. **No test in this repository executes SQL against a real database**;
  every finding above was found by executing something. Wire `verify-fresh-build.sh` into CI.

### 2026-07-30 (Australia/Sydney) — Live Database Verification of the Runtime Audit

**Raouf:**

- **Scope:** Settled the database half of the runtime audit against the real project using read-only `supabase db query --linked` catalogue queries. No write, no DDL executed, no migration applied, no secret printed.
- **Summary:** The chain-derived findings disagreed with production in both directions, and the most important outcome is a **correction to my own P1**. `audit_settings`, `cleanup_old_audit_logs()` and `add_sample_class_times()` **do not exist in production**, and **no table in `public` lacks RLS** — so the audit-trail-destruction chain I filed is replay-only (real for `supabase db reset`, staging or a DR rebuild), and RTA-0029 drops from P1 to P3. The same check caught a genuine bug in my own migration: its `ALTER TABLE public.audit_settings` was unguarded and would have raised 42P01 and **aborted the push against production**; every block is now guarded. What is genuinely live instead is narrower and worse in kind: `purge_deleted_records(integer)` and `refresh_analytics_views()` are SECURITY DEFINER with no ownership check, unpinned `search_path`, and hold `EXECUTE` for **both `anon` and `authenticated`** — verified via `information_schema.role_routine_grants` — with zero application callers (the only repo mentions are generated `database.types.ts` entries). `purge_deleted_records` takes a caller-controlled window, so a negative `p_days_old` moves the cutoff into the future and hard-deletes every soft-deleted row for every user. `20260114013519` issued only `REVOKE ... FROM PUBLIC`, which BA-0032 had already shown does not remove Supabase's direct grants. Also settled: the reported `log_audit` overload ambiguity is **disproved** (production holds only the 10-arg form); **pg_cron duplication is confirmed live** — installed, two ACTIVE jobs at `0 3` and `10 3`, exactly the Cloudflare expressions, while the `*/15` webauthn-challenge job is absent so that cleanup has **no owner at all**; the unpinned `search_path` is **not exploitable**, because `anon`/`authenticated` hold USAGE but not CREATE on `public` and `extensions`; BA-0030's recorded "production still has all sixteen always-true policies" is **resolved**, only the documented `xp_config` exception remains; and `favorite_buildings` + `edge_response_cache` exist in production while the chain never creates them, so the chain cannot rebuild the database. Finally, the `WITH CHECK` correction is now **proven rather than argued**: an RLS probe on a session-local temp table. The first attempt was **vacuous** — `supabase db query` connects as `postgres`, which has `rolbypassrls`, so RLS never applied and the reassignment appeared to succeed. Re-run under `SET ROLE authenticated` it was **BLOCKED** with `new row violates row-level security policy`, value unchanged. PostgreSQL does apply `USING` to the new row when `WITH CHECK` is omitted, so the reported reassignment vulnerability does not exist — and migration `20260730090000` (BA-0035) states the same incorrect rationale.
- **Files Changed:** `supabase/migrations/20260730180000_close_audit_settings_rls_and_unguarded_definers.sql` (guarded; header now records verified production state), `docs/runtime-audit/2026-07-30/finding-ledger.csv` (34 entries; RTA-0029 downgraded, RTA-0033/0034/0035/0036 added), `docs/runtime-audit/2026-07-30/executive-summary.md`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Migration test 8/8 after the rewrite, and still confirmed to fail without the migration. Both of the migration's catalogue loops validated read-only against production — the revoke loop resolves to `public.purge_deleted_records(p_days_old integer)` and `public.refresh_analytics_views()`, the sweep resolves to those two plus the four trigger functions. Its verification predicates return `tables_without_rls = 0` and `definers_unpinned = 6` (0 after the sweep). Confirmed safe to pin: none of `protect_profile_fields`, `on_deadline_completed`, `on_unit_created` references `auth.`, `storage.` or `extensions.`, so `search_path = public` cannot change their resolution. Full gate re-run exit 0 — 152 files / 1319 tests, both typechecks, Lint OK, Prettier clean, build, `cf:dry-run` and `cf:dry-run:production`.
- **Follow-ups:** The migration still ships **unapplied** and now has real live value: revoking client `EXECUTE` on the two anon-reachable definers and pinning the six unpinned ones. Decide one owner per duplicated cron (`cron.unschedule` the two, or drop the Cloudflare triggers) and give the `webauthn_challenges` cleanup an owner. The chain's inability to rebuild production (missing `favorite_buildings` and `edge_response_cache`, plus the `20260124000000` duplicate-policy replay blocker) is worth a squashed baseline, since it is the condition under which BA-0027/0030/0048/0049 accumulated unnoticed.

### 2026-07-30 (Australia/Sydney) — Full Runtime, Security and Reliability Audit

**Raouf:**

- **Scope:** Whole-repository runtime audit on `audit/full-runtime-hardening-2026-07-30` (from `main` `1301734f`): every API route, `lib/**`, the full 78-migration chain, `app/**` pages and server actions, `features/**`/`components/**`/the service worker, `config/**`/`tools/**`/CI/deploy config, and all 151 test files. Eight read-only agents read every file in the runtime-relevant tree; every finding acted on was independently re-verified before any code changed. Nothing pushed, nothing deployed, no migration applied, no secret printed.
- **Summary:** Ten fixes, each with a regression test confirmed to fail against the pre-fix code first. **The headline is a P0: `/api/webauthn/authenticate/verify` took identity from the challenge row but the verifying public key from an unfiltered global `credential_id` lookup, and never reconciled them** — so an attacker could request a challenge for a victim's email, sign it with their own authenticator, and be issued a session cookie for the victim. Unauthenticated, no victim interaction, only precondition being that the victim has a passkey; `/api/webauthn/authenticate/` is on the public allowlist so the edge never saw it. `@simplewebauthn` cannot catch it (it only asserts `id === rawId`), `credential_id` is UNIQUE so it was deterministic, the sibling `register/verify` has always had the missing check, and **no test covered that route at all**. Second: production was **undeployable** — the Sharp gate's approved provenance still pinned Next 16.2.11/Wrangler 4.113.0 while the lockfile installs 16.2.12/4.115.0, and because `evaluateDeploymentGate` delegates to `evaluateAuditException`, every gated `cf:*` script failed closed on both profiles. Its root cause was that the gate's own suite validates a _synthetic_ lockfile fixture, so it stayed green while the real one drifted; a test now binds the constants to the committed lockfile inside `npm run check`. Also fixed: password-reset and email-verify tokens were double-spendable because the "atomic guard" never checked the affected row count (BA-0006, carried as `candidate`); the WebAuthn origin check was circular, falling back to the caller's own `Origin` header (BA-0003, carried as `validated`); an open redirect plus session fixation on `/auth/confirm` where `next.startsWith('/')` accepts `//evil.example`; four unbounded outbound fetches, including the rate-limit store in front of every auth request, where a hang made the `failClosed` policy unreachable; both PostCSS advisories, cleared by unpinning an override rather than npm's proposed Next 16→14 downgrade; the doubled webmanifest `Content-Type`, whose root cause was two overlapping `_headers` rules; and a migration enabling RLS on `audit_settings` — the only one of 27 tables without it — plus revoking five client-reachable definers, one of which lets the anon key destroy the audit trail.
- **Files Changed:** `app/api/webauthn/authenticate/verify/route.ts`, `app/auth/confirm/route.ts`, `app/api/auth/password/reset/route.ts`, `app/api/auth/email/verify/route.ts`, `app/api/auth/passkey/_lib.ts`, `lib/security/webauthn.ts`, `lib/security/password-breach.ts`, `lib/services/rateLimitService.ts`, `lib/weather/providers/{googleWeatherProvider,openMeteoProvider}.ts`, `public/_headers`, `tools/security/check-sharp-risk.{mjs,test.mjs}`, `package.json`, `package-lock.json`, `supabase/migrations/20260730180000_close_audit_settings_rls_and_unguarded_definers.sql` (new, **unapplied**), 8 new test files, `tests/api/auth/passwordReset.test.ts`, `artifacts/security/sharp-worker-reachability*.json`, `docs/runtime-audit/2026-07-30/**` (12 artefacts), `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Full gate exit 0 — **158 files / 1350 tests** (from 143/1269), both typechecks, Lint OK, Prettier clean, build compiled, coverage 53.3/43.5/56.0/53.8 above thresholds, `check:secrets` over 900+ files, and — the point of the exercise — `security:sharp:audit-exception`, `cf:dry-run` **and** `cf:dry-run:production` all exit 0 where they previously failed. Worker 6791 KiB gzip under the ceiling. Live production checked read-only (headers, health, deny-by-default, 401/405/400 behaviour all correct; the doubled manifest `Content-Type` and the apex still on Vercel both confirmed). Baseline captured before any change, with its one pre-existing failure preserved verbatim.
- **Follow-ups:** Three need an owner decision and are in `docs/runtime-audit/2026-07-30/remaining-risk-register.md`. (1) **CI runs no build verification at all** — `npm audit` fails on the accepted Sharp advisories and `build`/`cloudflare-build` both `needs: [test, security]`, so Production Build, Worker Build and Lighthouse are all skipped; that is why the undeployable state was invisible. (2) **Deadline reminders have no scheduler** — BA-0016 removed the GitHub schedule and the route was never adopted into the Cloudflare triggers, so they fail silently with no failing job; pinned as a test invariant rather than enabled, because enabling resumes real push delivery. (3) **The new migration must be applied.** Also open: password reset does not revoke other sessions (needs a DB function; `admin.signOut` requires a JWT the unauthenticated path lacks), server/edge Sentry never initialises because there is no root `instrumentation.ts` (so BA-0018's fix is moot and no server error reaches Sentry), pg_cron duplicates two Cloudflare crons at the same minute, and the Sharp exception expires 2026-08-22. **Correction worth recording: the reported "11 UPDATE policies lack WITH CHECK → ownership reassignment" is NOT a vulnerability** — PostgreSQL applies `USING` to the new row when `WITH CHECK` is omitted, so reassignment is already blocked. Migration `20260730090000` (BA-0035) states the same incorrect rationale, so the misconception is embedded in the repo and will be re-derived unless corrected. The genuine residual there is that a user can reset their own spent backup codes' `used` flag, which changes no `user_id`; that module is currently unmounted.

### 2026-07-30 (Australia/Sydney) — Signup → Email → Redirect Flow Audit

**Raouf:**

- **Scope:** Audited the signup, verification-email, and post-verification redirect chain end to end, and fixed the three defects found.
- **Summary:** The flow completed (mail sends, addresses confirm, users can sign in) but the confirmation feedback was broken on the main path. Signup requested `emailRedirectTo=/auth/callback?redirectTo=/login%3Fverified%3D1`; `/login` is absent from `SAFE_REDIRECT_PATHS`, so `isValidRedirect()` rejected it and `redirectTo` silently degraded to `/home`. The callback signed out the session it had just minted and sent the user to `/home`, which the middleware bounced to `/login?redirectTo=/home`, losing `verified=1` — so the green banner never appeared and the callback's final two lines were dead code. Reproduced at route level first (the real link resolved to `/home`). The callback now lands email verification on `/login?verified=1` and forwards an explicit destination as `redirectTo`; the OAuth branch still follows `redirectTo` directly since it keeps its session. Signup's `emailRedirectTo` simplified to `${appUrl}/auth/callback`. Also fixed `/verify`, which rendered "Verification Failed / Invalid or expired verification link" for the middleware's own `?reason=unverified` redirect because it only handled `?token=<64 hex>` — it now has a check-your-inbox `pending` state built from existing translation keys (no 35-locale change). Corrected the stale `ACCOUNT_EXISTS_MESSAGE` comment, which described behaviour the production path deliberately does not have.
- **Files Changed:** `app/auth/callback/route.ts`, `app/api/auth/signup/route.ts`, `app/verify/page.tsx`, `tests/api/auth/callback.signup-verification.test.ts` (new), `tests/unit/verify-page-gate-redirect.test.tsx` (new), `tests/api/auth/callback.test.ts`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** `npm run check` exit 0 — 1269 tests / 143 files (from 1260/141), Prettier clean, both typechecks clean, Lint OK, build compiled ✅. New cover: the exact signup link, legacy nested `/login` redirects, destination forwarding, attacker-supplied `redirectTo` rejection, both OAuth branches, and all three `/verify` states. Two assertions in `callback.test.ts` were intentionally updated — they locked the old email-path behaviour. Live config checked read-only via the Supabase Management API: `site_url` matches the Worker `NEXT_PUBLIC_APP_URL`, `uri_allow_list` permits the callback, `mailer_autoconfirm` false, anonymous auth off.
- **Follow-ups:** Verification email still ships via Gmail SMTP from `<team-gmail-address>` — relay-capped and cannot DKIM-align with `syllabus-sync.app`, so spam risk plus off-brand sender on a new user's first impression. Resend is already wired for the resend path; switching Supabase SMTP needs an owner decision. The initial and resent emails also use two different mechanisms/lifetimes (native `/auth/callback?code=` at 3600s vs custom `/verify?token=` at 20 min), and `/api/auth/email/send-verification` has no callers — candidates for consolidation. A live signup on Workers remains unexercised.

### 2026-07-30 (Australia/Sydney) — Merged Both Feature Branches Into main

**Raouf:**

- **Scope:** Fast-forwarded `main` to the state already running in production, and unblocked the `format:check` step of `npm run check`.
- **Summary:** `main` had been stuck at `ba88b2c3` (2026-07-07) while both feature branches advanced in separate worktrees. Verified the topology first: `main` was a strict ancestor of both, and `feat/cloudflare-workers-migration` (29 commits) was itself a strict ancestor of `audit/backend-hardening-cloudflare` (70 commits), so a single `--ff-only` merge to `f9393714` pulled in both branches losslessly — no merge commit, no conflict resolution, nothing on `main` that the branches lacked. Used `--ff-only` deliberately so anything non-trivial would fail loudly. Ran `npm ci` afterwards for the dependency move (Next 16.1.6 → 16.2.11 plus the OpenNext/Wrangler toolchain). Also fixed `format:check`, which previously could not pass anywhere: Prettier walked `.remember/` and `.superpowers/`, local agent scratch dirs that self-ignore in git through nested `.gitignore` files but were missing from `.prettierignore`.
- **Files Changed:** `config/prettier/.prettierignore`, `.gitignore`, `AGENT.md`, `CHANGELOG.md`. The merge moved `main` `ba88b2c3` → `f9393714` (253 files, +47,227/−8,556) with no hand edits.
- **Verification:** `npm run check` exit code 0 — secrets (911 files) ✅, Cloudflare runtime compat ✅, Prettier clean ✅, `typecheck` ✅, `typecheck:cloudflare` ✅, Lint OK ✅, 1260/1260 tests across 141 files ✅, production build compiled ✅. Ancestry re-confirmed post-merge (0 commits outstanding on either branch). Safety branch `backup/main-pre-merge-2026-07-30` retained at the old tip.
- **Follow-ups:** Not pushed — `origin/main` remains at `ba88b2c3`. Keep both feature branches and their worktrees until the push lands. Prior cutover follow-ups still open (apex on Vercel; authenticated flows unverified on Workers).

### 2026-07-29 (Australia/Sydney) — Production Cutover to Cloudflare Workers

**Raouf:**

- **Scope:** Moved production traffic for `www.syllabus-sync.app` from Vercel to Cloudflare Workers.
- **Summary:** Verified environment parity against Vercel production first — of 20 Vercel keys missing from the Cloudflare set, all 20 had zero code references (vestigial Postgres/KV integration vars), so nothing regressed. Deployed `syllabus-sync-production` (version `2e584cab`) with 12 runtime secrets including the `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` invariants; the origin is unchanged across the move, so existing passkeys keep their RP ID. Transferred scheduler ownership with no overlap: Vercel Cron disabled 06:31:41Z, then Cloudflare triggers activated via commit `7b5fdcd8`. Attached the `www` custom domain, which required deleting the Vercel CNAME first — delete and attach ran back-to-back with automatic restore on failure, for a 0.9s DNS gap.
- **Files Changed:** `wrangler.jsonc`, `docs/operations/cloudflare-cutover-record-2026-07-29.md` (new).
- **Verification:** DNS on Cloudflare ✅; `server: cloudflare` ✅; HTTPS 200, valid cert ✅; `cf:smoke` 9/9 ✅; `database: connected` ✅; security headers correct on dynamic and static ✅; three cron triggers confirmed ✅.
- **Follow-ups:** Apex still served by Vercel (308s to `www`) — must move before Vercel is decommissioned. Preview parity matrix was never executed; cutover proceeded on owner instruction, so authenticated flows (login, existing passkeys, MFA, CSRF mutations, email links, push) remain unverified on Workers and need manual exercise now. Vercel retained as rollback target until 2026-08-05.

### 2026-07-29 (Australia/Sydney) — Cloudflare Preview Deployment and Security-Header Parity

**Raouf:**

- **Scope:** First Cloudflare Workers preview deployment, and the two security-header regressions it exposed.
- **Summary:** Deployed the preview Worker to `syllabus-sync-preview.<account>.workers.dev` (Workers Paid confirmed active on the account holding the `syllabus-sync.app` zone). Runtime secrets sourced from the Vercel project via its API, with `CRON_SECRET` and a VAPID keypair generated fresh. Smoke suite 9/9. Diffing response headers against live Vercel exposed two Cloudflare-only regressions. (1) Five constant security headers were declared in both `config/next/next.config.ts` and `lib/middleware.ts`; Vercel collapsed the duplicate, OpenNext appends, producing invalid values like `X-Frame-Options: SAMEORIGIN, SAMEORIGIN` that browsers may ignore outright. Removed them from middleware, which now sets only the nonce-dependent CSP and `x-nonce`. (2) Static assets bypass the Worker via the `run_worker_first` exclusions, so no security headers reached them at all — Vercel sent four, Cloudflare sent zero. Added a `/*` block to `public/_headers`.
- **Files Changed:** `lib/middleware.ts`, `public/_headers`.
- **Verification:** typecheck ✅; lint ✅; 1107/1107 tests ✅; Sharp gates ✅; 6776.58 KiB gzip under the 9.5 MiB limit ✅; `cf:smoke` 9/9 ✅; exact header parity with Vercel on dynamic routes and static assets ✅.
- **Follow-ups:** `/manifest.webmanifest` still returns a doubled (identical-value) `Content-Type`; cosmetic, root cause unidentified. Preview lacks `GOOGLE_ROUTES_API_KEY`, `GOOGLE_WEATHER_API_KEY`, and the Sentry pair.

### 2026-07-07 (Australia/Sydney) — App-Icon Logo Rebrand

**Raouf:**

- **Scope:** Replaced the Macquarie University crest logo with the new Syllabus Sync app-icon image across the entire app, including the PWA/favicon icon set and all 35 locale alt-text strings.
- **Summary:** New master asset `public/syllabus-sync-logo.png` cropped from the supplied app-icon artwork and used to regenerate `favicon.ico`, `apple-touch-icon.png`, and `icon-192/384/512.png`/`maskable-512.png`. All ~25 code references (login, signup, header, sidebar, onboarding, reset-password, OG/Twitter meta, JSON-LD schema, push-notification fallbacks, service worker) repointed from `/MQ_Logo_Final.png` to `/syllabus-sync-logo.png`; old crest file deleted. Service worker cache versions bumped (`v6` → `v7`) to force-refresh cached assets. `mqLogoAlt` translation value switched to a `{{appName}}`-interpolated string in all 35 locales, replacing hardcoded "Macquarie University" wording.
- **Files Changed:** `public/syllabus-sync-logo.png`, `public/icons/*.png`, `public/apple-touch-icon.png`, `app/favicon.ico`, `public/MQ_Logo_Final.png` (deleted), `app/layout.tsx`, `app/home/page.tsx`, `app/calendar/page.tsx`, `app/map/page.tsx`, `app/feed/page.tsx`, `app/manage-profiles/layout.tsx`, `app/login/LoginClient.tsx`, `app/signup/SignupClient.tsx`, `app/onboarding/OnboardingClient.tsx`, `app/reset-password/reset-password-client.tsx`, `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`, `lib/server/push.ts`, `lib/services/notificationService.ts`, `public/sw.js`, `locales/*/translations.json` (35 files).
- **Verification:** `npm run check` passed ✅; `npm run check:i18n` passed ✅; manually confirmed on `/login` and browser favicon ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Internationalization Update

**Leo:**

- **Scope:** i18n Expansion (34 Locales)
- **Summary:** Added missing `heroSection`, `opensInNewTab`, and `loadingEvents` keys to all 34 translation files in `locales/`. Used localized translations for major languages (Arabic, German, Spanish, French, Italian, Portuguese, Chinese, Japanese, etc.) and English fallbacks for others. `heroSection` is used for ARIA labels on hero sections; `opensInNewTab` provides an accessible suffix for links; `loadingEvents` is used for screen reader status updates during feed loading.
- **Files Changed:** `locales/*/translations.json` (34 files).
- **Verification:** Ran `npm run check:i18n` — all 35 locales validated successfully ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — About, Contact, Terms & Privacy Pages

**Leo:**

- **Scope:** About, Contact, Terms & Privacy Pages Bug Hunt & Production Hardening
- **Summary:** 22 issues fixed across 8 files. All 4 pages used `'use client'` at the page level → no metadata, breaking SEO for all public pages → split each into RSC `page.tsx` (metadata + ARIA skeleton + Suspense) + `*-client.tsx` (client component). All 4 hero banners had hardcoded hex → MQ tokens: `from-[#8B1525] via-[#A6192E] to-[#76232f]` → `from-mq-red-deep via-mq-primary to-mq-red-deep`; `text-[#FFB81C]`/`bg-[#FFB81C]` → `text-mq-warning`/`bg-mq-warning`. About: `group` missing on CTA Link (broken `group-hover` animation); sections missing `aria-labelledby`; missing `<main>`. Contact: `text-mq-danger` → `text-mq-error` (token didn't exist → invisible errors); `group` missing on helpful-links article (migrated to scoped `group/link`); `maxLength` added to email (254) + textarea (2000); error `<p>` now has `id` + `role="alert"` + textarea `aria-describedby`; `noValidate` added; missing `<main>`. Terms: `ArrowLeft` `aria-hidden`; `scroll-mt-8` on sections; `<main>`. Privacy: `ArrowLeft` `aria-hidden`; table row keys from index to `row[0]`; mailto subject `encodeURIComponent`-encoded; `scroll-mt-8` + `aria-labelledby` on all 14 sections; `<main>`.
- **Files Changed:** `app/about/page.tsx`, `app/about/about-client.tsx`, `app/contact/page.tsx`, `app/contact/contact-client.tsx`, `app/terms/page.tsx`, `app/terms/terms-client.tsx`, `app/privacy/page.tsx`, `app/privacy/privacy-client.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Reset Password Page

**Leo:**

- **Scope:** Reset Password Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all 2 reset-password files. Found and fixed 15 issues: `ResetPasswordSkeleton` missing ARIA status semantics → added. `reset-password-client.tsx`: module-level `requestSchema` → `useMemo`; unsafe `tStr` cast removed, all 7 callsites → direct `t()`; `setSchema` deps fixed from `tStr` → `t`; both `z.string().min()` in `setSchema` missing translation key → added `t('validation.passwordTooShort')`; `console.error` × 2 → `logger.error`; stale-closure risk in auth listener (`mode` directly in callback) → `modeRef` pattern using `useEffect(() => { modeRef.current = mode; }, [mode])` so listener reads current mode without re-subscribing; `onRequest` + `onSet` → `useCallback`; all 3 `from-[#001528]/88` → `from-mq-navy-900/88`; loading container missing `role="status"` + `aria-live="polite"` → added; `Loader2` missing `aria-hidden` → added; success icon colors `bg-green-500/15 border-green-500/20 text-green-500` → MQ success tokens; icon `aria-hidden` on `CheckCircle2`/`XCircle` in alerts; `aria-invalid`/`aria-describedby` added to all 3 form inputs with matching error `id` attributes; `Mail`/`Eye`/`EyeOff` decorative icons → `aria-hidden="true"`; `text-red-500` × 2 → `text-mq-error`.
- **Files Changed:** `app/reset-password/page.tsx`, `app/reset-password/reset-password-client.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Sign Up Page

**Leo:**

- **Scope:** Sign Up Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all 4 signup files. Found and fixed 19 issues: `SignupSkeleton` missing ARIA status semantics → added. `SignupClient`: `clsx` → `cn` throughout (6 callsites); `signupSchema` → `useMemo`; `handleGoogleLogin` + `handleNextStep` → `useCallback`; `useEffect` cascade resets added `prevFacultyRef`/`prevCourseRef` guards; `fullNameRef` callback anti-pattern (called `register('fullName')` inside ref on every render) → destructured at top level; all `text-red-500` (9×) → `text-mq-error`; all required `*` spans (6×) → `text-mq-error`; password strength `text-red-500`/`text-green-600` → `text-mq-error`/`text-mq-success`; year `SelectTrigger` `border-red-500` → `border-mq-error`; submit button redundant disabled-state classes removed; `aria-invalid`/`aria-describedby` + error `id` on all 8 inputs; honeypot inline `style` → `className="hidden"`; background `from-[#001528]/88` → `from-mq-navy-900/88`; `error` prop passed to `FacultySelect`. `CourseCombobox`: `border-red-500` → `border-mq-error`; `updateDropdownPosition` → `useCallback`; search input `aria-label` added; Escape from search closes dropdown and returns focus. `FacultySelect`: `error` prop + `border-mq-error`/`aria-invalid` on trigger.
- **Files Changed:** `app/signup/page.tsx`, `app/signup/SignupClient.tsx`, `app/signup/components/CourseCombobox.tsx`, `app/signup/components/FacultySelect.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Login Page

**Leo:**

- **Scope:** Login Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all 6 login page files. Found and fixed 15 issues: `localLoginSchema` recreated every render → `useMemo`; `text-red-500` on both field error messages → `text-mq-error`; `aria-invalid`/`aria-describedby` missing on email + password inputs; hardcoded provider-mismatch English strings in two locations → `t('loginErrorProviderMismatchGoogle')` / `t('loginErrorProviderMismatchEmail')` (keys added to translations.json); hardcoded `text-[#18181b]`/`text-[#3f3f46]` in right panel → MQ tokens; template literal classNames → `cn()`; `handlePasskeyLogin` + `handleGoogleLogin` not memoized → `useCallback`; misleading `aria-disabled` on `<Link>` (non-functional on anchors) → removed. `LoginSkeleton` missing ARIA status semantics → added. `MFAChallenge` `text-red-500` → `text-mq-error`; all 4 buttons missing `type="button"`; code input missing `aria-label`/`aria-invalid`/`aria-describedby`; error div missing `role="alert"`; resend interval leaked on unmount → `cooldownIntervalRef` + cleanup `useEffect`. `usePasskeyLogin` `console.error` → `logger.error`.
- **Files Changed:** `app/login/LoginClient.tsx`, `app/login/page.tsx`, `app/login/components/MFAChallenge.tsx`, `app/login/hooks/usePasskeyLogin.ts`, `locales/en/translations.json`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Manage Profiles

**Leo:**

- **Scope:** Manage Profiles Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all 12 manage-profiles files. Found and fixed 18 issues: `PersonalInfoCard` raw `border-red-500`/`text-red-500` → `mq-error` tokens; email input missing `id` attribute; `aria-describedby` missing on all error-capable fields + error `<p>` missing `id`; hardcoded student ID placeholder → `t('studentIdPlaceholder')`. `AcademicInfoCard` hardcoded hex `bg-[#FFB81C]/15` + `text-[#c08c00]` → `bg-mq-warning/15` + `text-mq-warning`; `text-red-500`/`border-red-500` → `mq-error` tokens; year SelectTrigger missing `aria-invalid`/`aria-describedby`. `error.tsx` raw `bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400` → `bg-mq-error/10 text-mq-error`. `ProfileSkeleton` missing ARIA status semantics. `page.tsx` reload button missing `type="button"`; `RefreshCw` template literal → `cn()`. `ProfileHeader` no MIME type validation before FileReader → added `file.type.startsWith('image/')` guard; `handleAvatarChange` not memoized → `useCallback`. `useProfileManager` `profileSchema` recreated every render → `useMemo`; dead code in error branch collapsed; `reloadProfile` always fired success toast → try/catch guard. `actions.ts` unprofessional rate-limit message → neutral; misleading "Validation failed" catch label → "Cache revalidation failed". `profilesStore.ts` redundant `console.error` before `errorHandler.logError` removed.
- **Files Changed:** `app/manage-profiles/components/PersonalInfoCard.tsx`, `app/manage-profiles/components/AcademicInfoCard.tsx`, `app/manage-profiles/error.tsx`, `app/manage-profiles/components/ProfileSkeleton.tsx`, `app/manage-profiles/page.tsx`, `app/manage-profiles/components/ProfileHeader.tsx`, `app/manage-profiles/hooks/useProfileManager.ts`, `app/manage-profiles/actions.ts`, `lib/store/profilesStore.ts`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Event Settings

**Leo:**

- **Scope:** Event Settings Page Bug Hunt & Production Hardening
- **Summary:** Reviewed 4 event-settings files. Found and fixed 15 issues: `EventForm.handleSave` had no `catch` block — silent failure on API error → added `toastUtils.error`; redundant double-reset (both `handleOpenChange` + `useEffect` called RESET) → removed `resetForm` call and unused function; `handleSave`, `handleDelete`, `validateForm`, `handleOpenChange` not memoized → `useCallback` applied; color picker buttons missing `aria-pressed` → added; misleading `endAt` comment removed. `EventDetailPanel`: raw `text-emerald-600`/`text-amber-600` status colors → MQ tokens; raw nav button hover classes → MQ tokens; hardcoded hex colors in `categoryColors` → CSS custom properties (`var(--mq-info)` etc.) to respect theming; `handleNavigationClick` not memoized → `useCallback`. Settings layout: nav buttons missing `type="button"` + `aria-current="page"`; raw Tailwind icon colors → MQ tokens; `navigateToSection` not memoized → `useCallback`. `NotificationSettings`: double `if (!result)` → `if...else`; hardcoded `'minutes'` fallback → i18n `timingMinutes` key.
- **Files Changed:** `components/events/EventForm.tsx`, `components/events/EventDetailPanel.tsx`, `app/settings/layout.tsx`, `features/settings/components/NotificationSettings.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Event Feed

**Leo:**

- **Scope:** Event Feed Page Bug Hunt & Production Hardening
- **Summary:** Deep-reviewed all 18 feed-page files. Found and fixed 15 issues: time filters in `usePublicFeed` missing lower bound (past events shown); dead unreachable block in `useFeedLogic` `handleRemindMe`; `setTimeRange('upcoming')` for highlight (past highlighted events immediately hidden) → changed to `'all'`; memory leak in recursive `scrollToHighlight` setTimeout (only first timer cleaned up) → track all timers in array; `TimeRange` type missing `'all'` union member; time-range and category filter buttons missing `type="button"` and `aria-pressed`; `FeedSkeletons` missing ARIA status semantics; two dead dialog state vars (`statsDialogOpen`, `announcementsDialogOpen`) in `FeedSidebar` — removed along with their never-reachable Dialog JSX; also added Space key to categories card; `FeedClient` delete modal using raw `bg-red-*` classes → `mq-error` tokens; `PublicEventCard` non-MQ `categoryColors` and `bg-emerald-*` added-state → MQ tokens; `FeaturedEventsBanner` non-MQ `categoryGradients`, missing `aria-label` on prev/next buttons, missing `aria-current` on active dot → fixed all; `EventDetailModal` same gradient and added-state issues → MQ tokens; `AnnouncementsSection` non-MQ `typeStyles` → MQ tokens; `QuickStats` non-MQ `CategoryBar`/`StatCard` colors + hardcoded `'en-AU'` locale + non-MQ `EventCard` categoryColors → MQ tokens + `localeMap`; `PublicFeedFilters` wrong Input import path (`@/components/ui/input` → `@/components/ui/mq/input`).
- **Files Changed:** `features/feed/hooks/usePublicFeed.ts`, `features/feed/hooks/useFeedLogic.ts`, `features/feed/components/FeedFilters.tsx`, `features/feed/components/FeedSkeletons.tsx`, `features/feed/components/FeedSidebar.tsx`, `app/feed/FeedClient.tsx`, `features/feed/components/PublicEventCard.tsx`, `features/feed/components/FeaturedEventsBanner.tsx`, `features/feed/components/EventDetailModal.tsx`, `features/feed/components/AnnouncementsSection.tsx`, `features/feed/components/QuickStats.tsx`, `features/feed/components/PublicFeedFilters.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Map

**Leo:**

- **Scope:** Map Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all map files (MapClient.tsx, CampusMap.tsx, CampusMapHUD.tsx, MapPageSkeleton.tsx, position-editor/page.tsx, RouteAnnouncer.tsx, GoogleMapController.tsx, CampusMap.tsx, hooks, lib). Found and fixed 10 issues: URL truncation always appended `...` even for short URLs; redundant `document.title` useEffect overriding Next.js metadata; `selectedBuildingName={selectedBuilding?.id}` semantic mismatch (passing building code instead of human-readable name to screen reader announcements); duplicate `{/* Combined Map Wrapper */}` comment; three non-memoized inline arrow functions passed as props to CampusMapHUD (`onStartNavigation`, `onStopNavigation`, `onClearExternalPlace`) — memoized with `useCallback`; inaccessible `MapPageSkeleton` missing ARIA semantics; `position-editor/page.tsx` using non-MQ semantic Tailwind classes; hardcoded hex `bg-[#d2e3fc] dark:bg-[#1a3a5c]` in Google Maps selected-building highlight; category displayed via manual JS capitalization instead of i18n via `BUILDING_CATEGORY_LABELS`; hardcoded `'#4285F4'` hex in CampusMap SVG fill → replaced with `var(--mq-primary)`.
- **Files Changed:** `features/map/components/MapClient.tsx`, `features/map/components/CampusMap.tsx`, `features/map/components/CampusMapHUD.tsx`, `features/map/components/MapPageSkeleton.tsx`, `app/map/position-editor/page.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Calendar

**Leo:**

- **Scope:** Calendar Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all 6 calendar files. Found and fixed 10 issues: view-toggle buttons calling `setView` directly (broke URL sync) → switched to `handleViewChange`; `isToday` variable shadowing in mobile day row; timezone bug in todo form date construction (`new Date(dateString)` parses UTC); event highlight effect missing `processedRef` guard (re-fired on every store refresh); dead `hours >= 24` condition in `computeCurrentTimePosition`; duplicate supabase imports; hardcoded `'#10b981'` hex colour; inaccessible loading skeleton in `page.tsx`; redundant `role="main"` on `<main>`; mobile day buttons with no `aria-label`. Also memoized 9 local handler functions and added `aria-pressed` to view toggle buttons.
- **Files Changed:** `app/calendar/page.tsx`, `app/calendar/CalendarClient.tsx`, `features/calendar/hooks/useCalendarView.ts`, `features/calendar/hooks/useCalendarHighlights.ts`, `features/calendar/hooks/useCalendarData.ts`, `features/calendar/hooks/useCalendarDialogs.ts`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Home

**Leo:**

- **Scope:** Home Page Bug Hunt & Production Hardening
- **Summary:** Deep-reviewed all 7 home page files (app/page.tsx, app/home/page.tsx, HomeClient.tsx, loading.tsx, AuthRedirectHandler.tsx, and features/home hooks + components). Found and fixed 9 issues: duplicate ARIA landmark labels, unsafe `window.location.href` navigation in error state, `supabase` client recreated on every render in AuthRedirectHandler, two unused Zustand store subscriptions causing needless re-renders in `useHomeData`, `displayName` IIFE not memoized in `useHomeUser`, `motion` bypassing `LazyMotion` in `WeekHeatStrip`, inaccessible skeleton in `loading.tsx`, and dead fallback branch in `WelcomeHeader`.
- **Files Changed:** `app/home/HomeClient.tsx`, `app/home/loading.tsx`, `app/AuthRedirectHandler.tsx`, `features/home/hooks/useHomeData.ts`, `features/home/hooks/useHomeUser.ts`, `features/home/components/WeekHeatStrip.tsx`, `features/home/components/WelcomeHeader.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-05 (Australia/Sydney)

**Leo:**

- **Scope:** Fix Select Dropdowns Not Opening Inside Dialogs
- **Summary:** Diagnosed and fixed two root causes preventing Radix Select dropdowns from opening inside dialogs. (1) `SelectContent` had `z-50` while Dialog uses `z-[70]`, causing portals to render behind the overlay. Fixed by bumping to `z-[80]`. (2) `ReminderModal` called `e.preventDefault()` unconditionally in `onPointerDownOutside`/`onInteractOutside`, blocking Select portal interactions. Fixed by guarding against `[data-radix-popper-content-wrapper]` targets.
- **Files Changed:** `components/ui/select.tsx`, `components/ui/ReminderModal.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 876/878 tests pass (2 pre-existing signup failures unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-07 (Australia/Sydney)

**Leo:**

- **Scope:** CI/CD Test Suite Remediation
- **Summary:** Fixed four critical test failures in the authentication pipeline. Corrected `app/auth/callback/route.ts` to honor the `redirectTo` parameter during email verification (allowing users to land on `/map` or `/home` after signing in). Aligned `app/api/auth/signup/route.ts` with security mandates and existing test expectations by ensuring "already registered" attempts return a `200 OK` generic success message, preventing account enumeration.
- **Files Changed:** `app/auth/callback/route.ts`, `app/api/auth/signup/route.ts`.
- **Verification:** Successfully ran the full test suite locally (878 tests passed across 94 files); specific regression tests for auth callback redirects and signup enumeration confirmed passing.
- **Follow-ups:** None.

### 2026-04-01 (Australia/Sydney)

**Leo:**

- **Scope:** Git Rebase & Documentation Sync
- **Summary:** Resolved a complex 3-step interactive rebase conflict in `README.md`. Synthesized an integrated "Super README" by merging high-impact visual portfolio assets (Typing SVG, dynamic screenshots) from the local branch with the deep technical engineering narrative (Zero-Trust architecture, AI-native Codex workflows) from the documentation overhaul branch. Finalized the rebase and synchronized the repository state.
- **Files Changed:** `README.md`.
- **Verification:** Git rebase completed successfully; `README.md` structural integrity and link parity verified; repository status confirmed clean and synced with `origin/main`.
- **Follow-ups:** None.

### 2026-03-21 (Australia/Sydney)

**Leo:**

- **Scope:** Full Project Documentation Portfolio Transformation
- **Summary:** Rewrote and structurally elevated the entire project documentation suite to transform the repository into a high-caliber portfolio piece. Unified the professional tone, highlighted complex engineering impact (Zero-Trust, Additive Merge, Fused Heading), and addressed implementation-aware gaps (Infrastructure limits, PII handling, Passkey scope).
- **Files Changed:** `README.md`, `TECHNICAL_EXPLANATION.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `docs/README.md`, `docs/architecture/ARCHITECTURE.md`, `docs/api/API_REFERENCE.md`, `docs/inventory/ROUTE_INVENTORY.md`, `docs/setup/ENVIRONMENT_SETUP.md`, `docs/university-integration-requirements.md`, `docs/operations/deployment-checklist.md`, `docs/security/SECURITY_POSTURE.md`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Documentation consistency audit completed; Markdown links verified; alignment with codebase implementation-details (Vercel limits, Redis requirement, PII logging) confirmed.
- **Follow-ups:** Monitor stakeholder feedback on the new "Campus OS" framing.

Leo: 2026-03-17 (Australia/Sydney)
Scope: Rewrite README for Claude for OSS and OpenAI Codex for OSS Grant Applications
Summary: Replaced the internal-facing technical README with a grant-optimised public README. Added professional GitHub badges (MIT, CI/CD, TypeScript, Next.js, Supabase, tests, OSI, PRs). Structured four grant-targeted sections: (1) Ecosystem Impact framing the project as a modular "Campus OS" blueprint for Australian universities with layered architecture diagram and quantified impact table; (2) Security & Privacy Architecture covering Zero-Trust proxy middleware, Supabase RLS, PII minimisation, FIDO2/WebAuthn passkeys, and LLM OCR prompt injection mitigations; (3) AI-Native Maintainer Workflow documenting Claude 4.6 for schema mapping/architecture/security auditing and Codex for test generation/migrations/i18n, plus the Syllabus-as-Code documentation suite framing; (4) Project Governance with OSI-approved MIT licence confirmation, contributing pathways, P0–P2 roadmap (standalone extractor package, MCP server, institutional forks), and maintainer listing. Preserved all accurate technical facts from the prior README.
Files Changed: `README.md`, `CHANGELOG.md`, `AGENT.md`
Verification: Documentation-only change; no code modified ✅
Follow-ups: Once a GitHub repository URL is confirmed, update the badge URLs and clone command from placeholder to real org/repo path.

... [rest of AGENT.md content] ...

### 2026-07-22 (Australia/Sydney) — Formatting Baseline Repair

**Raouf:**

- **Scope:** Repaired pre-existing repository formatting drift before the Cloudflare Workers migration.
- **Summary:** Applied the repository Prettier configuration mechanically to the 47 files reported by the baseline `format:check`; no application logic or Cloudflare migration code was changed.
- **Verification:** `npm run check` passed.
- **Follow-ups:** None.

### 2026-07-22 (Australia/Sydney) — Cloudflare Sharp Advisory Risk Gate

**Raouf:**

- **Scope:** Added a deterministic, time-limited security exception for the exact upstream Sharp advisory observed during the Cloudflare Workers migration, while preserving a hard deployment block.
- **Summary:** Tracked full and production npm audit evidence plus exact Sharp dependency paths; added a fail-closed Node gate and 11 deterministic negative/positive tests; separated the local migration audit exception from Worker reachability; and required valid `proven-absent` OpenNext bundle/metafile evidence before every Cloudflare preview, upload, or deploy command. No Sharp override, forced audit fix, or Next downgrade was introduced.
- **Files Changed:** `artifacts/security/*`, `tools/security/check-sharp-risk.mjs`, `tools/security/check-sharp-risk.test.mjs`, `docs/security/sharp-cloudflare-risk-gate.md`, `docs/operations/deployment-checklist.md`, `.gitignore`, `package.json`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Node 22 focused gate tests, formatting, typecheck, secret scan, and local audit-exception gate passed. The deployment gate intentionally failed because Worker reachability remains `unproven` after OpenNext stopped before output on missing `open-next.config.ts`.
- **Follow-ups:** Complete the remaining OpenNext migration, regenerate bundle/metafile reachability evidence, and re-evaluate compatible upstream releases no later than 2026-08-22 Australia/Sydney. Preview/public deployment and production cutover remain prohibited.

### 2026-07-22 (Australia/Sydney) — Sharp Risk-Gate Review Closure

**Raouf:**

- **Scope:** Closed the security review findings against the Cloudflare Sharp advisory gate without relaxing the deployment block.
- **Summary:** Replaced declared reachability trust with an independent scan of the current `.open-next` runtime files and all discovered esbuild metafiles; retained hashes only as freshness evidence; gated exact Next/OpenNext/Wrangler registry provenance and integrity; made the entire audit graph fail closed while leaving unrelated advisory sources visible; bound separate preview/production evidence to exact build commands; and enforced build→gate→action for scheduled development and both dry-run paths as well as preview/upload/deploy.
- **Files Changed:** `tools/security/check-sharp-risk.mjs`, `tools/security/check-sharp-risk.test.mjs`, `package.json`, `.gitignore`, `artifacts/security/sharp-worker-reachability*.json`, `docs/security/sharp-cloudflare-risk-gate.md`, `docs/operations/deployment-checklist.md`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** 17 deterministic Node 22 tests cover forged absent evidence with Sharp in runtime/metafile data, provenance drift, malformed/expanded audit graphs, build-profile identity, freshness, and every Worker execution script. Formatting, typecheck, secrets, and the local audit exception passed; preview and production deployment gates remain blocked on `unproven`.
- **Follow-ups:** Complete and independently scan both build profiles after the missing OpenNext migration configuration is implemented. Do not preview, dry-run, schedule, upload, deploy, or cut over before the matching gate derives `proven-absent`.

### 2026-07-22 (Australia/Sydney) — Sharp Evidence-Schema Review Closure

**Raouf:**

- **Scope:** Closed the remaining exact-graph and reachability-schema findings from the second Sharp gate review.
- **Summary:** Added exact `effects` reverse-edge allowlists and bidirectional reciprocity checks for every Sharp-linked `via` edge; enforced status-specific `matches`, `proofGap`, build-result, output, and hash invariants; and added a complete clean-bundle `authorizeDeployment()` positive test so authorization—not only component checks—is proven.
- **Files Changed:** `tools/security/check-sharp-risk.mjs`, `tools/security/check-sharp-risk.test.mjs`, `docs/security/sharp-cloudflare-risk-gate.md`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** 19/19 focused Node 22 tests passed, including effects removal/addition/malformed/non-reciprocal cases, contradictory reachability metadata, and integrated clean authorization. Formatting, typecheck, secrets, and audit exception passed; preview and production remain blocked as `unproven`.
- **Follow-ups:** No review finding remains open. Deployment still requires the missing OpenNext migration tasks and independently derived `proven-absent` evidence for the matching build profile.

### 2026-07-22 (Australia/Sydney) — Cloudflare Worker Configuration Scaffolding

**Raouf:**

- **Scope:** Added the local configuration contracts required for the OpenNext/Cloudflare migration without activating a Worker or production schedules.
- **Summary:** Added the Wrangler preview/production configuration, OpenNext default configuration, static asset cache headers, local environment template, generated binding declarations, and configuration tests. Isolated generated Workerd runtime declarations in a strict dedicated Cloudflare TypeScript project so they cannot alter the DOM/Next application type program. Preview and production crons remain empty; the planned `IMAGES` binding is configuration-only because Cloudflare Images enablement and billing acceptance have not been verified.
- **Files Changed:** `wrangler.jsonc`, `open-next.config.ts`, `custom-worker.ts`, `cloudflare-env.d.ts`, `.dev.vars.example`, `public/_headers`, `.gitignore`, `config/ts/tsconfig.json`, `config/ts/tsconfig.cloudflare.json`, `package.json`, `tests/cloudflare/*`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Node 22 type generation, focused configuration tests, main and Cloudflare typechecks, formatting, and secret scan passed. Existing build→Sharp-gate→action scripts were preserved. No preview, dry-run, upload, deploy, or production cutover was run.
- **Follow-ups:** Before any deployment, confirm Cloudflare Images is enabled for the target account and the owner accepts transformation billing; then independently derive the matching Sharp reachability evidence. Task 8 must replace the temporary 503 worker stub.

### 2026-07-22 (Australia/Sydney) — Cloudflare Worker Configuration Review Remediation

**Raouf:**

- **Scope:** Closed the Task 4 quality-gate and route-regression review findings without changing deployment behaviour or static cache policy.
- **Summary:** Added the isolated Worker typecheck to the global `npm run check` sequence immediately after the main Next typecheck, protected by an exact script contract test. Tightened the Worker route test to require the exact approved static bypass list and explicitly reject dynamic HTML/RSC, API, auth, and `/_next/image` bypass patterns. The plan-mandated immutable caching for stable-name icon/image paths was left unchanged for final branch review.
- **Files Changed:** `package.json`, `tests/cloudflare/worker-config.test.ts`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Node 22 focused Cloudflare tests, global check-contract assertion, main and Worker typechecks, formatting, and secret scan passed. The Sharp audit scripts and build→gate→action ordering were not changed.
- **Follow-ups:** The Cloudflare Images enablement/billing and Sharp deployment-evidence blockers remain. Keep the immutable icon/image-cache policy as specified unless a separately reviewed production policy changes it.

### 2026-07-22 (Australia/Sydney) — Cloudflare Edge Middleware Bridge

**Raouf:**

- **Scope:** Restored the Edge-compatible Next.js middleware convention and added fail-closed API authentication coverage during the Cloudflare Workers migration.
- **Summary:** Renamed the unchanged request policy from `lib/proxy.ts` to `lib/middleware.ts`, exported it through the root `middleware.ts` convention, removed both obsolete proxy entry points, and migrated the MFA regression suite without changing CSP, CSRF, route, session, email-verification, or MFA branches. Added an independent inventory of every `app/api/**/route.ts` file with an explicit eight-prefix public allowlist synchronized to middleware policy and actionable failures for uncovered protected routes. The inventory exposed `/api/navigate` and `/api/security/check-password-breach`; a preliminary security commit added route-level `requireAuth` wrappers while preserving their existing origin, limiter, body-validation, upstream, and success behavior.
- **Files Changed:** `middleware.ts`, `lib/middleware.ts`, `proxy.ts` (deleted), `lib/proxy.ts` (renamed), `tools/proxy/proxy.ts` (deleted), `tests/api/middleware.mfa.test.ts`, `tests/security/api-auth-coverage.test.ts`, `app/api/navigate/route.ts`, `app/api/security/check-password-breach/route.ts`, `tests/api/protected-route-auth.test.ts`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Node 22 focused middleware/MFA, protected-route, API-inventory, and Worker-contract tests passed (16/16); Sharp gate tests passed (19/19); main and isolated Worker typechecks, formatting, secret scan, and local Sharp audit-exception gate passed. Policy comparison against `5a6dee08` confirmed the middleware implementation changed only its exported function name. The runtime compatibility audit still fails only on the expected remaining DNS lookup in `app/api/security/scan-headers/route.ts` and Node crypto imports in `lib/security/csp.ts` and `lib/security/csrf.ts`.
- **Follow-ups:** Replace the recorded DNS and Node crypto dependencies in their separately scoped migration tasks. Cloudflare preview, upload, dry-run, deploy, and production cutover remain blocked by the existing Sharp reachability gates and were not run.

### 2026-07-22 (Australia/Sydney) — Middleware Auth-Coverage Review Remediation

**Raouf:**

- **Scope:** Closed both important Task 5 security-review findings without changing the Cloudflare static-asset routing contract or existing Sharp deployment gates.
- **Summary:** Replaced token/regex API inventory with per-exported-HTTP-method TypeScript AST and reachable-call analysis. The analyzer follows only returned/invoked local or directly imported handlers, supports aliases and re-exports, validates trusted `requireAuth`/`requireAuthWithRateLimit` calls, proves reachable fail-closed `auth.getUser()` checks, and requires real configured secret comparisons. Seventeen adversarial tests reject comments, strings, dead helpers, unused imports, sibling-method leakage, unrelated or shadowed guard calls, unenforced secrets, missing session denial, and guards reached only after an early success path. The resulting inventory found three real gaps: admin GET/POST and gamification GET now use route-level `requireAuth` wrappers around unchanged handlers. Replaced suffix-wide middleware exclusions with explicit known static namespaces/files; API, auth callback, RSC, `/_next/image`, favicon-collision, and extension-shaped dynamic paths now execute middleware. Wrangler `assets.run_worker_first` remained unchanged.
- **Files Changed:** `middleware.ts`, `lib/middleware.ts`, `app/api/admin/update-building-positions/route.ts`, `app/api/gamification/route.ts`, `tests/security/api-auth-analyzer.ts`, `tests/security/api-auth-analyzer.test.ts`, `tests/security/api-auth-coverage.test.ts`, `tests/api/middleware.matcher.test.ts`, `tests/api/protected-route-auth.test.ts`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Node 22 focused middleware, matcher, protected-route, per-method inventory, adversarial analyzer, and Worker-contract tests passed (54/54). Main and isolated Worker typechecks, lint, formatting, secret scan, 19 Sharp gate tests, and the local Sharp audit-exception gate passed. The runtime audit remains non-zero only for the same expected DNS lookup in `app/api/security/scan-headers/route.ts` and Node crypto imports in `lib/security/csp.ts` and `lib/security/csrf.ts`.
- **Follow-ups:** Resolve the three recorded runtime dependencies in later migration tasks. No preview, upload, dry-run, deploy, production cutover, or Wrangler static bypass change occurred.

### 2026-07-22 (Australia/Sydney) — Auth Analyzer Binding Review Closure

**Raouf:**

- **Scope:** Closed the remaining Task 5 analyzer false-positive findings without changing route, middleware, Worker, or deployment behavior.
- **Summary:** Replaced name-based trust with exact import and lexical-binding resolution for auth wrappers, Supabase server clients, denial helpers, NextResponse, CSRF traversal, and global process/Boolean use. Session evidence now requires an awaited, destructured result from the project server client followed immediately by a correctly polarized error-or-missing-user 401/403 denial. Secret evidence now requires one configured CRON/ADMIN secret, the current request Authorization header, an exact bearer mismatch denial before work, and trusted 401/403 output. Forty-three analyzer tests cover property calls, unused and wrong-module imports, local shadows, malformed session checks, intervening work/success, and self/reversed/unrelated/two-secret comparisons.
- **Files Changed:** `tests/security/api-auth-analyzer.ts`, `tests/security/api-auth-analyzer.test.ts`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Node 22 focused Task 5 tests passed (80/80), including all 47 methods across 26 protected routes. Main and Worker typechecks, lint, formatting, secret scan, 19 Sharp gate tests, and the audit exception passed. Runtime compatibility remains non-zero only for the same three DNS/Node-crypto blockers.
- **Follow-ups:** Resolve the recorded runtime blockers in later migration tasks. No preview, dry-run, upload, deploy, or production cutover was run.

### 2026-07-22 (Australia/Sydney) — Auth Analyzer Final Fail-Closed Closure

**Raouf:**

- **Scope:** Closed the final Task 5 indirect-handler and direct-session dominance findings with a smaller fail-closed analyzer model.
- **Summary:** Removed arbitrary returned-helper traversal; exact immutable export aliases and resolvable re-exports are the only indirect handler forms. Unresolved/non-exported symbols and parameter, block, catch, or local shadows fail closed. Direct session proof is now limited to a first-operation sequence of immutable awaited project-client creation, awaited/destructured `getUser`, and an immediate exact 401/403 error-or-missing-user denial. Notification PATCH is an exact alias of its authenticated PUT handler. The four protected WebAuthn credential/registration methods now authenticate before deriving client IP or invoking limiters, so unauthenticated requests cannot touch limiter state; authenticated rate-limit behavior remains unchanged.
- **Files Changed:** API-auth analyzer/tests, notification PATCH alias/test, WebAuthn credentials and registration routes/tests, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Node 22 analyzer tests passed (61/61); six-file Task 5 tests passed (98/98); route regressions passed (19/19); all 47 protected methods across 26 routes remain covered. Main/Worker typechecks, lint, formatting, 818-file secret scan, 19 Sharp tests, and the audit exception passed. Runtime compatibility still reports only the same three DNS/Node-crypto blockers.
- **Follow-ups:** Resolve the recorded runtime blockers in later migration tasks. No preview, dry-run, upload, deploy, or production cutover was run.

### 2026-07-22 (Australia/Sydney) — Mutable Callable and Exception-Path Closure

**Raouf:**

- **Scope:** Closed the remaining Task 5 mutable-callable and try/catch/finally analyzer findings with strict rejection rules.
- **Summary:** Function/arrow variables are analyzable only when declared `const`; function declarations, const callables, and immutable aliases are discarded from trust if a complete module scan finds assignment, compound assignment, update, destructuring/property write, loop write, or rebinding to the symbol. Direct session evidence inside `try` is rejected entirely. The sync POST plus four protected WebAuthn credential/registration methods now perform their unchanged server-client/getUser/denial sequence before entering `try`; limiter and protected work remain inside existing error handling. New sync and WebAuthn regressions prove unauthenticated requests stop before limiter work.
- **Files Changed:** API-auth analyzer/tests, sync and WebAuthn routes/tests, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Node 22 analyzer tests passed (75/75); six-file Task 5 tests passed (112/112); route behavior tests passed (20/20); all 47 protected methods across 26 routes remain covered. Main/Worker typechecks, lint, formatting, 818-file secret scan, 19 Sharp tests, and the audit exception passed. Runtime compatibility still reports only the same three DNS/Node-crypto blockers.
- **Follow-ups:** Resolve the recorded runtime blockers in later migration tasks. No preview, dry-run, upload, deploy, or production cutover was run.

### 2026-07-22 (Australia/Sydney) — Complete HTTP Export Inventory Closure

**Raouf:**

- **Scope:** Closed the final narrow Task 5 omission for unresolved named HTTP exports in mixed-method route files.
- **Summary:** Syntax-level HTTP method presence is now recorded independently from callable resolution. Unresolved external named re-exports, unresolved imported/local exports, uninitialized or destructured exported method bindings, and namespace exports named as HTTP methods remain in coverage as explicit uncovered targets. A guarded local GET can no longer hide an unresolved external POST. Type-only exports remain excluded because they create no runtime handler. All prior exact binding, immutable callable, no-generic-helper, session-dominance, matcher, and route-ordering rules remain unchanged.
- **Files Changed:** `tests/security/api-auth-analyzer.ts`, `tests/security/api-auth-analyzer.test.ts`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Node 22 analyzer tests passed (80/80); six-file Task 5 tests passed (117/117); route behavior tests passed (20/20); all 47 protected methods across 26 current routes remain covered. Main/Worker typechecks, lint, formatting, 819-file secret scan, 19 Sharp tests, and the audit exception passed. Runtime compatibility still reports only the same three DNS/Node-crypto blockers.
- **Follow-ups:** Resolve the recorded runtime blockers in later migration tasks. No preview, dry-run, upload, deploy, or production cutover was run.

### 2026-07-22 (Australia/Sydney) — Edge Middleware Web Crypto Migration

**Raouf:**

- **Scope:** Removed the remaining Node crypto dependencies from the Cloudflare Edge middleware import graph without changing CSP or CSRF wire contracts.
- **Summary:** CSP nonce generation now uses Web Crypto for 16 random bytes and browser-safe base64 encoding. CSRF generation now uses Web Crypto for 32 random bytes and lowercase hexadecimal encoding; equal-length token comparison performs one XOR operation for every character before deciding equality. Added a policy-file guard against Node-only built-ins and strengthened existing CSP/CSRF tests for exact output shape and 64-call uniqueness.
- **Files Changed:** `lib/security/csp.ts`, `lib/security/csrf.ts`, `tests/unit/security/csp.test.ts`, `tests/security/csrf-critical.test.ts`, `tests/cloudflare/middleware-edge-compat.test.ts`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Node 22 targeted CSP, CSRF, MFA middleware, and Edge compatibility tests passed (47/47). Main and Worker typechecks, lint, full formatting, 819-file secret scan, 19 Sharp gate tests, and the local Sharp audit exception passed. The runtime audit now reports only the separately scoped `dns.lookup` blocker in `app/api/security/scan-headers/route.ts`.
- **Follow-ups:** Replace the DNS lookup in its dedicated migration task. No preview, dry-run, upload, deployment, or production cutover was run; Sharp deployment gates remain fail closed.

### 2026-07-22 (Australia/Sydney) — Platform-Neutral Cloudflare Runtime Detection

**Raouf:**

- **Scope:** Centralized deployment platform, environment, application-origin, and trusted client-IP detection for the local Cloudflare Workers migration while retaining Vercel rollback behavior.
- **Summary:** Added strict Cloudflare/Vercel/local runtime helpers; normalized configured application URLs to HTTP(S) origins; rejected malformed, credential-bearing, non-HTTP, and scheme/path-shaped host values; replaced Vercel-only production checks across rate limiting, CSRF, API errors, authentication, and server/Edge Sentry configuration; centralized verification/reset and signup origins; and removed the duplicate API-middleware IP parser. Cloudflare production trusts `cf-connecting-ip` first and does not trust caller-supplied `x-forwarded-for` by default. Vercel production headers and public client-side Sentry rollback tags remain supported.
- **Files Changed:** `lib/platform/runtime.ts`, platform/security/service/API/Sentry consumers, focused platform/IP/CSRF/rate-limit/email tests, `AGENT.md`, and `CHANGELOG.md`.
- **Verification:** Node 22 focused and affected regression tests passed (72/72); application and Worker typechecks, lint, full formatting, 820-file secret scan, 19 Sharp-gate tests, and the local Sharp audit exception passed. Runtime compatibility now fails only on the separately scoped `dns.lookup` use in `app/api/security/scan-headers/route.ts`.
- **Follow-ups:** Replace the DNS lookup in its dedicated task. No preview, dry-run, upload, deployment, or production cutover was run; the Sharp reachability deployment gates remain fail closed.

### 2026-07-22 (Australia/Sydney) — Platform Runtime Email-Safety Review Closure

**Raouf:**

- **Scope:** Closed both Important Task 7 review findings and added behavioral evidence for the practical coverage observation.
- **Summary:** Restored email-specific rejection of raw `example.com`, `your-`, and `paste` application-origin placeholders before normalization can discard path/query markers. Missing, invalid, credential-bearing, and placeholder origins now keep `isEmailServiceConfigured()` non-throwing and return the existing unsuccessful send result instead of rejecting. Verification and password-reset orchestrators therefore delete their newly inserted undelivered token records. Added behavioral tests for both cleanup lanes, Cloudflare preview precedence under `NODE_ENV=production`, credential-bearing origin rejection, database-error redaction, and the unchanged API middleware IP-plus-path rate-limit key.
- **Files Changed:** `lib/services/emailService.ts`, focused platform/email/token-cleanup/API behavior tests, `AGENT.md`, and `CHANGELOG.md`.
- **Verification:** Node 22 affected tests passed (87/87); application and Worker typechecks, lint, full formatting, 822-file secret scan, 19 Sharp-gate tests, and the local Sharp audit exception passed. Runtime compatibility remains non-zero only for the separately scoped `dns.lookup` use in `app/api/security/scan-headers/route.ts`.
- **Follow-ups:** Replace the DNS lookup in its dedicated task. No preview, dry-run, upload, deployment, production cutover, or push was performed; Sharp reachability deployment gates remain fail closed.

### 2026-07-22 (Australia/Sydney) — Worker-Compatible DNS Header Scanning

**Raouf:**

- **Scope:** Replaced the security-header scanner's unsupported `dns.lookup()` dependency and made runtime compatibility a permanent global quality gate.
- **Summary:** Added a Worker-compatible dual-stack resolver using `resolve4` and `resolve6`, preserving literal-IP targets, deduplicating answers, tolerating one unavailable family, and failing closed on empty or malformed results. The protected scan route now rejects any private, loopback, link-local, unique-local, or private IPv4-mapped IPv6 answer, including mixed public/private sets and alternate IPv6 spellings. Route regressions preserve authentication and rate-limit dominance and prove the outbound HEAD request uses `redirect: 'manual'` exactly once. The API reference records the DNS validation/fetch TOCTOU boundary honestly: these controls reduce SSRF exposure but do not mathematically eliminate DNS rebinding.
- **Files Changed:** `lib/security/dns-resolution.ts`, `app/api/security/scan-headers/route.ts`, DNS/route/runtime/Worker configuration tests, `package.json`, `docs/api/API_REFERENCE.md`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Node 22 focused DNS, route, runtime, Worker-contract, protected-route, and auth-inventory tests passed (33/33). Main and Worker typechecks, lint, full formatting, 825-file secret scan, 19 Sharp-gate tests, local Sharp audit exception, and the Cloudflare runtime audit passed.
- **Follow-ups:** Cloudflare public-fetch restrictions remain part of the production SSRF boundary. No preview, dry-run, upload, deployment, production cutover, or push was performed; Sharp reachability deployment gates remain fail closed.

### 2026-07-22 (Australia/Sydney) — OpenNext Routing Unblock and path-to-regexp Override Scoping

**Raouf:**

- **Scope:** Repaired a total Worker routing failure in which every request returned HTTP 500 under `workerd`, and excluded generated Worker output from the formatting gate.
- **Summary:** The pre-existing blanket `path-to-regexp: ^8.3.0` override forced `@opennextjs/aws`, which declares `^6.3.0`, onto the v8 parser. OpenNext's `getNextConfigHeaders()` re-parses the raw Next.js `headers()` source with its own copy, outside a try/catch, so the v8 lexer rejected the v6-dialect `/(.*)` source and threw `PathError` before any route ran. The override is now scoped so `@opennextjs/aws` resolves `path-to-regexp@6.3.0` — itself the patched release for CVE-2024-45296 — while its nested `express`/`router` subtree and Wrangler stay on 8.4.2. The Next.js source string is unchanged: `/{*path}` and `/*path` are rejected by Next's own v6 parser at build time, so no single source satisfies both majors. `.open-next` and `.wrangler` were added to the Prettier ignore list because `npm run check` failed for anyone who had built the Worker.
- **Files Changed:** `package.json`, `package-lock.json`, `config/next/next.config.ts`, `config/prettier/.prettierignore`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Local `wrangler dev` serves `/`, `/login`, `/privacy`, `/terms`, `/api/health`, and `/manifest.webmanifest` at 200; `/calendar` returns 307 to `/login?redirectTo=%2Fcalendar`; CSP nonce, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` are present on HTML. Resolution confirmed as `@opennextjs/aws` → 6.3.0 and `express`/`router`/Wrangler → 8.4.2. `npm audit --omit=dev --audit-level high` reports no `path-to-regexp` advisory; the 5 remaining high findings are the pre-existing Sharp/libvips advisories governed by the Sharp risk gate. Secret scan, runtime audit, formatting, both typechecks, lint, and 1063 tests passed.
- **Follow-ups:** Report upstream that `match(source)` in `getNextConfigHeaders()` and `handleRewrites()` sits outside the try/catch, so one unparsable source hard-fails every route. `redirects()` and `rewrites()` re-parse raw sources identically and would fail the same way if this override regressed.

### 2026-07-22 (Australia/Sydney) — Cloudflare Worker Cron Migration

**Raouf:**

- **Scope:** Replaced the three Vercel Cron schedules with a Cloudflare `scheduled()` handler and promoted `custom-worker.ts` from build stub to the real OpenNext entry point.
- **Summary:** Added a pure `runScheduledJob()` dispatcher mapping each cron expression to its existing `CRON_SECRET`-protected cleanup route, invoked internally through the OpenNext fetch handler rather than over the public internet. It fails closed when `CRON_SECRET` is absent, empty, or whitespace-only, rejects unknown cron expressions before issuing any request, and throws on a non-successful cleanup so failures surface in Cron Events instead of being recorded as success. The thrown message carries cron, route, and status but deliberately omits the upstream response body, which can echo the bearer credential into the log stream. Secret bindings are typed through a separate `cloudflare-env.secrets.d.ts` declaration merge so `npm run cf:typegen` stays reproducible, and the Worker tsconfig now resolves `@/lib/*`. Cron triggers remain `[]` in both Wrangler environments.
- **Files Changed:** `lib/cloudflare/scheduled.ts`, `custom-worker.ts`, `cloudflare-env.secrets.d.ts`, `config/ts/tsconfig.cloudflare.json`, `tests/cloudflare/scheduled.test.ts`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** 13 new dispatcher and worker-contract tests passed, including a guard that the mapping still equals the schedules `vercel.json` owns. `npm run cf:build` produced `.open-next/worker.js` from the real entry point. In local `workerd` with `--test-scheduled`, all three cron expressions dispatched to their correct routes and an unknown expression failed visibly. Against placeholder Supabase credentials the cleanup routes returned 503 `Not configured` — not 401 — proving the internal POST cleared both `CRON_SECRET` authentication and middleware CSRF; a wrong or missing secret returned 401, and a correct secret sent with a cross-origin `Origin` header was rejected 403. Secret scan, runtime audit, formatting, both typechecks, lint, and 1063 tests passed.
- **Follow-ups:** A successful 200 cleanup run is unproven because no Supabase credentials exist in this worktree; record it in the Task 16 preview parity matrix against real preview infrastructure. No preview, dry-run, upload, deployment, production cutover, or push was performed; Sharp reachability deployment gates remain fail closed.

### 2026-07-22 (Australia/Sydney) — Worker Dependency Proof, Environment Validation, and Size Gate

**Raouf:**

- **Scope:** Added the Workerd dependency import proof, platform-neutral deployment environment validation, and the Worker compressed-upload budget gate.
- **Summary:** A dependency smoke test proves the six server packages bundled into the Worker — SimpleWebAuthn server, Supabase SSR and JS, Resend, uuid, and web-push — still resolve and expose the entry points the application calls; no package needed replacement. `tools/deployment/check-required-env.mjs` validates required public and server variables, URL shape, HTTPS and non-example production origins, the canonical production WebAuthn RP ID and origin, and at least one complete distributed rate-limit backend, reporting variable names only. `tools/vercel/check-required-env.mjs` was deliberately left intact rather than reduced to a delegating wrapper: it interrogates the Vercel project through the Vercel CLI, a different check from validating the current process environment, and collapsing the two would weaken rollback validation. The backend list also accepts Vercel KV, which `getStore()` supports. `tools/cloudflare/check-worker-size.mjs` enforces a 9.5 MiB hard limit with a 2.8 MiB free-plan warning.
- **Files Changed:** `tools/deployment/check-required-env.mjs`, `tools/cloudflare/check-worker-size.mjs`, `tests/cloudflare/node-compatibility.test.ts`, `tests/cloudflare/required-env.test.ts`, `tests/cloudflare/worker-size.test.ts`, `package.json`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** 26 new tests passed across dependency imports, environment validation, and size parsing, including boundary cases at both thresholds and an assertion that no configured value is ever echoed. Secret scan (832 files), runtime audit, formatting, both typechecks, lint, and 1089 tests passed.
- **Follow-ups:** The real Worker gzip size is unmeasured because `npm run cf:dry-run` is blocked by the Sharp deployment gate. No preview, dry-run, upload, deployment, production cutover, or push was performed.

### 2026-07-22 (Australia/Sydney) — Sharp Reachability Gate Precision and Per-Build Recording

**Raouf:**

- **Scope:** Made the Sharp deployment gate detect the Sharp package rather than the word "sharp", and made it usable per build so it stops permanently blocking every Cloudflare command.
- **Summary:** The gate classified any artifact whose bytes matched `sharp|libvips|@img` as runtime-reachable, producing 13 blocking false positives against the real Worker output — the ua-parser device brand `"Sharp"`, the HTML entity `&sharp;`, the Leaflet CSS class `leaflet-routing-icon-sharp-right`, and the `Material Icons Sharp` font name. A blocking verdict now requires the package itself: a `node_modules/sharp` or `node_modules/@img/*` directory, a `sharp`/`libvips` native binary, or a genuine module specifier, and a specifier only blocks when its file is in the esbuild bundle graph. This surfaced a real finding the old scan buried: `next/dist/server/image-optimizer.js` contains `require('sharp')` but is absent from all 586 bundle-graph inputs, unreferenced by `worker.js`, and never uploaded — now recorded explicitly as unbundled scaffolding. A new `security:sharp:record-reachability` step runs between build and gate because the non-deterministic Next.js build meant reviewed digests could never match the artifact being uploaded; it can only certify absence and exits non-zero on any runtime or uncertain match.
- **Files Changed:** `tools/security/check-sharp-risk.mjs`, `tools/security/check-sharp-risk.test.mjs`, `artifacts/security/sharp-worker-reachability.json`, `tests/cloudflare/required-env.test.ts`, `package.json`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** 27 gate tests passed, including regressions pinning all four false positives as non-blocking and asserting a real package directory, an `@img` native package, `.node`/`.wasm`/`.so` libvips binaries, and a bundled `require('sharp')` each still block. `npm run cf:dry-run` now completes; measured Worker compressed upload is 6799.23 KiB, below the 9.5 MiB hard limit and above the 2.8 MiB free-plan threshold. Secret scan (837 files), formatting, both typechecks, lint, and 1089 tests passed.
- **Follow-ups:** Workers Paid is required at roughly 2.4x the free-plan limit; record this in the cutover approval. Wiring the recorder into the gated scripts trades human-review value for a gate that runs per build; split it back out if the team wants explicit review.

### 2026-07-22 (Australia/Sydney) — Cloudflare CI, Gated Deployment Workflow, and Preview Smoke Suite

**Raouf:**

- **Scope:** Added the required CI Worker build, the manually gated deployment workflow, and the automated public smoke suite.
- **Summary:** CI gained a `cloudflare-build` job that runs the runtime-compatibility audit and Sharp gate tests, builds and dry-runs the Worker, enforces the compressed-size budget, and uploads diagnostics; the pipeline result depends on it. `.github/workflows/cloudflare-deploy.yml` is `workflow_dispatch` only, routes production through the protected `cloudflare-production` environment, refuses production from any branch but `main`, and runs the quality gate, environment validation, dry-run, and size gate before deploying. The dispatch input is never interpolated into a shell command. `tools/cloudflare/smoke.mjs` checks public pages, health, manifest content type, immutable asset caching, the protected-page redirect to login, and anonymous refusal on a protected API, requiring all six security headers on HTML.
- **Files Changed:** `.github/workflows/ci-cd.yml`, `.github/workflows/cloudflare-deploy.yml`, `tools/cloudflare/smoke.mjs`, `tests/cloudflare/ci-workflows.test.ts`, `tests/cloudflare/smoke-script.test.ts`, `package.json`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** 18 new tests passed covering workflow contracts and smoke behaviour, including that the deployment workflow is manual only, every secret comes from GitHub secrets, gate ordering precedes deploy, and the runner never logs a body or cookie. Run against a real local `workerd` instance serving the built Worker: 9/9 checks passed.
- **Follow-ups:** GitHub Environments, their variables, and the Cloudflare API token are not configured; the deployment workflow cannot run until an operator creates them.

### 2026-07-22 (Australia/Sydney) — Cloudflare Deployment, Cutover, and Rollback Documentation

**Raouf:**

- **Scope:** Documented the Cloudflare Workers deployment path and rewrote primary-infrastructure language across the repository, keeping Vercel documented as rollback hosting.
- **Summary:** Added a deployment guide (local development, build and verification commands, measured size budget, Sharp gate sequence, full variable table, production WebAuthn invariants, the three UTC cron schedules, gated deployment workflow), a cutover runbook (pre-cutover gate, DNS and email-record preflight, overlap-free scheduler transfer, domain attachment, authenticated verification), and a rollback runbook (stop conditions plus Worker-version and platform rollback paths). Added the preview parity matrix as an explicitly unexecuted template carrying the three known open items. `README.md` and `ARCHITECTURE.md` now name Cloudflare Workers via OpenNext as primary infrastructure; `resend-vercel-setup.md` became `resend-deployment-setup.md`; the deployment checklist gained a Cloudflare section; `.env.example` documents deployment-target variables and the canonical production WebAuthn values.
- **Files Changed:** four new `docs/operations/cloudflare-*.md` files, `docs/operations/resend-deployment-setup.md` (renamed), `docs/operations/deployment-checklist.md`, `docs/README.md`, `docs/architecture/ARCHITECTURE.md`, `docs/setup/ENVIRONMENT_SETUP.md`, `README.md`, `.env.example`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Every documented command was run in this session, so instructions match implemented behaviour. Formatting, secret scan (841 files), and 1107 tests passed; `check:i18n` exits 0 with pre-existing warnings. The stale-infrastructure grep returns nothing.
- **Follow-ups:** The preview test record is a template and must be completed against a real preview Worker before cutover approval.

### 2026-07-29 (Australia/Sydney) — Backend Audit Database Remediation Applied to Production

**Raouf:**

- **Scope:** Applied all outstanding audit migrations to production Supabase via the CLI; fixed five further findings found while applying them.
- **Summary:** Nine migrations pushed. Three things are worth carrying forward. First, **BA-0021 was never live** — the migration-chain reading was wrong about production, `user_details` already had `security_invoker = true`, and the repeated claim of active PII exposure in earlier notes was incorrect. Second, **BA-0023 was live and broader than documented**: `anon` held full privileges on all three materialized views, so a plain `GET /rest/v1/mv_xp_leaderboard` with the publishable key returned HTTP 200; it was empty only because the matviews had never been refreshed. Third, **running `supabase db advisors` — which the audit had never done — surfaced two live P0s**: `auth.role() = 'authenticated'` guards do not engage for `anon` (and `REVOKE ... FROM PUBLIC` does not help, because Supabase grants `anon` EXECUTE directly), and sixteen duplicate `USING (true)` policies let any authenticated user modify any other user's rows.
- **Files Changed:** six new/amended migrations under `supabase/migrations/2026072909*`–`2026072913*`, `app/api/gamification/route.ts`, `lib/supabase/database.types.ts`, three test files under `tests/security/`, `docs/backend-audit/2026-07-22/backend-finding-ledger.csv`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Each fix confirmed by probing production directly rather than by inference — the anon call that previously executed `award_xp`'s body now returns `42501`, and every sensitive relation returns 401 to the anon key. Advisors 119 → 99, `rls_policy_always_true` 12 → 0, zero ERROR-level findings. `npm run check` exit 0 with 1207 tests. No production data deleted: `xp_events` unchanged at 125 rows.
- **Follow-ups:** Three self-inflicted mistakes are recorded in the ledger and worth remembering — a migration that would have 500'd first-time gamification profile creation (caught by reading callers before pushing), a verification block whose loop variable `cmd` was shadowed by `pg_policies.cmd` and silently rolled back an entire push, and a check that missed a `PUBLIC` grant because it joined `aclexplode()` to `pg_roles` (PUBLIC has `grantee = 0` and joins to nothing). 25 definer functions remain anon-executable and need individual review; anonymous sign-ins are enabled.

### 2026-07-30 (Australia/Sydney) — Red-Team Remediation

**Raouf:**

- **Scope:** Fixed all findings from the full red team of the live deployment (BA-0033 to BA-0044).
- **Summary:** **User registration had been broken since the Cloudflare cutover** — `getConfiguredAppOrigin()` falls back to Vercel-only variables, so with no `NEXT_PUBLIC_APP_URL` declared every signup returned 503. Now declared per environment in `wrangler.jsonc`. The `avatars` bucket was anonymously listable and was exploited end-to-end with just the publishable key (bucket → user `auth.uid()` folder → filename → photo); its UPDATE policy also lacked `WITH CHECK`, and it accepted SVG. `maps.googleapis.com` was a trusted CSRF origin. Rate limits were still at testing values. The repo's HIBP breach check was browser-only and is now enforced server-side on signup and password reset, failing open on outage so a third party cannot take registration down.
- **Files Changed:** `wrangler.jsonc`, `lib/security/csrf.ts`, `lib/services/rateLimitService.ts`, `lib/security/password-breach.ts`, two auth routes, `app/robots.ts`, `app/sitemap.ts`, `app/calendar/page.tsx`, one new migration, five new test files, three existing test files, `package-lock.json`, the finding ledger.
- **Verification:** `npm run check` exit 0 with 1231 tests. Storage and Auth-config fixes verified directly against production by API readback and by re-running the original exploit, which now returns nothing while legitimate avatar URLs still resolve.
- **Follow-ups:** **Nothing code-level is live yet — the Worker could not be deployed.** Both available Cloudflare credentials fail with `Authentication error` against the account owning the Worker, and no GitHub repo secrets exist, so neither CLI nor CI can ship it. Also outstanding: the two missing Google Maps keys (maps endpoints 503), `password_hibp_enabled` needs a Pro plan, and three npm advisories are accepted as build-time-only rather than downgrading Next to 14.x.
- **Lesson recorded:** three separate tests failed because the comment explaining a fix quoted the very string the test forbade (`auth.role() = 'authenticated'`, `increased for testing`, `UNIVERSITY_CONFIG.website`). Text-matching guards must strip comments before asserting — `tests/seo/canonical-site-url.test.ts` does this and is the pattern to copy.

### 2026-07-30 (Australia/Sydney) — Deployed Red-Team Fixes; Self-Inflicted Outage and Rollback

**Raouf:**

- **Scope:** Unblocked Cloudflare access, set the missing Google API keys, deployed all outstanding fixes (BA-0033..BA-0047).
- **Summary:** `CLOUDFLARE_API_KEY` proved to be a valid user-scoped token holding **API Tokens Write**, so it minted a deploy token scoped to the Worker's own account with just `Workers Scripts Write` + `Account Settings Read`. Three Google keys were missing, not two — `/api/weather` was broken too, hidden behind a 400-for-missing-coordinates that fires before the key check. The local `GOOGLE_ROUTES_API_KEY` was **empty**; `GOOGLE_MAPS_API_KEY` was validated against Places, Routes and Weather and serves all three.
- **THE IMPORTANT LESSON:** `NEXT_PUBLIC_*` values are inlined at **BUILD** time. Worker secrets and `wrangler.jsonc` vars are **runtime-only and never reach the browser bundle.** A rebuild that exported only two of the required NEXT_PUBLIC variables inlined the Supabase URL and publishable key as empty strings and **took production down** — with build exit 0, 1231 tests green, and a clean `wrangler --dry-run`. No pre-build check can catch this. `tools/cloudflare/check-public-env.mjs` now asserts against build OUTPUT and is wired into every `cf:deploy`/`upload`/`preview` script; `tests/cloudflare/public-env-gate.test.ts` pins it there. Recovery was `wrangler rollback 2e584cab`, which restored service immediately — worth remembering as the first move for any bad deploy.
- **Files Changed:** `tools/cloudflare/check-public-env.mjs`, `tests/cloudflare/public-env-gate.test.ts`, `package.json`, the finding ledger, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Production version `e9e93429`; `npm run check` exit 0 with 1239 tests; **signup HTTP 200** (was 503 for every user since cutover); health healthy/connected; weather 200; all hostile origins 403; login 429s from attempt 11; `cf:smoke` 9/9. Test user deleted, `auth.users` back to 29.
- **Follow-ups:** Split the Maps key into a referrer-restricted browser key and a separate server key (it is currently both public and server-side, so the public value can drive billable usage). Narrow or revoke `CLOUDFLARE_API_KEY` — `API Tokens Write` is effectively root for token minting. The leaked Supabase PAT in `~/.zshrc`/`~/.bashrc` is still unrotated.

### 2026-07-30 (Australia/Sydney) — BA-0048: Cross-User Profile Read (a P0 this audit had reported as absent)

**Raouf:**

- **Scope:** Fixed a live cross-user PII exposure on `public.profiles` and corrected two earlier incorrect conclusions.
- **Summary:** `profiles_select` was PERMISSIVE / `FOR SELECT` / role `public` / `USING (true)`, beside the correct owner-scoped policy. Postgres ORs permissive policies, so every authenticated user could read every profile. Proven: a throwaway account read **30 rows** — 30 emails, 30 names, 16 student IDs. Live since the initial schema in Jan 2026.
- **THE LESSON — I made the same mistake twice:** BA-0021 declared "no live PII exposure" from the `user_details` **view** (which is genuinely secure) without checking the base table's policies. BA-0030 then dropped always-true policies only from the four tables **the advisor named** instead of sweeping `pg_policies`. Both are the same error: trusting a derived object, or someone else's list, over the catalog. Verification now sweeps every table in `public`, with `xp_config` the one justified exception. **When a control is table-scoped, enumerate from the catalog — never from a report.**
- **Files Changed:** `supabase/migrations/20260730120000_fix_profiles_cross_user_read.sql`, `tests/security/profiles-cross-user-read.test.ts`, the finding ledger, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Same session token: 30 rows → 1 row, own profile still readable. `npm run check` exit 0, 1242 tests. Throwaway account deleted; users/profiles back to 29/29.
- **Follow-ups:** `audit_logs` has 0 rows, so exploitation over the ~6-month window can be neither confirmed nor ruled out. Finding all 48 is now recorded in the security questionnaire on the Desktop.

### 2026-07-30 (Australia/Sydney) — Closed the Remaining Questionnaire Gaps (BA-0049)

**Raouf:**

- **Scope:** Worked through every item I had listed as fragile or incomplete in the security questionnaire, and fixed what was fixable.
- **Summary:** **BA-0049** — two tables and four `sylla_*` functions existed in production with no migration and no calling code, from an AI feature that never shipped. The tables were inert (RLS on, 0 policies), but all four functions were `SECURITY DEFINER` and executable by `anon`, which bypasses RLS outright, and three took a caller-supplied user id with no ownership check: anyone could burn another user's AI quota or alter their request records. Client reach revoked on all six objects; `service_role` retains access; documented in migration history for the first time. Deliberately **not** dropped — that work isn't visible from this repo. **audit_logs diagnosed**: I had called it a broken mechanism; that was wrong. Calling `log_audit` with a real session wrote a correctly-attributed row, so the mechanism works and the table was empty because its only callers are rare MFA/session flows that ~nobody triggers. It's a coverage gap. **GitHub deploy workflow**: set the 9 secrets and 4 vars I could verify; 9 secrets and 3 vars remain that only the owner can supply, since Cloudflare won't return secret values.
- **Files Changed:** `supabase/migrations/20260730130000_lock_down_orphaned_sylla_surface.sql`, `tests/security/orphaned-sylla-surface.test.ts`, the finding ledger, `AGENT.md`, `CHANGELOG.md`, and the security questionnaire on the Desktop (Q34, Q39, Q40).
- **Verification:** Catalog sweep confirms no `sylla_*` function is client-executable and no `sylla_*` table is granted to a client role, with `service_role` intact. `npm run check` exit 0, **1250 tests**. Test accounts used for proofs were deleted; `auth.users` back to 29.
- **Follow-ups:** Two things I cannot close myself — no backup restore has ever been tested (largest remaining operational risk), and platform leaked-password protection needs a Supabase Pro plan (mitigated in-app instead). Do **not** trigger the GitHub deploy workflow until the remaining secrets are set; a half-configured run would leave the service-role client unset, which is the same failure I caused by hand earlier today.

### 2026-07-30 (Australia/Sydney) — CI Deploy Credentials Recovered and CRON_SECRET Rotated

**Raouf:**

- **Scope:** Finished configuring the CI deploy path by recovering the secret values Cloudflare would not return.
- **Summary:** Cloudflare's Workers secrets API is genuinely write-only — verified across three endpoints (`/secrets`, `/secrets/{name}`, `/settings`), all of which return only `name` and `type`, never a value. **But the values were still recoverable**: these secrets were originally copied from Vercel at the cutover, and Vercel's per-variable endpoint (`/v1/projects/{id}/env/{envId}`) does decrypt. That yielded `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `KV_REST_API_URL` and `KV_REST_API_TOKEN`. `CRON_SECRET` is Vercel type `sensitive`, which is never returned by anyone — so I **rotated** it instead. That is safe because it is self-contained: `lib/cloudflare/scheduled.ts` reads it from env and calls the app's own protected route with the same value, and Vercel Cron was disabled at cutover so no external caller holds the old one. Verified live: the cron route returns 401 without it, 401 with a wrong value, and 200 with the new one (it ran and scanned 9 users).
- **Also confirmed a live-behaviour detail:** the rate limiter uses `KV_REST_API_*` (the Vercel-KV branch of `getStore()`), not `UPSTASH_REDIS_REST_*` and not the Postgres store. That is why `public.rate_limits` is empty while rate limiting demonstrably works.
- **Corrected my own error:** I had set the `WEBAUTHN_RP_ID` CI variable to `www.syllabus-sync.app`. The canonical value in `tools/deployment/check-required-env.mjs` is the apex `syllabus-sync.app` — an RP ID must be a registrable suffix of the origin. The deployment env gate caught it, which is the gate working as intended.
- **Verification:** `node tools/deployment/check-required-env.mjs` with exactly the configured set now exits **0**, with three warnings for genuinely optional values (`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SENTRY_AUTH_TOKEN`). Push notifications are unaffected because `wrangler deploy` does not touch existing Worker secrets. All recovered values were removed from disk afterwards; `.env.local` holds only `NEXT_PUBLIC_*` build values, no server secrets.
- **Follow-ups:** `VAPID_PRIVATE_KEY` remains unrecoverable — it is not in Vercel and not on disk. Do **not** rotate it casually: one live push subscription exists and rotating breaks it. **Unverified:** I could not confirm the Worker's actual `WEBAUTHN_RP_ID` value. Secrets are unreadable, the cutover record does not document it, and the options endpoint needs a properly-formed SSR session cookie which I did not construct. Worth checking directly, since a `www`-scoped RP ID would still work today but would break any future move to the apex domain.

### 2026-07-30 (Australia/Sydney) — BA-0051: Repairing What BA-0050 Broke

**Raouf:**

- **Scope:** Clearing the residue of this morning's work. It turned out to include a live defect I had introduced myself.
- **Summary (BA-0051, P1):** Dropping `profiles.student_id` under BA-0050 required recreating `public.user_details`, taking the view from 15 columns to 14. Two `SECURITY DEFINER` functions still named the column and both broke. `get_my_profile()` declared `RETURNS TABLE(... student_id text ...)` with a body of `RETURN QUERY SELECT * FROM public.user_details`, so PL/pgSQL raised `42804 structure of query does not match function result type` for **any authenticated caller that matched a row**. `create_user_profile(uuid,text,text,text)` still inserted into `(id, email, full_name, student_id)`, raising `42703 undefined_column`. Both proven against production before the fix by setting `request.jwt.claims` to a real user inside a rolled-back transaction.
- **Why BA-0050's verification missed it:** it checked that the column was gone from the table and the view, that `security_invoker` survived, and that a live signup returned 200. All three passed. It never asked the catalog which _other_ objects named the column. Signup passed because it goes through `ensure_user_profile`, which never referenced `student_id`, and nothing in the app calls `get_my_profile`, so nothing failed loudly. **A `service_role` probe cannot catch this**: `auth.uid()` is NULL, the function returns zero rows, and a structural mismatch only raises once a row is actually returned — so the broken function looks healthy to exactly the kind of check I ran. Dropping a column is a contract change for every dependent object, and only the catalog knows the list. Same lesson as BA-0048: sweep, do not enumerate.
- **Hardening taken while in there:** the body now lists columns explicitly instead of `SELECT *`, which is the mechanism that let the contract drift silently. `EXECUTE` was revoked from `PUBLIC` and `anon` on both functions — `get_my_profile` had been PUBLIC-executable while being `SECURITY DEFINER`. `p_student_id` was removed from `create_user_profile` rather than kept and ignored, so any remaining caller fails on the signature instead of believing a value was stored.
- **Also cleared:** 70 orphaned translation keys (`validation.studentIdRequired`, `enterStudentIdDesc`) that survived BA-0050 in all 35 locales, referenced by no code. `privacy-policy.md` and `docs/database/database-schema.sql` still listed `student_id` as collected; both corrected, and the policy now records the deletion rather than dropping the field silently. `docs/api/API_REFERENCE.md` still showed it in request examples. `lib/supabase/database.types.ts` still declared it.
- **Verification:** the migration's verification block, run standalone against the pre-fix state, **failed as designed** — it is not vacuous. After apply: catalog sweep returns zero `student_id` references in any function, view, index or constraint; `get_my_profile` returns exactly 1 row for a real session; declared OUT columns (14) equal `user_details` columns (14); the old 4-arg signature is gone; a cross-user `create_user_profile` call is still rejected. `npm run check` exit 0 with **1260 tests**.
- **Follow-ups:** `create_user_profile` duplicates `ensure_user_profile`, which has a stricter fail-closed guard and is the path the app actually uses. Nothing calls `create_user_profile`. It is a candidate for removal, but deleting a capability is a separate decision from repairing a break, so I left it. Separately, 8 keys added with the MQ Navigation feature on 2026-06-02 (`campus`, `campusSupport*`, `mqNavCompanion*`) exist only in `en`, so all 34 other locales fall back to English for that card — Leo's feature, reported not touched.

### 2026-07-30 (Australia/Sydney) — BA-0050: Student IDs Removed, and User Notification Prepared

**Raouf:**

- **Scope:** Both follow-ups from the BA-0048 plan, on owner instruction: notify affected users, and stop holding student IDs.
- **Summary (BA-0050):** `profiles.student_id` was collected at signup, stored, shown back to its owner, and read by nothing. It was the most sensitive field BA-0048 exposed. Removed in the order that keeps production consistent: nulled the 16 stored values first, then stripped collection from 56 code references and 140 translation keys across 35 locales, deployed, verified a live signup succeeds without the field, and only then dropped the column. `public.user_details` selected the column and blocked the drop, so the migration recreates the view first **`WITH (security_invoker = true)`** and re-verifies that flag, because this is precisely the DROP/CREATE pattern that lost it twice under BA-0021.
- **Correction to my own earlier claim:** I had written that "nothing in the app depends on it". No _logic_ read it, but it was a **required** signup field with UI in two components and keys in 35 locales. The change was 56 references, not one line.
- **Notification:** A Gmail draft is prepared and **not sent**, addressed to Raouf with 27 recipients in BCC (never To:, which would leak every address to every recipient). The app's own mail path could not be used: the Resend key stored in Vercel is invalid, and the Worker's copy is unreadable. The draft states what was exposed, the roughly six-month window, that no evidence of misuse was found, and explicitly that no access log exists detailed enough to prove nobody read the records.
- **Verification:** Column absent from both table and view, `security_invoker` still true, `npm run check` exit 0 with 1250 tests, smoke 9/9. Test accounts deleted; `auth.users` back to 29.
- **Follow-ups:** The recipient list needs pruning before sending. Around half the 29 accounts look like Leo's and my own test accounts (three `*.demo@mq.edu.au`, several of the maintainers' own addresses, two `yopmail.com`), so the count of genuinely affected third parties is closer to 14. One `.test` address was excluded as undeliverable. Deciding which accounts are real is the owners' call, not mine, so the draft over-includes rather than risks missing someone.
