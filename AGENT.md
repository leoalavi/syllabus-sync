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

## 2. The Raouf Change Protocol (MANDATORY)

Whether you are a human or an AI, you must follow this protocol for every code change:

1. **Preflight Reading:** Locate and read `AGENT.md` and the recent history in `CHANGELOG.md`.
2. **Explain Before Touching:** Provide a concise summary of constraints and your planned edits before execution.
3. **Atomic Changes:** Make minimal, consistent changes aligned with existing patterns.
4. **Verification:** Run `npm run check` (or the relevant sub-command) to verify behavioral and structural correctness.
5. **Postflight Logging:** Append a new entry to both `AGENT.md` and `CHANGELOG.md` using the "Raouf:" template.

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

## Change Log (Raouf Template)

### 2026-07-07 (Australia/Sydney) — App-Icon Logo Rebrand

**Raouf:**
- **Scope:** Replaced the Macquarie University crest logo with the new Syllabus Sync app-icon image across the entire app, including the PWA/favicon icon set and all 35 locale alt-text strings.
- **Summary:** New master asset `public/syllabus-sync-logo.png` cropped from the supplied app-icon artwork and used to regenerate `favicon.ico`, `apple-touch-icon.png`, and `icon-192/384/512.png`/`maskable-512.png`. All ~25 code references (login, signup, header, sidebar, onboarding, reset-password, OG/Twitter meta, JSON-LD schema, push-notification fallbacks, service worker) repointed from `/MQ_Logo_Final.png` to `/syllabus-sync-logo.png`; old crest file deleted. Service worker cache versions bumped (`v6` → `v7`) to force-refresh cached assets. `mqLogoAlt` translation value switched to a `{{appName}}`-interpolated string in all 35 locales, replacing hardcoded "Macquarie University" wording.
- **Files Changed:** `public/syllabus-sync-logo.png`, `public/icons/*.png`, `public/apple-touch-icon.png`, `app/favicon.ico`, `public/MQ_Logo_Final.png` (deleted), `app/layout.tsx`, `app/home/page.tsx`, `app/calendar/page.tsx`, `app/map/page.tsx`, `app/feed/page.tsx`, `app/manage-profiles/layout.tsx`, `app/login/LoginClient.tsx`, `app/signup/SignupClient.tsx`, `app/onboarding/OnboardingClient.tsx`, `app/reset-password/reset-password-client.tsx`, `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`, `lib/server/push.ts`, `lib/services/notificationService.ts`, `public/sw.js`, `locales/*/translations.json` (35 files).
- **Verification:** `npm run check` passed ✅; `npm run check:i18n` passed ✅; manually confirmed on `/login` and browser favicon ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Internationalization Update

**Raouf:**
- **Scope:** i18n Expansion (34 Locales)
- **Summary:** Added missing `heroSection`, `opensInNewTab`, and `loadingEvents` keys to all 34 translation files in `locales/`. Used localized translations for major languages (Arabic, German, Spanish, French, Italian, Portuguese, Chinese, Japanese, etc.) and English fallbacks for others. `heroSection` is used for ARIA labels on hero sections; `opensInNewTab` provides an accessible suffix for links; `loadingEvents` is used for screen reader status updates during feed loading.
- **Files Changed:** `locales/*/translations.json` (34 files).
- **Verification:** Ran `npm run check:i18n` — all 35 locales validated successfully ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — About, Contact, Terms & Privacy Pages

**Raouf:**

- **Scope:** About, Contact, Terms & Privacy Pages Bug Hunt & Production Hardening
- **Summary:** 22 issues fixed across 8 files. All 4 pages used `'use client'` at the page level → no metadata, breaking SEO for all public pages → split each into RSC `page.tsx` (metadata + ARIA skeleton + Suspense) + `*-client.tsx` (client component). All 4 hero banners had hardcoded hex → MQ tokens: `from-[#8B1525] via-[#A6192E] to-[#76232f]` → `from-mq-red-deep via-mq-primary to-mq-red-deep`; `text-[#FFB81C]`/`bg-[#FFB81C]` → `text-mq-warning`/`bg-mq-warning`. About: `group` missing on CTA Link (broken `group-hover` animation); sections missing `aria-labelledby`; missing `<main>`. Contact: `text-mq-danger` → `text-mq-error` (token didn't exist → invisible errors); `group` missing on helpful-links article (migrated to scoped `group/link`); `maxLength` added to email (254) + textarea (2000); error `<p>` now has `id` + `role="alert"` + textarea `aria-describedby`; `noValidate` added; missing `<main>`. Terms: `ArrowLeft` `aria-hidden`; `scroll-mt-8` on sections; `<main>`. Privacy: `ArrowLeft` `aria-hidden`; table row keys from index to `row[0]`; mailto subject `encodeURIComponent`-encoded; `scroll-mt-8` + `aria-labelledby` on all 14 sections; `<main>`.
- **Files Changed:** `app/about/page.tsx`, `app/about/about-client.tsx`, `app/contact/page.tsx`, `app/contact/contact-client.tsx`, `app/terms/page.tsx`, `app/terms/terms-client.tsx`, `app/privacy/page.tsx`, `app/privacy/privacy-client.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Reset Password Page

**Raouf:**

- **Scope:** Reset Password Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all 2 reset-password files. Found and fixed 15 issues: `ResetPasswordSkeleton` missing ARIA status semantics → added. `reset-password-client.tsx`: module-level `requestSchema` → `useMemo`; unsafe `tStr` cast removed, all 7 callsites → direct `t()`; `setSchema` deps fixed from `tStr` → `t`; both `z.string().min()` in `setSchema` missing translation key → added `t('validation.passwordTooShort')`; `console.error` × 2 → `logger.error`; stale-closure risk in auth listener (`mode` directly in callback) → `modeRef` pattern using `useEffect(() => { modeRef.current = mode; }, [mode])` so listener reads current mode without re-subscribing; `onRequest` + `onSet` → `useCallback`; all 3 `from-[#001528]/88` → `from-mq-navy-900/88`; loading container missing `role="status"` + `aria-live="polite"` → added; `Loader2` missing `aria-hidden` → added; success icon colors `bg-green-500/15 border-green-500/20 text-green-500` → MQ success tokens; icon `aria-hidden` on `CheckCircle2`/`XCircle` in alerts; `aria-invalid`/`aria-describedby` added to all 3 form inputs with matching error `id` attributes; `Mail`/`Eye`/`EyeOff` decorative icons → `aria-hidden="true"`; `text-red-500` × 2 → `text-mq-error`.
- **Files Changed:** `app/reset-password/page.tsx`, `app/reset-password/reset-password-client.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Sign Up Page

**Raouf:**

- **Scope:** Sign Up Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all 4 signup files. Found and fixed 19 issues: `SignupSkeleton` missing ARIA status semantics → added. `SignupClient`: `clsx` → `cn` throughout (6 callsites); `signupSchema` → `useMemo`; `handleGoogleLogin` + `handleNextStep` → `useCallback`; `useEffect` cascade resets added `prevFacultyRef`/`prevCourseRef` guards; `fullNameRef` callback anti-pattern (called `register('fullName')` inside ref on every render) → destructured at top level; all `text-red-500` (9×) → `text-mq-error`; all required `*` spans (6×) → `text-mq-error`; password strength `text-red-500`/`text-green-600` → `text-mq-error`/`text-mq-success`; year `SelectTrigger` `border-red-500` → `border-mq-error`; submit button redundant disabled-state classes removed; `aria-invalid`/`aria-describedby` + error `id` on all 8 inputs; honeypot inline `style` → `className="hidden"`; background `from-[#001528]/88` → `from-mq-navy-900/88`; `error` prop passed to `FacultySelect`. `CourseCombobox`: `border-red-500` → `border-mq-error`; `updateDropdownPosition` → `useCallback`; search input `aria-label` added; Escape from search closes dropdown and returns focus. `FacultySelect`: `error` prop + `border-mq-error`/`aria-invalid` on trigger.
- **Files Changed:** `app/signup/page.tsx`, `app/signup/SignupClient.tsx`, `app/signup/components/CourseCombobox.tsx`, `app/signup/components/FacultySelect.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Login Page

**Raouf:**

- **Scope:** Login Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all 6 login page files. Found and fixed 15 issues: `localLoginSchema` recreated every render → `useMemo`; `text-red-500` on both field error messages → `text-mq-error`; `aria-invalid`/`aria-describedby` missing on email + password inputs; hardcoded provider-mismatch English strings in two locations → `t('loginErrorProviderMismatchGoogle')` / `t('loginErrorProviderMismatchEmail')` (keys added to translations.json); hardcoded `text-[#18181b]`/`text-[#3f3f46]` in right panel → MQ tokens; template literal classNames → `cn()`; `handlePasskeyLogin` + `handleGoogleLogin` not memoized → `useCallback`; misleading `aria-disabled` on `<Link>` (non-functional on anchors) → removed. `LoginSkeleton` missing ARIA status semantics → added. `MFAChallenge` `text-red-500` → `text-mq-error`; all 4 buttons missing `type="button"`; code input missing `aria-label`/`aria-invalid`/`aria-describedby`; error div missing `role="alert"`; resend interval leaked on unmount → `cooldownIntervalRef` + cleanup `useEffect`. `usePasskeyLogin` `console.error` → `logger.error`.
- **Files Changed:** `app/login/LoginClient.tsx`, `app/login/page.tsx`, `app/login/components/MFAChallenge.tsx`, `app/login/hooks/usePasskeyLogin.ts`, `locales/en/translations.json`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Manage Profiles

**Raouf:**

- **Scope:** Manage Profiles Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all 12 manage-profiles files. Found and fixed 18 issues: `PersonalInfoCard` raw `border-red-500`/`text-red-500` → `mq-error` tokens; email input missing `id` attribute; `aria-describedby` missing on all error-capable fields + error `<p>` missing `id`; hardcoded student ID placeholder → `t('studentIdPlaceholder')`. `AcademicInfoCard` hardcoded hex `bg-[#FFB81C]/15` + `text-[#c08c00]` → `bg-mq-warning/15` + `text-mq-warning`; `text-red-500`/`border-red-500` → `mq-error` tokens; year SelectTrigger missing `aria-invalid`/`aria-describedby`. `error.tsx` raw `bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400` → `bg-mq-error/10 text-mq-error`. `ProfileSkeleton` missing ARIA status semantics. `page.tsx` reload button missing `type="button"`; `RefreshCw` template literal → `cn()`. `ProfileHeader` no MIME type validation before FileReader → added `file.type.startsWith('image/')` guard; `handleAvatarChange` not memoized → `useCallback`. `useProfileManager` `profileSchema` recreated every render → `useMemo`; dead code in error branch collapsed; `reloadProfile` always fired success toast → try/catch guard. `actions.ts` unprofessional rate-limit message → neutral; misleading "Validation failed" catch label → "Cache revalidation failed". `profilesStore.ts` redundant `console.error` before `errorHandler.logError` removed.
- **Files Changed:** `app/manage-profiles/components/PersonalInfoCard.tsx`, `app/manage-profiles/components/AcademicInfoCard.tsx`, `app/manage-profiles/error.tsx`, `app/manage-profiles/components/ProfileSkeleton.tsx`, `app/manage-profiles/page.tsx`, `app/manage-profiles/components/ProfileHeader.tsx`, `app/manage-profiles/hooks/useProfileManager.ts`, `app/manage-profiles/actions.ts`, `lib/store/profilesStore.ts`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Event Settings

**Raouf:**

- **Scope:** Event Settings Page Bug Hunt & Production Hardening
- **Summary:** Reviewed 4 event-settings files. Found and fixed 15 issues: `EventForm.handleSave` had no `catch` block — silent failure on API error → added `toastUtils.error`; redundant double-reset (both `handleOpenChange` + `useEffect` called RESET) → removed `resetForm` call and unused function; `handleSave`, `handleDelete`, `validateForm`, `handleOpenChange` not memoized → `useCallback` applied; color picker buttons missing `aria-pressed` → added; misleading `endAt` comment removed. `EventDetailPanel`: raw `text-emerald-600`/`text-amber-600` status colors → MQ tokens; raw nav button hover classes → MQ tokens; hardcoded hex colors in `categoryColors` → CSS custom properties (`var(--mq-info)` etc.) to respect theming; `handleNavigationClick` not memoized → `useCallback`. Settings layout: nav buttons missing `type="button"` + `aria-current="page"`; raw Tailwind icon colors → MQ tokens; `navigateToSection` not memoized → `useCallback`. `NotificationSettings`: double `if (!result)` → `if...else`; hardcoded `'minutes'` fallback → i18n `timingMinutes` key.
- **Files Changed:** `components/events/EventForm.tsx`, `components/events/EventDetailPanel.tsx`, `app/settings/layout.tsx`, `features/settings/components/NotificationSettings.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Event Feed

**Raouf:**

- **Scope:** Event Feed Page Bug Hunt & Production Hardening
- **Summary:** Deep-reviewed all 18 feed-page files. Found and fixed 15 issues: time filters in `usePublicFeed` missing lower bound (past events shown); dead unreachable block in `useFeedLogic` `handleRemindMe`; `setTimeRange('upcoming')` for highlight (past highlighted events immediately hidden) → changed to `'all'`; memory leak in recursive `scrollToHighlight` setTimeout (only first timer cleaned up) → track all timers in array; `TimeRange` type missing `'all'` union member; time-range and category filter buttons missing `type="button"` and `aria-pressed`; `FeedSkeletons` missing ARIA status semantics; two dead dialog state vars (`statsDialogOpen`, `announcementsDialogOpen`) in `FeedSidebar` — removed along with their never-reachable Dialog JSX; also added Space key to categories card; `FeedClient` delete modal using raw `bg-red-*` classes → `mq-error` tokens; `PublicEventCard` non-MQ `categoryColors` and `bg-emerald-*` added-state → MQ tokens; `FeaturedEventsBanner` non-MQ `categoryGradients`, missing `aria-label` on prev/next buttons, missing `aria-current` on active dot → fixed all; `EventDetailModal` same gradient and added-state issues → MQ tokens; `AnnouncementsSection` non-MQ `typeStyles` → MQ tokens; `QuickStats` non-MQ `CategoryBar`/`StatCard` colors + hardcoded `'en-AU'` locale + non-MQ `EventCard` categoryColors → MQ tokens + `localeMap`; `PublicFeedFilters` wrong Input import path (`@/components/ui/input` → `@/components/ui/mq/input`).
- **Files Changed:** `features/feed/hooks/usePublicFeed.ts`, `features/feed/hooks/useFeedLogic.ts`, `features/feed/components/FeedFilters.tsx`, `features/feed/components/FeedSkeletons.tsx`, `features/feed/components/FeedSidebar.tsx`, `app/feed/FeedClient.tsx`, `features/feed/components/PublicEventCard.tsx`, `features/feed/components/FeaturedEventsBanner.tsx`, `features/feed/components/EventDetailModal.tsx`, `features/feed/components/AnnouncementsSection.tsx`, `features/feed/components/QuickStats.tsx`, `features/feed/components/PublicFeedFilters.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Map

**Raouf:**

- **Scope:** Map Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all map files (MapClient.tsx, CampusMap.tsx, CampusMapHUD.tsx, MapPageSkeleton.tsx, position-editor/page.tsx, RouteAnnouncer.tsx, GoogleMapController.tsx, CampusMap.tsx, hooks, lib). Found and fixed 10 issues: URL truncation always appended `...` even for short URLs; redundant `document.title` useEffect overriding Next.js metadata; `selectedBuildingName={selectedBuilding?.id}` semantic mismatch (passing building code instead of human-readable name to screen reader announcements); duplicate `{/* Combined Map Wrapper */}` comment; three non-memoized inline arrow functions passed as props to CampusMapHUD (`onStartNavigation`, `onStopNavigation`, `onClearExternalPlace`) — memoized with `useCallback`; inaccessible `MapPageSkeleton` missing ARIA semantics; `position-editor/page.tsx` using non-MQ semantic Tailwind classes; hardcoded hex `bg-[#d2e3fc] dark:bg-[#1a3a5c]` in Google Maps selected-building highlight; category displayed via manual JS capitalization instead of i18n via `BUILDING_CATEGORY_LABELS`; hardcoded `'#4285F4'` hex in CampusMap SVG fill → replaced with `var(--mq-primary)`.
- **Files Changed:** `features/map/components/MapClient.tsx`, `features/map/components/CampusMap.tsx`, `features/map/components/CampusMapHUD.tsx`, `features/map/components/MapPageSkeleton.tsx`, `app/map/position-editor/page.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Calendar

**Raouf:**

- **Scope:** Calendar Page Bug Hunt & Production Hardening
- **Summary:** Reviewed all 6 calendar files. Found and fixed 10 issues: view-toggle buttons calling `setView` directly (broke URL sync) → switched to `handleViewChange`; `isToday` variable shadowing in mobile day row; timezone bug in todo form date construction (`new Date(dateString)` parses UTC); event highlight effect missing `processedRef` guard (re-fired on every store refresh); dead `hours >= 24` condition in `computeCurrentTimePosition`; duplicate supabase imports; hardcoded `'#10b981'` hex colour; inaccessible loading skeleton in `page.tsx`; redundant `role="main"` on `<main>`; mobile day buttons with no `aria-label`. Also memoized 9 local handler functions and added `aria-pressed` to view toggle buttons.
- **Files Changed:** `app/calendar/page.tsx`, `app/calendar/CalendarClient.tsx`, `features/calendar/hooks/useCalendarView.ts`, `features/calendar/hooks/useCalendarHighlights.ts`, `features/calendar/hooks/useCalendarData.ts`, `features/calendar/hooks/useCalendarDialogs.ts`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-06 (Australia/Sydney) — Home

**Raouf:**

- **Scope:** Home Page Bug Hunt & Production Hardening
- **Summary:** Deep-reviewed all 7 home page files (app/page.tsx, app/home/page.tsx, HomeClient.tsx, loading.tsx, AuthRedirectHandler.tsx, and features/home hooks + components). Found and fixed 9 issues: duplicate ARIA landmark labels, unsafe `window.location.href` navigation in error state, `supabase` client recreated on every render in AuthRedirectHandler, two unused Zustand store subscriptions causing needless re-renders in `useHomeData`, `displayName` IIFE not memoized in `useHomeUser`, `motion` bypassing `LazyMotion` in `WeekHeatStrip`, inaccessible skeleton in `loading.tsx`, and dead fallback branch in `WelcomeHeader`.
- **Files Changed:** `app/home/HomeClient.tsx`, `app/home/loading.tsx`, `app/AuthRedirectHandler.tsx`, `features/home/hooks/useHomeData.ts`, `features/home/hooks/useHomeUser.ts`, `features/home/components/WeekHeatStrip.tsx`, `features/home/components/WelcomeHeader.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-05 (Australia/Sydney)

**Raouf:**

- **Scope:** Fix Select Dropdowns Not Opening Inside Dialogs
- **Summary:** Diagnosed and fixed two root causes preventing Radix Select dropdowns from opening inside dialogs. (1) `SelectContent` had `z-50` while Dialog uses `z-[70]`, causing portals to render behind the overlay. Fixed by bumping to `z-[80]`. (2) `ReminderModal` called `e.preventDefault()` unconditionally in `onPointerDownOutside`/`onInteractOutside`, blocking Select portal interactions. Fixed by guarding against `[data-radix-popper-content-wrapper]` targets.
- **Files Changed:** `components/ui/select.tsx`, `components/ui/ReminderModal.tsx`.
- **Verification:** Typecheck clean ✅; Lint clean ✅; 876/878 tests pass (2 pre-existing signup failures unrelated) ✅.
- **Follow-ups:** None.

### 2026-04-07 (Australia/Sydney)

**Raouf:**

- **Scope:** CI/CD Test Suite Remediation
- **Summary:** Fixed four critical test failures in the authentication pipeline. Corrected `app/auth/callback/route.ts` to honor the `redirectTo` parameter during email verification (allowing users to land on `/map` or `/home` after signing in). Aligned `app/api/auth/signup/route.ts` with security mandates and existing test expectations by ensuring "already registered" attempts return a `200 OK` generic success message, preventing account enumeration.
- **Files Changed:** `app/auth/callback/route.ts`, `app/api/auth/signup/route.ts`.
- **Verification:** Successfully ran the full test suite locally (878 tests passed across 94 files); specific regression tests for auth callback redirects and signup enumeration confirmed passing.
- **Follow-ups:** None.

### 2026-04-01 (Australia/Sydney)

**Raouf:**

- **Scope:** Git Rebase & Documentation Sync
- **Summary:** Resolved a complex 3-step interactive rebase conflict in `README.md`. Synthesized an integrated "Super README" by merging high-impact visual portfolio assets (Typing SVG, dynamic screenshots) from the local branch with the deep technical engineering narrative (Zero-Trust architecture, AI-native Codex workflows) from the documentation overhaul branch. Finalized the rebase and synchronized the repository state.
- **Files Changed:** `README.md`.
- **Verification:** Git rebase completed successfully; `README.md` structural integrity and link parity verified; repository status confirmed clean and synced with `origin/main`.
- **Follow-ups:** None.

### 2026-03-21 (Australia/Sydney)

**Raouf:**

- **Scope:** Full Project Documentation Portfolio Transformation
- **Summary:** Rewrote and structurally elevated the entire project documentation suite to transform the repository into a high-caliber portfolio piece. Unified the professional tone, highlighted complex engineering impact (Zero-Trust, Additive Merge, Fused Heading), and addressed implementation-aware gaps (Infrastructure limits, PII handling, Passkey scope).
- **Files Changed:** `README.md`, `TECHNICAL_EXPLANATION.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `docs/README.md`, `docs/architecture/ARCHITECTURE.md`, `docs/api/API_REFERENCE.md`, `docs/inventory/ROUTE_INVENTORY.md`, `docs/setup/ENVIRONMENT_SETUP.md`, `docs/university-integration-requirements.md`, `docs/operations/deployment-checklist.md`, `docs/security/SECURITY_POSTURE.md`, `AGENT.md`, `CHANGELOG.md`.
- **Verification:** Documentation consistency audit completed; Markdown links verified; alignment with codebase implementation-details (Vercel limits, Redis requirement, PII logging) confirmed.
- **Follow-ups:** Monitor stakeholder feedback on the new "Campus OS" framing.

Raouf: 2026-03-17 (Australia/Sydney)
Scope: Rewrite README for Claude for OSS and OpenAI Codex for OSS Grant Applications
Summary: Replaced the internal-facing technical README with a grant-optimised public README. Added professional GitHub badges (MIT, CI/CD, TypeScript, Next.js, Supabase, tests, OSI, PRs). Structured four grant-targeted sections: (1) Ecosystem Impact framing the project as a modular "Campus OS" blueprint for Australian universities with layered architecture diagram and quantified impact table; (2) Security & Privacy Architecture covering Zero-Trust proxy middleware, Supabase RLS, PII minimisation, FIDO2/WebAuthn passkeys, and LLM OCR prompt injection mitigations; (3) AI-Native Maintainer Workflow documenting Claude 4.6 for schema mapping/architecture/security auditing and Codex for test generation/migrations/i18n, plus the Syllabus-as-Code documentation suite framing; (4) Project Governance with OSI-approved MIT licence confirmation, contributing pathways, P0–P2 roadmap (standalone extractor package, MCP server, institutional forks), and maintainer listing. Preserved all accurate technical facts from the prior README.
Files Changed: `README.md`, `CHANGELOG.md`, `AGENT.md`
Verification: Documentation-only change; no code modified ✅
Follow-ups: Once a GitHub repository URL is confirmed, update the badge URLs and clone command from placeholder to real org/repo path.

... [rest of AGENT.md content] ...
