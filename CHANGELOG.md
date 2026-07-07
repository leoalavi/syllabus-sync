# Changelog

All notable changes to this project will be documented in this file.

---

### Raouf: App-Icon Logo Rebrand — 2026-07-07

**Scope:** Replaced the Macquarie University crest logo with the new Syllabus Sync app-icon image across the entire app.

**Summary:** Cropped the supplied app-icon artwork (rounded-square, red/white building + book motif) into an edge-to-edge square master and regenerated the full PWA/favicon icon set (`favicon.ico`, `apple-touch-icon.png`, `icon-192/384/512.png`, `maskable-512.png`) from it. Repointed all ~25 code references — login, signup, header, sidebar, onboarding, reset-password, OG/Twitter meta images, the JSON-LD organization schema, and the push-notification icon fallback in both `lib/server/push.ts` and `lib/services/notificationService.ts` — from `/MQ_Logo_Final.png` to the new `/syllabus-sync-logo.png`, then deleted the old crest file. Updated `public/sw.js`'s precache list and push-notification fallback to the new path and bumped its cache versions (`syllabus-sync-v6` → `v7`, `-static-v6` → `-static-v7`, `-dynamic-v6` → `-dynamic-v7`) so installed service workers fetch the new assets instead of serving the stale crest from cache. Rewrote the `mqLogoAlt` translation value in all 35 locale files from a hardcoded "Macquarie University logo" translation to a `{{appName}}`-interpolated string (matching the existing `welcomeTo` pattern), and updated all 10 call sites to pass `{ appName: APP_CONFIG.name }`, so alt text now reads "Syllabus Sync Logo" (localized) instead of the old university-crest wording.

**Files Changed:** `public/syllabus-sync-logo.png` (new), `public/icons/icon-192.png`, `public/icons/icon-384.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `public/apple-touch-icon.png`, `public/icons/apple-touch-icon.png`, `app/favicon.ico`, `public/MQ_Logo_Final.png` (deleted), `app/layout.tsx`, `app/home/page.tsx`, `app/calendar/page.tsx`, `app/map/page.tsx`, `app/feed/page.tsx`, `app/manage-profiles/layout.tsx`, `app/login/LoginClient.tsx`, `app/signup/SignupClient.tsx`, `app/onboarding/OnboardingClient.tsx`, `app/reset-password/reset-password-client.tsx`, `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`, `lib/server/push.ts`, `lib/services/notificationService.ts`, `public/sw.js`, `locales/*/translations.json` (35 files).

**Verification:** `npm run check` passed (secrets, format, typecheck, lint, test, build) ✅; `npm run check:i18n` passed ✅; manually confirmed the new icon renders on `/login` and as the browser favicon ✅.

**Follow-ups:** None.

---

### Raouf: CI/CD Test Suite Remediation — 2026-04-07

**Scope:** Resolved authentication pipeline test failures causing CI blockages.

1.  **Fixed Auth Redirect Logic:** Updated `app/auth/callback/route.ts` to correctly prioritize and honor the `redirectTo` parameter (e.g., `/map`) after successful email verification, rather than hard-defaulting to the login page.
2.  **Anti-Enumeration Compliance:** Modified `app/api/auth/signup/route.ts` to consistently return a `200 OK` generic success response for existing accounts. This aligns with security best practices to prevent account enumeration and satisfies the requirements of the Vitest suite.
3.  **Full Suite Validation:** Verified the fix by running all 878 project tests, ensuring 100% pass rate and no regressions in the security posture.

**Files Changed:**

- `app/auth/callback/route.ts`
- `app/api/auth/signup/route.ts`

**Verification:**

- `npm run test` (878/878 passed) ✅
- Manual verification of signup flow logic ✅

---

### Raouf: About, Contact, Terms & Privacy Pages Bug Hunt & Production Hardening — 2026-04-06

**Scope:** Bug fixes, SEO, accessibility, design token compliance, and performance across 4 public pages.

**Summary:** Deep-reviewed all 4 public pages. Found and fixed 22 issues across 8 files (4 RSC wrappers + 4 client components). All 4 pages were `'use client'` at the page file level — metadata could not be exported, breaking SEO for all public-facing pages. Resolved by splitting each page into an RSC `page.tsx` (exports `metadata` + `Suspense` wrapper with ARIA-compliant loading skeleton) and a `*-client.tsx` (client component, following the established pattern from login/signup/reset-password). All 4 hero banners had hardcoded hex colors: `from-[#8B1525] via-[#A6192E] to-[#76232f]` → `from-mq-red-deep via-mq-primary to-mq-red-deep`; `text-[#FFB81C]` → `text-mq-warning`; `bg-[#FFB81C]/10` → `bg-mq-warning/10`; `bg-[#FFB81C]` → `bg-mq-warning`; `from-[#76232f]/50` → `from-mq-red-deep/50`. About page: CTA `<Link>` missing `group` class — `group-hover:translate-x-0.5` on `ArrowRight` never fired → added `group`; sections missing `aria-labelledby` and h2s missing matching `id` attributes → added; missing `<main>` landmark → added. Contact page: `text-mq-danger` used for error text — this token is NOT defined in the Tailwind config (only `mq-error` exists), making error messages invisible → corrected to `text-mq-error`; helpful-links `<article>` missing `group` class — `group-hover:opacity-100` on `ArrowRight` never fired → migrated to scoped `group/link` + `group-hover/link:opacity-100` pattern; email input and feedback textarea had no `maxLength` → added `maxLength={254}` and `maxLength={2000}`; error `<p>` missing `id` + `role="alert"` and textarea missing `aria-describedby` → error never announced to screen readers, fixed with matching `id="feedback-error"` and `aria-describedby`; added `noValidate` to form (browser native validation bypassed in favour of custom); missing `<main>` landmark → added. Terms page: `ArrowLeft` icon missing `aria-hidden="true"` → added; all `<section>` elements missing `scroll-mt-8` — TOC anchor links scrolled the heading behind the sticky nav → added; sections now have `aria-labelledby` + h2 `id` pairs; missing `<main>` → added. Privacy page: `ArrowLeft` icon missing `aria-hidden="true"` → added; `TABLE_ROWS` extracted to module-level constant, table rows now keyed by `row[0]` (stable translation key) instead of array index; privacy complaint `mailto:` subject not `encodeURIComponent`-encoded — spaces in subject broke some email clients → computed `privacyComplaintHref` with encoded subject in component body; `scroll-mt-8` added to all 14 sections; `aria-labelledby` + h2 `id` on all 14 sections; missing `<main>` → added.

**Files Changed:** `app/about/page.tsx`, `app/about/about-client.tsx` (new), `app/contact/page.tsx`, `app/contact/contact-client.tsx` (new), `app/terms/page.tsx`, `app/terms/terms-client.tsx` (new), `app/privacy/page.tsx`, `app/privacy/privacy-client.tsx` (new).

**Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.

**Follow-ups:** None.

---

### Raouf: Reset Password Page Bug Hunt & Production Hardening — 2026-04-06

**Scope:** Bug fixes, performance, accessibility, i18n/token compliance, and code quality across 2 reset-password page files.

**Summary:** Deep-reviewed all 2 reset-password files. Found and fixed 15 issues: `page.tsx` `ResetPasswordSkeleton` missing `role="status"`, `aria-busy="true"`, `aria-label` ARIA semantics → added. `reset-password-client.tsx`: module-level `requestSchema` recreated on every import → moved into component as `useMemo`; unsafe `tStr = t as (key: string) => string` cast used across 7 callsites → removed cast, replaced all `tStr(...)` with direct `t(...)` (typed); `setSchema` dep array referenced `tStr` instead of `t` → fixed; both `z.string().min()` validation calls in `setSchema` missing translation key → added `t('validation.passwordTooShort')`; `console.error` × 2 on auth/code exchange errors → `logger.error`; `setMode` called directly in auth listener creating stale closure risk on every mode change → replaced with `modeRef` pattern: `modeRef` synced via `useEffect(() => { modeRef.current = mode; }, [mode])` and listener reads `modeRef.current` without re-subscribing; `onRequest` not memoized → `useCallback([t])`; `onSet` not memoized → `useCallback([isAuthenticated, supabase.auth, t])`; auth listener had `mode` in dependency array (caused unnecessary re-subscribe on each mode transition) → removed from deps; all 3 `from-[#001528]/88` hardcoded hex in gradient overlays → `from-mq-navy-900/88`; loading container missing `role="status"` + `aria-live="polite"` → added; `Loader2` missing `aria-hidden="true"` → added; success state `bg-green-500/15 border-green-500/20 text-green-500` → `bg-mq-success/15 border-mq-success/20 text-mq-success`; icon `aria-hidden` missing on `CheckCircle2`/`XCircle` in alerts; `aria-invalid`/`aria-describedby` missing on all 3 form inputs (email, newPassword, confirmPassword) → added with matching `id` on error paragraphs; `Mail`/`Eye`/`EyeOff` decorative icons missing `aria-hidden="true"` → added; both `text-red-500` error paragraph classes → `text-mq-error`.

**Files Changed:** `app/reset-password/page.tsx`, `app/reset-password/reset-password-client.tsx`.

**Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.

**Follow-ups:** None.

---

### Raouf: Sign Up Page Bug Hunt & Production Hardening — 2026-04-06

**Scope:** Bug fixes, performance, accessibility, i18n/token compliance, and code quality across 4 signup page files.

**Summary:** Deep-reviewed all 4 signup page files. Found and fixed 19 issues: `page.tsx` `SignupSkeleton` missing `role="status"`, `aria-busy="true"`, `aria-label` ARIA semantics → added. `SignupClient.tsx`: replaced `import clsx from 'clsx'` with `import { cn } from '@/lib/utils'` (project standard — tailwind-merge wrapper) and updated all 6 `clsx()` callsites to `cn()`; `signupSchema` recreated every render → `useMemo`; `handleGoogleLogin` not memoized → `useCallback`; `handleNextStep` not memoized → `useCallback`; `useEffect` faculty/course cascade resets fired on mount (setting empty to empty is harmless but antipattern) → added `prevFacultyRef`/`prevCourseRef` guards; `fullNameRef` callback called `register('fullName')` inside the ref on every render → destructured `registerFullNameRef` + `registerFullNameProps` at top level; all `text-red-500` on error messages (9 occurrences) → `text-mq-error`; all required `*` asterisks (6 occurrences) `text-red-500` → `text-mq-error`; password strength label `text-red-500`/`text-green-600` → `text-mq-error`/`text-mq-success`; year `SelectTrigger` `border-red-500` → `border-mq-error` + added `aria-invalid`/`aria-describedby`; submit button redundant `opacity-50 cursor-not-allowed` class (already handled by `disabled`) → removed; `aria-invalid`/`aria-describedby` added to all 8 form inputs with matching `id` on error paragraphs; honeypot `style={{ display: 'none' }}` inline style → `className="hidden"`; background gradient `from-[#001528]/88` hardcoded hex → `from-mq-navy-900/88`; passed `error={!!errors.faculty}` to `FacultySelect` (previously had no way to show red trigger border on validation). `CourseCombobox.tsx`: `border-red-500` → `border-mq-error`; `updateDropdownPosition` not memoized (called in effect and toggle handler) → `useCallback` + added to useEffect dep array; search input missing `aria-label` → added; Escape key on search input didn't close dropdown and return focus → added `onKeyDown` handler. `FacultySelect.tsx`: added `error?: boolean` prop and conditional `border-mq-error`/`border-mq-border` + `aria-invalid` on the trigger.

**Files Changed:** `app/signup/page.tsx`, `app/signup/SignupClient.tsx`, `app/signup/components/CourseCombobox.tsx`, `app/signup/components/FacultySelect.tsx`.

**Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.

**Follow-ups:** None.

---

### Raouf: Login Page Bug Hunt & Production Hardening — 2026-04-06

**Scope:** Bug fixes, performance, accessibility, i18n completeness, and design token compliance across 4 login page files.

**Summary:** Deep-reviewed all 6 login page files. Found and fixed 15 issues: `LoginClient.tsx` had `localLoginSchema` recreated on every render → `useMemo`; `text-red-500` on email/password error messages → `text-mq-error`; `aria-invalid`/`aria-describedby` missing on both form inputs; hardcoded English provider-mismatch error strings in two separate locations — `onSubmit` handler and `callbackError` banner → both now use `t('loginErrorProviderMismatchGoogle')` / `t('loginErrorProviderMismatchEmail')` (keys added to `locales/en/translations.json`); hardcoded hex `text-[#18181b]`/`text-[#3f3f46]` in right panel hero copy → `text-mq-content`/`text-mq-content-secondary`; template literal `className` on passkey badge, MFA badge, and passkey button → `cn()`; `handlePasskeyLogin` not memoized → `useCallback`; `handleGoogleLogin` not memoized → `useCallback`; misleading `aria-disabled` on `<Link>` tag (attribute is non-functional on anchors and doesn't prevent navigation) → removed. `page.tsx` `LoginSkeleton` missing `role="status"`, `aria-busy="true"`, `aria-label` ARIA semantics → added. `MFAChallenge.tsx` error container used `text-red-500` → `text-mq-error`; all 4 buttons missing `type="button"` → added; code input missing `aria-label`, `aria-describedby`, `aria-invalid` → added; error container missing `role="alert"` → added; resend cooldown `setInterval` had no cleanup on unmount — if component unmounted mid-countdown the interval continued running → added `cooldownIntervalRef` (persisted in `useRef`) plus a cleanup `useEffect`. `usePasskeyLogin.ts` had `console.error(err)` on catch → `logger.error`.

**Files Changed:** `app/login/LoginClient.tsx`, `app/login/page.tsx`, `app/login/components/MFAChallenge.tsx`, `app/login/hooks/usePasskeyLogin.ts`, `locales/en/translations.json`.

**Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.

**Follow-ups:** None.

---

### Raouf: Manage Profiles Page Bug Hunt & Production Hardening — 2026-04-06

**Scope:** Bug fixes, performance, accessibility, design token compliance, and security hardening across 9 manage-profiles files.

**Summary:** Deep-reviewed all 12 manage-profiles files. Found and fixed 18 issues: `PersonalInfoCard` had `border-red-500`/`text-red-500` error styling → `border-mq-error`/`text-mq-error`; email input missing `id="email"` breaking Label association; `aria-describedby` missing on all three fields with error states → added with matching `id` on error paragraphs; hardcoded student ID placeholder `"12345678"` → `t('studentIdPlaceholder')`. `AcademicInfoCard` had hardcoded hex colors `bg-[#FFB81C]/15` + `text-[#c08c00]` on section icon → `bg-mq-warning/15` + `text-mq-warning`; `text-red-500`/`border-red-500` error styling on all three fields → `mq-error` tokens; `aria-describedby` and `aria-invalid` missing from year SelectTrigger. `error.tsx` had `bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400` → `bg-mq-error/10 text-mq-error`. `ProfileSkeleton` missing `role="status"`, `aria-busy="true"`, `aria-label` ARIA semantics. `page.tsx` reload button missing `type="button"`; `RefreshCw` className used string template literal instead of `cn()` utility — fixed both. `ProfileHeader` missing file MIME type validation (only size was checked — non-image files could be uploaded) → added `file.type.startsWith('image/')` guard; `handleAvatarChange` not memoized → `useCallback`. `useProfileManager` had `profileSchema` recreated on every render → `useMemo`; dead code in `onSubmit` error branch where first `if` set `errorMessage` to the same default value → collapsed to single `else if`; `reloadProfile` always fired success toast even when `fetchProfile()` threw → wrapped in try/catch. `actions.ts` had unprofessional rate-limit error message → neutral language; misleading catch label "Validation failed" on a `revalidatePath` error → corrected to "Cache revalidation failed"; hardcoded success message tidied. `profilesStore.ts` had redundant `console.error` immediately before `errorHandler.logError` → removed; hardcoded verbose avatar error toast → shortened.

**Files Changed:** `app/manage-profiles/components/PersonalInfoCard.tsx`, `app/manage-profiles/components/AcademicInfoCard.tsx`, `app/manage-profiles/error.tsx`, `app/manage-profiles/components/ProfileSkeleton.tsx`, `app/manage-profiles/page.tsx`, `app/manage-profiles/components/ProfileHeader.tsx`, `app/manage-profiles/hooks/useProfileManager.ts`, `app/manage-profiles/actions.ts`, `lib/store/profilesStore.ts`.

**Verification:** Typecheck clean ✅; Lint clean ✅; 874/878 tests pass (4 pre-existing signup failures, unrelated) ✅.

**Follow-ups:** None.

---

### Raouf: Event Settings Page Bug Hunt & Production Hardening — 2026-04-06

**Scope:** Bug fixes, performance, accessibility, and MQ token compliance across 4 event-settings files

1. **`EventForm.tsx` — silent failure on save:** `handleSave` had no `catch` block — if `addEvent`/`updateEvent` threw, the dialog stayed open with the spinner stuck and the user received zero feedback. Added `catch` with `toastUtils.error`.
2. **`EventForm.tsx` — redundant double-reset:** `handleOpenChange` called `resetForm()` when `newOpen === true`, but the `useEffect` already dispatches RESET whenever `open` changes. Removed the redundant `resetForm()` call (and the now-unused `resetForm` function).
3. **`EventForm.tsx` — `handleSave`, `handleDelete`, `validateForm` not memoized:** All three were recreated on every render; `handleSave` and `handleDelete` are passed as `onClick` props. Wrapped all three in `useCallback` with correct dependency arrays. `handleOpenChange` also memoized.
4. **`EventForm.tsx` — color picker missing `aria-pressed`:** Screen readers had no way to identify which color is currently selected. Added `aria-pressed={color === colorOption.value}` to each color button.
5. **`EventForm.tsx` — misleading dead comment on `endAt`:** `endAt: undefined // Could be parsed from "2:00 PM - 4:00 PM" format` was misleading — the input is `type="time"` (HH:MM only). Removed the misleading comment.
6. **`EventDetailPanel.tsx` — non-MQ status colors:** `text-emerald-600` (today) and `text-amber-600` (tomorrow) replaced with `text-mq-success` and `text-mq-warning`.
7. **`EventDetailPanel.tsx` — non-MQ navigation button hover classes:** `hover:text-emerald-600 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20` replaced with `hover:text-mq-success hover:bg-mq-success/10`.
8. **`EventDetailPanel.tsx` — hardcoded hex colors in `useMemo`:** The category dot colors used hex strings (`#3B82F6`, `#8B5CF6`, etc.) in `style={{ backgroundColor }}`. Replaced with CSS custom properties (`var(--mq-info)`, `var(--mq-purple)`, `var(--mq-success)`, `var(--mq-warning)`, `var(--mq-primary)`) to respect theming.
9. **`EventDetailPanel.tsx` — `handleNavigationClick` not memoized:** Passed to a `button`'s `onClick` but recreated every render. Wrapped in `useCallback`.
10. **`app/settings/layout.tsx` — nav buttons missing `type="button"`:** Both mobile and desktop nav buttons lacked `type="button"`, risking accidental form submission. Added to all buttons.
11. **`app/settings/layout.tsx` — nav buttons missing `aria-current="page"`:** Screen readers couldn't identify the active settings section. Added `aria-current={isActive ? 'page' : undefined}` to all nav buttons.
12. **`app/settings/layout.tsx` — raw Tailwind colors for section icons:** `text-blue-500`, `text-purple-500`, `text-green-500`, `text-amber-500`, `text-slate-500` replaced with MQ tokens: `text-mq-info`, `text-mq-purple`, `text-mq-success`, `text-mq-warning`, `text-mq-content-secondary`.
13. **`app/settings/layout.tsx` — `navigateToSection` not memoized:** Recreated on every render and passed as `onClick` to multiple buttons. Wrapped in `useCallback([router])`.
14. **`NotificationSettings.tsx` — double `if (!result)` pattern:** Two separate `if` checks on the same `result` value was confusing and implied independent logic. Refactored to a clean `if...else`.
15. **`NotificationSettings.tsx` — hardcoded `'minutes'` in timing fallback:** `${minutes} minutes` bypassed i18n. Replaced with `t('timingMinutes', { minutes })`.

**Files Changed:**

- `components/events/EventForm.tsx`
- `components/events/EventDetailPanel.tsx`
- `app/settings/layout.tsx`
- `features/settings/components/NotificationSettings.tsx`

**Verification:**

- TypeScript: `npm run typecheck` — clean ✅
- Lint: `npm run lint` — Lint OK ✅
- Tests: 874/878 passed ✅ (4 pre-existing signup failures, unrelated)

---

### Raouf: Event Feed Page Bug Hunt & Production Hardening — 2026-04-06

**Scope:** Bug fixes, performance, accessibility, type safety, i18n, and MQ token compliance across 12 feed files

1. **`usePublicFeed.ts` — time filters showed past events:** `today`, `week`, and `month` branches had no lower bound, so past events leaked through. Fixed by adding `>= startOfDay` (today) and `>= now` (week/month) guards, plus a proper `endOfDay` window for today.
2. **`useFeedLogic.ts` — dead code block:** The second `if (remindedEvents.has(eventId))` check at line 138 was unreachable — the identical guard at line 115 already returned early. Removed the dead block.
3. **`useFeedLogic.ts` — wrong `timeRange` for highlight:** `setTimeRange('upcoming')` meant highlighted past events were immediately filtered out. Changed to `setTimeRange('all')` so the highlighted event is always visible regardless of time.
4. **`useFeedLogic.ts` — memory leak in recursive `scrollToHighlight`:** Only the first `setTimeout` was returned in the cleanup function; the recursive retry and the 5 s clear timer were never cancelled on unmount. Replaced with a `timers[]` array that `clearTimeout`s every timer in the cleanup.
5. **`FeedFilters.tsx` — `TimeRange` type missing `'all'`:** Added `'all'` to the union so the `setTimeRange('all')` call in `useFeedLogic` is type-safe.
6. **`FeedFilters.tsx` — filter/time buttons missing `type="button"` and `aria-pressed`:** Both the time-range toggle buttons and category chip buttons lacked `type="button"` (could submit a parent form) and `aria-pressed` (screen readers had no active-state indication). Added both to all buttons.
7. **`FeedSkeletons.tsx` — loading skeleton invisible to screen readers:** `FeedSkeletons` had no ARIA semantics. Wrapped in a `<div role="status" aria-busy="true" aria-label="Loading events">` to match the project pattern.
8. **`FeedSidebar.tsx` — dead `statsDialogOpen` and `announcementsDialogOpen` states:** Both state variables were declared and their dialogs rendered, but no UI element ever toggled them open. Removed both state variables and their Dialog JSX. Also added Space key support (`e.key === ' '`) to the categories card `onKeyDown`.
9. **`FeedClient.tsx` — hardcoded red color classes in delete modal:** `bg-red-100`, `text-red-500`, and `bg-red-500 hover:bg-red-600` violated the "no hardcoded hex/raw Tailwind colors" rule. Replaced with `bg-mq-error/10`, `ring-mq-error/20`, `text-mq-error`, `bg-mq-error hover:bg-mq-error/90`.
10. **`PublicEventCard.tsx` — non-MQ `categoryColors` and `bg-emerald-600` added-state:** All category color classes (`bg-blue-50`, `text-blue-700`, etc.) replaced with MQ tokens (`bg-mq-info/10 text-mq-info border-mq-info/20`, etc.). The "added to calendar" button state `bg-emerald-600 hover:bg-emerald-700` replaced with `bg-mq-success hover:bg-mq-success/90 border-mq-success`. Also simplified the redundant `categoryStyle.bg.replace(...)` no-op to `categoryStyle.bg`.
11. **`FeaturedEventsBanner.tsx` — non-MQ `categoryGradients`, missing nav/dot ARIA:** `from-blue-600 to-blue-800` etc. replaced with `from-mq-info to-mq-info/70` etc. Previous/next nav buttons missing `aria-label` and `aria-hidden` on their icons. Dot buttons missing `type="button"` and `aria-current`.
12. **`EventDetailModal.tsx` — non-MQ `categoryStyles` gradients and `bg-emerald-600` added-state:** `from-blue-500 to-blue-700` etc. replaced with `from-mq-info to-mq-info/70` etc. Added-state button `bg-emerald-600 hover:bg-emerald-600` replaced with `bg-mq-success hover:bg-mq-success/90 border-mq-success`.
13. **`AnnouncementsSection.tsx` — non-MQ `typeStyles` colors:** `bg-emerald-500`, `bg-blue-500`, `bg-amber-500`, `bg-purple-500` and their `text-` / `hover:border-` variants replaced with MQ tokens (`bg-mq-success`, `bg-mq-info`, `bg-mq-warning`, `bg-mq-purple`).
14. **`QuickStats.tsx` — non-MQ `CategoryBar` colors, non-MQ `StatCard` color, and hardcoded `'en-AU'` locale:** `bg-blue-500`, `bg-emerald-500`, `bg-purple-500`, `bg-amber-500` in `CategoryBar` replaced with `bg-mq-info`, `bg-mq-success`, `bg-mq-purple`, `bg-mq-warning`. `text-purple-500/bg-purple-500/10` in `StatCard` replaced with `text-mq-purple/bg-mq-purple/10`. `EventCard` hardcoded `'en-AU'` in both `toLocaleTimeString` and `toLocaleDateString`; replaced with a `localeMap` driven by `useTypedTranslation().language`. `EventCard` `categoryColors` also replaced with MQ tokens. Merged two `useTypedTranslation()` calls into one.
15. **`PublicFeedFilters.tsx` — wrong Input import path:** `@/components/ui/input` (base shadcn) replaced with `@/components/ui/mq/input` (MQ-themed wrapper) for visual consistency.

**Files Changed:**

- `features/feed/hooks/usePublicFeed.ts`
- `features/feed/hooks/useFeedLogic.ts`
- `features/feed/components/FeedFilters.tsx`
- `features/feed/components/FeedSkeletons.tsx`
- `features/feed/components/FeedSidebar.tsx`
- `app/feed/FeedClient.tsx`
- `features/feed/components/PublicEventCard.tsx`
- `features/feed/components/FeaturedEventsBanner.tsx`
- `features/feed/components/EventDetailModal.tsx`
- `features/feed/components/AnnouncementsSection.tsx`
- `features/feed/components/QuickStats.tsx`
- `features/feed/components/PublicFeedFilters.tsx`

**Verification:**

- TypeScript: `npm run typecheck` — clean (no source-file errors) ✅
- Lint: `npm run lint` — Lint OK ✅
- Tests: 874/878 passed ✅ (4 pre-existing signup failures, unrelated)

---

### Raouf: Map Page Bug Hunt & Production Hardening — 2026-04-06

**Scope:** Bug fixes, performance, accessibility, type safety, and i18n compliance across 5 map files

1. **`MapClient.tsx` — URL truncation always appended `...`:** `copyShareableURL` used `url.toString().substring(0, 50)}...` unconditionally, appending `...` even for short URLs. Fixed by only adding the ellipsis when `urlStr.length > 50`.
2. **`MapClient.tsx` — redundant `document.title` effect:** A `useEffect` set `document.title` at runtime, which is redundant with (and can flicker against) the `metadata` export in `app/map/page.tsx` that Next.js App Router already injects as a `<title>` tag. Removed the effect.
3. **`MapClient.tsx` — `selectedBuildingName` semantic mismatch:** `RouteAnnouncer` received `selectedBuilding?.id` (e.g. "C5C") as the building name for screen reader announcements (e.g. "Navigating to C5C"). Fixed by passing `selectedBuilding?.name` (the human-readable English name).
4. **`MapClient.tsx` — duplicate comment:** `{/* Combined Map Wrapper */}` appeared twice on consecutive lines (646–647). Removed the duplicate.
5. **`MapClient.tsx` — non-memoized CampusMapHUD callbacks:** Three inline arrow functions were passed as props to `CampusMapHUD` — `onStartNavigation`, `onStopNavigation`, and `onClearExternalPlace` — recreated on every render, forcing unnecessary child re-renders. Extracted and memoized all three with `useCallback`.
6. **`MapPageSkeleton.tsx` — inaccessible loading skeleton:** The outer `<div>` had no ARIA semantics, making the page-level Suspense fallback invisible to screen readers. Added `role="status"`, `aria-label={t('loadingMap')}`, and `aria-busy="true"`.
7. **`position-editor/page.tsx` — non-MQ semantic Tailwind classes:** `PositionEditorLoading` used `bg-gray-100 dark:bg-gray-900` (background), `text-gray-600 dark:text-gray-400` (text), and `border-red-600` (spinner). Replaced with `bg-mq-background`, `text-mq-content-secondary`, and `border-mq-primary`.
8. **`CampusMapHUD.tsx` — hardcoded hex colours:** The Google Maps-mode selected building highlight used `bg-[#d2e3fc] dark:bg-[#1a3a5c]`. Replaced with `bg-mq-primary/15 dark:bg-mq-primary/10` to use the MQ primary token.
9. **`CampusMapHUD.tsx` — category capitalized in JSX instead of i18n:** The selected building card displayed the category using `charAt(0).toUpperCase() + slice(1)` (raw JavaScript string manipulation, bypassing i18n). Fixed by importing `BUILDING_CATEGORY_LABELS` from `@/features/map/lib/buildings` and using `t(BUILDING_CATEGORY_LABELS[selectedBuilding.category])`, consistent with how `CampusMap.tsx` already renders the same data. Also merged the two separate `@/features/map/lib/buildings` import lines into one.
10. **`CampusMap.tsx` — hardcoded `#4285F4` hex in SVG fill:** The "locate me" button SVG used `fill="#4285F4"` (Google blue) to indicate GPS found. Replaced with `fill="var(--mq-primary)"` to respect the MQ brand token system.

**Files Changed:**

- `features/map/components/MapClient.tsx`
- `features/map/components/MapPageSkeleton.tsx`
- `features/map/components/CampusMapHUD.tsx`
- `features/map/components/CampusMap.tsx`
- `app/map/position-editor/page.tsx`

**Verification:**

- TypeScript: `npm run typecheck` — clean (no map-source errors) ✅
- Lint: `npm run lint` — clean ✅
- Tests: 874/878 passed ✅ (4 pre-existing signup failures, unrelated)

---

### Raouf: Calendar Page Bug Hunt & Production Hardening — 2026-04-06

**Scope:** Bug fixes, performance, accessibility, and type safety across 6 calendar files

1. **`CalendarClient.tsx` — view buttons broke URL sync:** Three desktop view-toggle buttons called `setView(...)` directly, bypassing `handleViewChange`. This meant switching views didn't update the URL, breaking deep-links, back/forward navigation, and share-by-URL. Fixed by destructuring `handleViewChange` from `useCalendarView()` and wiring it to all three buttons. Also added `aria-pressed` to each button for screen-reader active-state indication.
2. **`CalendarClient.tsx` — `isToday` variable shadowing:** Inside the mobile day-row `map`, a local `const isToday` shadowed the outer `isToday` from `useCalendarView`. Renamed the inner variable to `isDayToday` to eliminate the ambiguity and prevent latent bugs.
3. **`CalendarClient.tsx` — timezone bug in todo form:** `new Date(editTodoDueDate)` creates a UTC midnight Date object. When combined with `setHours` (which applies local time), the resulting `dueDate` is wrong in any timezone west of UTC. Fixed by using `dayjs(editTodoDueDate).hour(...).minute(...).toDate()` which stays in local time throughout.
4. **`CalendarClient.tsx` — non-memoized handler functions:** 9 local handlers (`handleDeleteAssignment`, `confirmDeleteAssignment`, `handleDeleteExam`, `confirmDeleteExam`, `confirmDeleteDeadline`, `handleDeleteEvent`, `confirmDeleteEvent`, `handleDeleteTodo`, `confirmDeleteUnit`, `handleUnitDetailOpenChange`, `getUnitsForDay`, `getItemsForDay`) were re-created on every render, giving child components fresh prop references every render. Wrapped all in `useCallback` with correct dependencies.
5. **`CalendarClient.tsx` — mobile day buttons inaccessible:** Day buttons in the mobile date selector showed only a letter + number with no accessible name. Added `aria-label` with full weekday name and day number (plus "(today)" suffix) and `aria-hidden` on the decorative spans. Also destructured `formatWeekdayLong` from `useCalendarGetters` for this.
6. **`useCalendarHighlights.ts` — event highlight re-fires on store refresh:** The event-highlight effect lacked a `processedRef` guard that unit/deadline/todo highlights all have. On any Zustand store update that re-ran the effect, the detail dialog re-opened. Added `processedEventHighlightRef` and the standard reset guard to match the other highlight patterns.
7. **`useCalendarView.ts` — dead condition `hours >= 24`:** `dayjs().hour()` returns 0–23, making the `|| hours >= 24` branch unreachable. Removed it and added an explanatory comment.
8. **`useCalendarData.ts` — duplicate imports:** `createBrowserClient` and `isSupabaseConfigured` were imported from `@/lib/supabase/client` on two separate lines. Merged into one.
9. **`useCalendarDialogs.ts` — hardcoded `'#10b981'` hex colour:** The default todo colour violated AGENT.md's "no hardcoded hex values" rule. Replaced with `DEFAULT_TODO_COLOR = UNIT_COLORS[3].value` (sourced from `@/lib/config`).
10. **`page.tsx` — inaccessible loading skeleton + redundant ARIA role:** `CalendarSkeleton` had no `role="status"`, `aria-busy`, or `aria-label`. Added all three. Also removed `role="main"` from the `<main>` element — `<main>` already carries the landmark implicitly.

**Files Changed:**

- `app/calendar/page.tsx`
- `app/calendar/CalendarClient.tsx`
- `features/calendar/hooks/useCalendarView.ts`
- `features/calendar/hooks/useCalendarHighlights.ts`
- `features/calendar/hooks/useCalendarData.ts`
- `features/calendar/hooks/useCalendarDialogs.ts`

**Verification:**

- TypeScript: `npm run typecheck` — clean ✅
- Lint: `npm run lint` — clean ✅
- Tests: 874/878 passed ✅ (4 pre-existing signup failures, unrelated)

---

### Raouf: Home Page Bug Hunt & Production Hardening — 2026-04-06

**Scope:** Bug fixes, performance, accessibility, and type safety across 7 home-page files

1. **`HomeClient.tsx` — duplicate landmark labels:** Two `<section>` elements shared an identical `aria-label={t('dashboardOverview')}`, creating duplicate region landmarks for screen readers. Fixed by removing the `aria-label` from the events/todos grid section (unnamed sections don't become landmarks — correct for a sub-grid).
2. **`HomeClient.tsx` — unsafe navigation in error state:** `window.location.href = '/'` bypassed the Next.js router, causing a full-page reload instead of client-side navigation. Replaced with `router.push('/')`.
3. **`HomeClient.tsx` — portal target comment:** Documented WHY the `typeof document` guard is safe for portals (React's hydration algorithm does not compare portal content at the component mount point).
4. **`AuthRedirectHandler.tsx` — supabase client recreated on every render:** `createBrowserClient()` was called in the component body. Moved to `useMemo([], ...)` so the client is created once per mount. Also imported `Session` type and replaced `session: unknown` with `session: Session | null` in the `onAuthStateChange` callback for proper type safety.
5. **`useHomeData.ts` — unnecessary store subscriptions:** `_isLoadingUnits` and `_isLoadingDeadlines` were subscribed from their Zustand stores but never read. Each subscription causes a re-render on every loading-state change. Removed both unused subscriptions.
6. **`useHomeUser.ts` — displayName recomputed every render:** The name-derivation logic was an IIFE, recomputing on every render regardless of whether `user` or `currentProfile` changed. Wrapped in `useMemo([user, currentProfile])`. Also added `useMemo` to the React import.
7. **`WeekHeatStrip.tsx` — full `motion` bypassed `LazyMotion`:** Importing `motion` from `framer-motion` forces the full animation bundle even when `<LazyMotion features={domAnimation}>` is active in the parent. Replaced with `m` (the lightweight variant designed for use with `LazyMotion`).
8. **`loading.tsx` — inaccessible loading skeleton:** The skeleton container had no ARIA semantics — screen readers had no way to identify it as a loading state. Added `role="status"`, `aria-label="Loading dashboard"`, and `aria-busy="true"`.
9. **`WelcomeHeader.tsx` — dead fallback branch:** `messageKey ? t(messageKey) : t('dayAtGlance')` — `messageKey` is always truthy (always a string from the `generalKeys` array), so the `t('dayAtGlance')` fallback was unreachable dead code. Simplified to `t(messageKey as 'welcomeMsg1')`.

**Files Changed:**

- `app/home/HomeClient.tsx`
- `app/home/loading.tsx`
- `app/AuthRedirectHandler.tsx`
- `features/home/hooks/useHomeData.ts`
- `features/home/hooks/useHomeUser.ts`
- `features/home/components/WeekHeatStrip.tsx`
- `features/home/components/WelcomeHeader.tsx`

**Verification:**

- TypeScript: `npm run typecheck` — clean ✅
- Lint: `npm run lint` — clean ✅
- Tests: 874/878 passed ✅ (4 pre-existing signup test failures, unrelated to these changes)

---

### Raouf: Fix Select Dropdowns Not Opening Inside Dialogs — 2026-04-05

**Scope:** UI bug fix — Radix Select z-index + Dialog interaction guard

1. **Root cause 1 — z-index clash:** `SelectContent` was styled with `z-50` while Dialog overlay/content uses `z-[70]`. The Select portal rendered behind the dialog, making dropdowns invisible and unclickable in all dialogs (UnitForm day picker, ReminderModal timing picker, etc.).
2. **Root cause 2 — blanket `preventDefault`:** `ReminderModal` called `e.preventDefault()` unconditionally in `onPointerDownOutside` and `onInteractOutside`, blocking Radix Select portal interactions even if z-index were fixed.
3. **Fix 1:** Bumped `z-50` → `z-[80]` in `SelectContent` so the dropdown portal always renders above the dialog layer.
4. **Fix 2:** Narrowed the `preventDefault` guard to skip events whose target is within a `[data-radix-popper-content-wrapper]` element, preserving "click outside to dismiss" protection while allowing Select portals to function.

**Files Changed:**

- `components/ui/select.tsx`
- `components/ui/ReminderModal.tsx`

**Verification:**

- TypeScript: `npm run typecheck` — clean ✅
- Lint: `npm run lint` — clean ✅
- Tests: 876/878 passed ✅ (2 pre-existing signup failures unrelated to this change)

---

### Raouf: Git Rebase & Documentation Sync — 2026-04-01

**Scope:** Resolved a complex 3-step interactive rebase conflict in `README.md`.

1.  **Synthesized "Super README":** Merged high-impact visual portfolio assets (Typing SVG, dynamic screenshots) with the deep technical engineering narrative (Zero-Trust architecture, AI-native Codex workflows) to create a unified, high-caliber repository entry point.
2.  **Resolved Rebase Deadlock:** Manually resolved 3 sequential merge conflicts in `README.md` during an interactive rebase, ensuring no loss of professional depth or visual quality.
3.  **Synchronized Origin:** Finalized the rebase and validated repository parity with `origin/main`.

**Files Changed:**

- `README.md`

**Verification:**

- Git rebase completed successfully ✅
- `README.md` structural and visual audit completed ✅
- `git status` parity verified ✅

---

### Raouf: Full Project Documentation Portfolio Transformation — 2026-03-21

**Scope:** Rewrote and structurally elevated the entire project documentation suite to transform the repository into a high-caliber portfolio piece.

1.  **Unified Professional Tone:** Shifted from "development notes" to industry-standard "executive and senior-engineering" documentation across 15+ files.
2.  **Impact-Focused Narrative:** Highlighted the "Why" and "How" behind complex technical hurdles, including:
    - **Additive Merge Strategy** for solving optimistic UI race conditions.
    - **Fused-Heading Algorithm** for high-accuracy pedestrian campus navigation.
    - **Zero-Trust Edge Middleware** for sub-6s session resolution and fail-fast infrastructure stability.
3.  **Addressed Implementation Gaps:** Documented critical technical details discovered in the codebase:
    - **Infrastructure Limits:** Formalized Vercel Edge execution deadlines and Redis-backed rate limiting mandates.
    - **PII Handling:** Clarified plaintext IP/User-Agent logging for forensic analysis and threat hunting.
    - **Passkey Scope:** Documented the restriction to platform authenticators for biometric UX optimization.
4.  **Structural Re-indexing:** Reorganized the `docs/` hub to act as a clean, professional navigation center for technical reviewers and hiring panels.

**Files Changed:**

- `README.md`, `TECHNICAL_EXPLANATION.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
- `docs/README.md`, `docs/architecture/ARCHITECTURE.md`, `docs/api/API_REFERENCE.md`
- `docs/inventory/ROUTE_INVENTORY.md`, `docs/setup/ENVIRONMENT_SETUP.md`
- `docs/university-integration-requirements.md`, `docs/operations/deployment-checklist.md`
- `docs/security/SECURITY_POSTURE.md`
- `AGENT.md`, `CHANGELOG.md`

**Verification:**

- Documentation consistency audit completed ✅
- Markdown links verified ✅
- Technical alignment with current codebase state confirmed ✅

---

### Raouf: Rewrite README for Claude for OSS and OpenAI Codex for OSS Grant Applications — 2026-03-17

**Scope:** Replaced the internal-facing technical README with a grant-optimised public README.

... [rest of CHANGELOG.md content] ...

---

### Raouf: Internationalization Update — 2026-04-06

**Scope:** i18n Expansion (34 Locales)

**Summary:** Added missing `heroSection`, `opensInNewTab`, and `loadingEvents` keys to all 34 translation files in `locales/`. Used localized translations for major languages (Arabic, German, Spanish, French, Italian, Portuguese, Chinese, Japanese, etc.) and English fallbacks for others. `heroSection` is used for ARIA labels on hero sections; `opensInNewTab` provides an accessible suffix for links; `loadingEvents` is used for screen reader status updates during feed loading.

**Files Changed:** `locales/*/translations.json` (34 files).

**Verification:** Ran `npm run check:i18n` — all 35 locales validated successfully ✅.

**Follow-ups:** None.
