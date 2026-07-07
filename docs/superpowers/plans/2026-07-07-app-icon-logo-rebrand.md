# App-Icon Logo Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Macquarie University crest logo with the new Syllabus Sync app-icon image everywhere it appears in the app, including the PWA/favicon icon set.

**Architecture:** Crop the supplied app-icon image into a clean edge-to-edge square master asset, derive all required icon sizes from it with ImageMagick, repoint every code/service-worker reference from `MQ_Logo_Final.png` to the new `syllabus-sync-logo.png`, and update the localized alt text in all 35 locale files to reference the app name generically instead of "Macquarie University".

**Tech Stack:** Next.js (App Router), ImageMagick (`magick` CLI) for image processing, the project's custom i18n system (`useTypedTranslation`, `{{placeholder}}` interpolation).

## Global Constraints

- New master asset path: `public/syllabus-sync-logo.png` (replaces and deletes `public/MQ_Logo_Final.png`).
- No layout/sizing changes to any `<Image>` component — only the `src` changes.
- The `mqLogoAlt` translation **key name** is unchanged; only its **value** changes, in all 35 locale files under `locales/*/translations.json`.
- Per the Raouf Change Protocol (`AGENT.md`), the final task must run `npm run check` and append a "Raouf:" entry to both `AGENT.md` and `CHANGELOG.md`.
- Source image for the new logo: `/Users/raoof.r12/.claude/image-cache/60cc0513-0c9c-493c-b2f9-7f956910016f/1.png` (1254×1254, has a white margin + drop shadow around the rounded-square artwork that must be cropped out). If this file is not present when a task runs, stop and ask the user to re-share the image before proceeding.

---

### Task 1: Generate the new logo asset and icon set

**Files:**
- Create: `public/syllabus-sync-logo.png`
- Modify (overwrite in place, binary): `app/favicon.ico`, `public/apple-touch-icon.png`, `public/icons/apple-touch-icon.png`, `public/icons/icon-192.png`, `public/icons/icon-384.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`

**Interfaces:**
- Produces: `public/syllabus-sync-logo.png`, the filename Task 2 repoints all code references to.

- [ ] **Step 1: Crop the source image to a clean edge-to-edge square master**

```bash
SRC="/Users/raoof.r12/.claude/image-cache/60cc0513-0c9c-493c-b2f9-7f956910016f/1.png"
mkdir -p /tmp/logo-work
magick "$SRC" -fuzz 8% -trim +repage -gravity North -crop 1050x1050+0+0 +repage /tmp/logo-work/master.png
identify /tmp/logo-work/master.png
```

Expected output: `/tmp/logo-work/master.png PNG 1050x1050 1050x1050+0+0 8-bit sRGB ...` — note it must read `1050x1050` (square). If the dimensions are not equal, open `/tmp/logo-work/master.png` and check for a leftover white sliver on one edge before continuing.

- [ ] **Step 2: Generate the main logo asset**

```bash
magick /tmp/logo-work/master.png -resize 1024x1024 -strip -define png:compression-level=9 public/syllabus-sync-logo.png
identify public/syllabus-sync-logo.png
```

Expected output: `public/syllabus-sync-logo.png PNG 1024x1024 1024x1024+0+0 8-bit sRGB ...`

- [ ] **Step 3: Generate the PWA icon set and favicon**

```bash
magick /tmp/logo-work/master.png -resize 512x512 -strip -define png:compression-level=9 public/icons/icon-512.png
magick /tmp/logo-work/master.png -resize 512x512 -strip -define png:compression-level=9 public/icons/maskable-512.png
magick /tmp/logo-work/master.png -resize 384x384 -strip -define png:compression-level=9 public/icons/icon-384.png
magick /tmp/logo-work/master.png -resize 192x192 -strip -define png:compression-level=9 public/icons/icon-192.png
magick /tmp/logo-work/master.png -resize 180x180 -strip -define png:compression-level=9 public/apple-touch-icon.png
cp public/apple-touch-icon.png public/icons/apple-touch-icon.png
magick /tmp/logo-work/master.png -define icon:auto-resize=48,32,16 app/favicon.ico
```

- [ ] **Step 4: Verify every generated file's dimensions**

```bash
identify public/icons/icon-512.png public/icons/maskable-512.png public/icons/icon-384.png public/icons/icon-192.png public/apple-touch-icon.png public/icons/apple-touch-icon.png
identify app/favicon.ico
```

Expected: each `icon-*.png`/`apple-touch-icon.png` reports the size in its filename (e.g. `icon-512.png PNG 512x512`), `apple-touch-icon.png` reports `180x180`, and `favicon.ico` lists three frames — `48x48`, `32x32`, `16x16`.

- [ ] **Step 5: Clean up the scratch directory**

```bash
rm -rf /tmp/logo-work
```

- [ ] **Step 6: Commit**

```bash
git add public/syllabus-sync-logo.png public/icons/icon-192.png public/icons/icon-384.png public/icons/icon-512.png public/icons/maskable-512.png public/apple-touch-icon.png public/icons/apple-touch-icon.png app/favicon.ico
git commit -m "Add new Syllabus Sync app-icon logo and regenerate PWA/favicon icons"
```

---

### Task 2: Point all code and the service worker at the new logo, remove the old asset

**Files:**
- Modify: `app/layout.tsx`, `app/home/page.tsx`, `app/calendar/page.tsx`, `app/map/page.tsx`, `app/feed/page.tsx`, `app/manage-profiles/layout.tsx`, `app/login/LoginClient.tsx`, `app/signup/SignupClient.tsx`, `app/onboarding/OnboardingClient.tsx`, `app/reset-password/reset-password-client.tsx`, `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`, `lib/server/push.ts`, `lib/services/notificationService.ts`, `public/sw.js`
- Delete: `public/MQ_Logo_Final.png`

**Interfaces:**
- Consumes: `public/syllabus-sync-logo.png` (from Task 1).

- [ ] **Step 1: Replace the asset path in every TypeScript/TSX reference**

```bash
grep -rl "MQ_Logo_Final\.png" --include="*.ts" --include="*.tsx" . --exclude-dir=node_modules \
  | xargs sed -i '' 's#/MQ_Logo_Final\.png#/syllabus-sync-logo.png#g'
```

- [ ] **Step 2: Replace the asset path in the service worker and bump its cache versions**

The service worker precaches the logo by exact path and falls back to it for push-notification icons, so it needs the same path swap. It also names its caches with a version suffix (`syllabus-sync-v6`, `syllabus-sync-static-v6`, `syllabus-sync-dynamic-v6`) that must be bumped whenever precached asset content changes, so browsers with an old worker installed fetch the new files instead of serving stale ones from cache.

```bash
sed -i '' 's#/MQ_Logo_Final\.png#/syllabus-sync-logo.png#g' public/sw.js
sed -i '' \
  -e 's/"syllabus-sync-v6"/"syllabus-sync-v7"/' \
  -e 's/"syllabus-sync-static-v6"/"syllabus-sync-static-v7"/' \
  -e 's/"syllabus-sync-dynamic-v6"/"syllabus-sync-dynamic-v7"/' \
  public/sw.js
```

- [ ] **Step 3: Delete the old logo file**

```bash
git rm public/MQ_Logo_Final.png
```

- [ ] **Step 4: Verify no references to the old filename remain in source**

```bash
grep -rn "MQ_Logo_Final" --include="*.ts" --include="*.tsx" --include="*.js" . --exclude-dir=node_modules
```

Expected: no output. (`CHANGELOG_S.md` and the spec/plan docs under `docs/superpowers/` still mention the old filename as historical record — that's expected and out of scope.)

- [ ] **Step 5: Typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: both exit with no errors (`Lint OK`).

- [ ] **Step 6: Commit**

```bash
git add -A -- app components lib public
git commit -m "Point logo references at syllabus-sync-logo.png and bump SW cache version"
```

---

### Task 3: Update the `mqLogoAlt` alt text to reference the app name, not the university

**Files:**
- Modify: `locales/en/translations.json` and the other 34 locale files under `locales/*/translations.json`
- Modify: `app/calendar/page.tsx`, `app/map/page.tsx`, `app/signup/SignupClient.tsx`, `app/reset-password/reset-password-client.tsx`, `app/onboarding/OnboardingClient.tsx`, `app/login/LoginClient.tsx`, `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: the existing `{{placeholder}}` interpolation support in the project's translation function (already used for `welcomeTo`: `t('welcomeTo', { appName: APP_CONFIG.name })`), and `APP_CONFIG.name` from `@/lib/config` (`APP_CONFIG.name === 'Syllabus Sync'`).

The logo is no longer the Macquarie University crest, so every locale's `mqLogoAlt` string is rewritten from "\<University name\>" to "{{appName}}" (kept in each locale's existing word order/grammar for the word "logo"), and every call site is updated to pass `{ appName: APP_CONFIG.name }` so the alt text now reads "Syllabus Sync Logo" (or the localized equivalent) instead of "Macquarie University Logo".

- [ ] **Step 1: Rewrite `mqLogoAlt` in all 35 locale files**

```bash
python3 - <<'EOF'
import pathlib

replacements = {
    "ar": ('"mqLogoAlt": "شعار جامعة ماكواري"', '"mqLogoAlt": "شعار {{appName}}"'),
    "bn": ('"mqLogoAlt": "ম্যাকোয়ারি বিশ্ববিদ্যালয় লোগো"', '"mqLogoAlt": "{{appName}} লোগো"'),
    "cs": ('"mqLogoAlt": "Logo Macquarie University"', '"mqLogoAlt": "Logo {{appName}}"'),
    "da": ('"mqLogoAlt": "Macquarie University logo"', '"mqLogoAlt": "{{appName}} logo"'),
    "de": ('"mqLogoAlt": "Macquarie University-Logo"', '"mqLogoAlt": "{{appName}}-Logo"'),
    "el": ('"mqLogoAlt": "Λογότυπο Macquarie University"', '"mqLogoAlt": "Λογότυπο {{appName}}"'),
    "en": ('"mqLogoAlt": "Macquarie University Logo"', '"mqLogoAlt": "{{appName}} Logo"'),
    "es": ('"mqLogoAlt": "Logotipo de la Universidad Macquarie"', '"mqLogoAlt": "Logotipo de {{appName}}"'),
    "fa": ('"mqLogoAlt": "لوگوی دانشگاه Macquarie"', '"mqLogoAlt": "لوگوی {{appName}}"'),
    "fi": ('"mqLogoAlt": "Macquarie University logo"', '"mqLogoAlt": "{{appName}} logo"'),
    "fr": ('"mqLogoAlt": "Logo Macquarie University"', '"mqLogoAlt": "Logo {{appName}}"'),
    "he": ('"mqLogoAlt": "לוגו Macquarie University"', '"mqLogoAlt": "לוגו {{appName}}"'),
    "hi": ('"mqLogoAlt": "मैक्वेरी विश्वविद्यालय लोगो"', '"mqLogoAlt": "{{appName}} लोगो"'),
    "hu": ('"mqLogoAlt": "Macquarie University logó"', '"mqLogoAlt": "{{appName}} logó"'),
    "id": ('"mqLogoAlt": "Logo Universitas Macquarie"', '"mqLogoAlt": "Logo {{appName}}"'),
    "it": ('"mqLogoAlt": "Logo Macquarie University"', '"mqLogoAlt": "Logo {{appName}}"'),
    "ja": ('"mqLogoAlt": "マッコーリー大学ロゴ"', '"mqLogoAlt": "{{appName}}ロゴ"'),
    "ko": ('"mqLogoAlt": "맥쿼리 대학교 로고"', '"mqLogoAlt": "{{appName}} 로고"'),
    "ms": ('"mqLogoAlt": "Logo Universiti Macquarie"', '"mqLogoAlt": "Logo {{appName}}"'),
    "ne": ('"mqLogoAlt": "Macquarie University लोगो"', '"mqLogoAlt": "{{appName}} लोगो"'),
    "nl": ('"mqLogoAlt": "Macquarie University-logo"', '"mqLogoAlt": "{{appName}}-logo"'),
    "no": ('"mqLogoAlt": "Macquarie University-logo"', '"mqLogoAlt": "{{appName}}-logo"'),
    "pl": ('"mqLogoAlt": "Logo Macquarie University"', '"mqLogoAlt": "Logo {{appName}}"'),
    "pt": ('"mqLogoAlt": "Logo"', '"mqLogoAlt": "Logo {{appName}}"'),
    "ro": ('"mqLogoAlt": "Logo Macquarie University"', '"mqLogoAlt": "Logo {{appName}}"'),
    "ru": ('"mqLogoAlt": "Логотип Университета Маккуори"', '"mqLogoAlt": "Логотип {{appName}}"'),
    "si": ('"mqLogoAlt": "Macquarie University ලාංඡනය"', '"mqLogoAlt": "{{appName}} ලාංඡනය"'),
    "sv": ('"mqLogoAlt": "Macquarie University logotyp"', '"mqLogoAlt": "{{appName}} logotyp"'),
    "ta": ('"mqLogoAlt": "மக்வாரி பல்கலைக்கழக லோகோ"', '"mqLogoAlt": "{{appName}} லோகோ"'),
    "th": ('"mqLogoAlt": "โลโก้มหาวิทยาลัย Macquarie"', '"mqLogoAlt": "โลโก้ {{appName}}"'),
    "tr": ('"mqLogoAlt": "Logo"', '"mqLogoAlt": "{{appName}} Logo"'),
    "uk": ('"mqLogoAlt": "Логотип Macquarie University"', '"mqLogoAlt": "Логотип {{appName}}"'),
    "ur": ('"mqLogoAlt": "میکوری یونیورسٹی لوگو"', '"mqLogoAlt": "{{appName}} لوگو"'),
    "vi": ('"mqLogoAlt": "Logo Đại học Macquarie"', '"mqLogoAlt": "Logo {{appName}}"'),
    "zh": ('"mqLogoAlt": "麦考瑞大学标志"', '"mqLogoAlt": "{{appName}}标志"'),
}

base = pathlib.Path("locales")
for locale, (old, new) in replacements.items():
    path = base / locale / "translations.json"
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{locale}: expected 1 match for old value, found {count}")
    path.write_text(text.replace(old, new), encoding="utf-8")
    print(f"{locale}: updated")

print(f"Done: {len(replacements)} locales updated")
EOF
```

Expected output: 35 lines reading `<locale>: updated` followed by `Done: 35 locales updated`. If any locale raises `expected 1 match ... found 0`, the file's current value has drifted from what's listed above — open that locale's `translations.json`, find the current `mqLogoAlt` value, and add it as a special case before re-running.

- [ ] **Step 2: Validate every locale file is still valid JSON**

```bash
for f in locales/*/translations.json; do
  python3 -c "import json; json.load(open('$f'))" || echo "INVALID: $f"
done
```

Expected: no `INVALID:` lines printed.

- [ ] **Step 3: Run the project's i18n completeness check**

```bash
npm run check:i18n
```

Expected: passes (no missing-key errors — this task only changes values, not keys).

- [ ] **Step 4: Update the call sites that use a plain `translate('mqLogoAlt')`**

In `app/calendar/page.tsx`:

```diff
-        alt: translate('mqLogoAlt'),
+        alt: translate('mqLogoAlt', { appName: APP_CONFIG.name }),
```

In `app/map/page.tsx`:

```diff
-        alt: translate('mqLogoAlt'),
+        alt: translate('mqLogoAlt', { appName: APP_CONFIG.name }),
```

Both files already `import { APP_CONFIG, UNIVERSITY_CONFIG } from '@/lib/config';`, so no import changes are needed in either.

- [ ] **Step 5: Update `app/signup/SignupClient.tsx` and `app/login/LoginClient.tsx`**

Both already import `APP_CONFIG` from `@/lib/config`. In each file:

```diff
-                alt={t('mqLogoAlt')}
+                alt={t('mqLogoAlt', { appName: APP_CONFIG.name })}
```

(In `SignupClient.tsx` the indentation is `                    alt={t('mqLogoAlt')}`; in `LoginClient.tsx` it is `                alt={t('mqLogoAlt')}`. Match the existing indentation in each file — only one `alt={t('mqLogoAlt')}` line exists in each of these two files.)

- [ ] **Step 6: Update `app/reset-password/reset-password-client.tsx`, `app/onboarding/OnboardingClient.tsx`, and `components/layout/Sidebar.tsx`**

None of these three files currently import `APP_CONFIG`. Add the import and update the alt text.

In `app/reset-password/reset-password-client.tsx`, add the import next to the other `@/lib` imports:

```diff
 import { API_ROUTES, SECURITY_CONFIG } from '@/lib/constants/config';
+import { APP_CONFIG } from '@/lib/config';
 import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
```

This file has two identical `alt={t('mqLogoAlt')}` lines (both at the same indentation, one per password-reset screen) — both need the same change, so replace all occurrences:

```diff
-                alt={t('mqLogoAlt')}
+                alt={t('mqLogoAlt', { appName: APP_CONFIG.name })}
```

In `app/onboarding/OnboardingClient.tsx`, add the import next to the other imports:

```diff
 import { isValidRedirect } from '@/lib/utils/security';
+import { APP_CONFIG } from '@/lib/config';
 import { ArrowRight, Loader2 } from 'lucide-react';
```

And update the one alt text line:

```diff
-                  alt={t('mqLogoAlt')}
+                  alt={t('mqLogoAlt', { appName: APP_CONFIG.name })}
```

In `components/layout/Sidebar.tsx`, add the import next to the other imports:

```diff
 import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
+import { APP_CONFIG } from '@/lib/config';
 import { Home, MapPin, Calendar, MessageSquare, Menu, X, Sparkles, Settings } from 'lucide-react';
```

This file has two identical `alt={t('mqLogoAlt')}` lines (mobile menu logo and desktop sidebar logo) — both need the same change, so replace all occurrences:

```diff
-              alt={t('mqLogoAlt')}
+              alt={t('mqLogoAlt', { appName: APP_CONFIG.name })}
```

- [ ] **Step 7: Update `components/layout/Header.tsx`**

Already imports `APP_CONFIG` from `@/lib/config`. Update the one alt text line:

```diff
-            alt={t('mqLogoAlt')}
+            alt={t('mqLogoAlt', { appName: APP_CONFIG.name })}
```

- [ ] **Step 8: Verify no bare `t('mqLogoAlt')` / `translate('mqLogoAlt')` calls remain**

```bash
grep -rn "t('mqLogoAlt')" --include="*.ts" --include="*.tsx" . --exclude-dir=node_modules
```

Expected: no output (every call site now passes `{ appName: APP_CONFIG.name }`).

- [ ] **Step 9: Typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: both exit with no errors (`Lint OK`).

- [ ] **Step 10: Commit**

```bash
git add locales app/calendar/page.tsx app/map/page.tsx app/signup/SignupClient.tsx \
  app/reset-password/reset-password-client.tsx app/onboarding/OnboardingClient.tsx \
  app/login/LoginClient.tsx components/layout/Header.tsx components/layout/Sidebar.tsx
git commit -m "Update logo alt text to reference the app name in all 35 locales"
```

---

### Task 4: Full verification and change-log postflight

**Files:**
- Modify: `AGENT.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: the completed changes from Tasks 1–3.

- [ ] **Step 1: Run the full project check suite**

```bash
npm run check
```

Expected: `check:secrets`, `format:check`, `typecheck`, `lint`, `test`, and `build` all pass. If `format:check` fails only on files this plan touched, run `npm run format` and re-stage; if `test` fails on the 4 pre-existing unrelated signup failures noted in `AGENT.md`'s history, that is expected — no other failures should appear.

- [ ] **Step 2: Manually confirm the new logo renders**

```bash
npm run dev
```

Open `http://localhost:3000/login` in a browser and confirm the red rounded-square app icon now renders where the crest used to be. Also check the browser tab favicon shows the new icon. Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 3: Append a "Raouf:" entry to `CHANGELOG.md`**

Add a new entry at the top of the changelog body (directly under the `---` following the file header), following the file's existing format:

```markdown
### Raouf: App-Icon Logo Rebrand — 2026-07-07

**Scope:** Replaced the Macquarie University crest logo with the new Syllabus Sync app-icon image across the entire app.

**Summary:** Cropped the supplied app-icon artwork (rounded-square, red/white building + book motif) into an edge-to-edge square master and regenerated the full PWA/favicon icon set (`favicon.ico`, `apple-touch-icon.png`, `icon-192/384/512.png`, `maskable-512.png`) from it. Repointed all ~25 code references — login, signup, header, sidebar, onboarding, reset-password, OG/Twitter meta images, the JSON-LD organization schema, and the push-notification icon fallback in both `lib/server/push.ts` and `lib/services/notificationService.ts` — from `/MQ_Logo_Final.png` to the new `/syllabus-sync-logo.png`, then deleted the old crest file. Updated `public/sw.js`'s precache list and push-notification fallback to the new path and bumped its cache versions (`syllabus-sync-v6` → `v7`, `-static-v6` → `-static-v7`, `-dynamic-v6` → `-dynamic-v7`) so installed service workers fetch the new assets instead of serving the stale crest from cache. Rewrote the `mqLogoAlt` translation value in all 35 locale files from a hardcoded "Macquarie University logo" translation to a `{{appName}}`-interpolated string (matching the existing `welcomeTo` pattern), and updated all 10 call sites to pass `{ appName: APP_CONFIG.name }`, so alt text now reads "Syllabus Sync Logo" (localized) instead of the old university-crest wording.

**Files Changed:** `public/syllabus-sync-logo.png` (new), `public/icons/icon-192.png`, `public/icons/icon-384.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `public/apple-touch-icon.png`, `public/icons/apple-touch-icon.png`, `app/favicon.ico`, `public/MQ_Logo_Final.png` (deleted), `app/layout.tsx`, `app/home/page.tsx`, `app/calendar/page.tsx`, `app/map/page.tsx`, `app/feed/page.tsx`, `app/manage-profiles/layout.tsx`, `app/login/LoginClient.tsx`, `app/signup/SignupClient.tsx`, `app/onboarding/OnboardingClient.tsx`, `app/reset-password/reset-password-client.tsx`, `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`, `lib/server/push.ts`, `lib/services/notificationService.ts`, `public/sw.js`, `locales/*/translations.json` (35 files).

**Verification:** `npm run check` passed (secrets, format, typecheck, lint, test, build) ✅; `npm run check:i18n` passed ✅; manually confirmed the new icon renders on `/login` and as the browser favicon ✅.

**Follow-ups:** None.

---
```

- [ ] **Step 4: Append the matching entry to `AGENT.md`**

Add a new entry at the top of the `## Change Log (Raouf Template)` section in `AGENT.md`, following its existing format:

```markdown
### 2026-07-07 (Australia/Sydney) — App-Icon Logo Rebrand

**Raouf:**
- **Scope:** Replaced the Macquarie University crest logo with the new Syllabus Sync app-icon image across the entire app, including the PWA/favicon icon set and all 35 locale alt-text strings.
- **Summary:** New master asset `public/syllabus-sync-logo.png` cropped from the supplied app-icon artwork and used to regenerate `favicon.ico`, `apple-touch-icon.png`, and `icon-192/384/512.png`/`maskable-512.png`. All ~25 code references (login, signup, header, sidebar, onboarding, reset-password, OG/Twitter meta, JSON-LD schema, push-notification fallbacks, service worker) repointed from `/MQ_Logo_Final.png` to `/syllabus-sync-logo.png`; old crest file deleted. Service worker cache versions bumped (`v6` → `v7`) to force-refresh cached assets. `mqLogoAlt` translation value switched to a `{{appName}}`-interpolated string in all 35 locales, replacing hardcoded "Macquarie University" wording.
- **Files Changed:** `public/syllabus-sync-logo.png`, `public/icons/*.png`, `public/apple-touch-icon.png`, `app/favicon.ico`, `public/MQ_Logo_Final.png` (deleted), `app/layout.tsx`, `app/home/page.tsx`, `app/calendar/page.tsx`, `app/map/page.tsx`, `app/feed/page.tsx`, `app/manage-profiles/layout.tsx`, `app/login/LoginClient.tsx`, `app/signup/SignupClient.tsx`, `app/onboarding/OnboardingClient.tsx`, `app/reset-password/reset-password-client.tsx`, `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`, `lib/server/push.ts`, `lib/services/notificationService.ts`, `public/sw.js`, `locales/*/translations.json` (35 files).
- **Verification:** `npm run check` passed ✅; `npm run check:i18n` passed ✅; manually confirmed on `/login` and browser favicon ✅.
- **Follow-ups:** None.
```

- [ ] **Step 5: Commit**

```bash
git add AGENT.md CHANGELOG.md
git commit -m "Log app-icon logo rebrand in AGENT.md and CHANGELOG.md"
```
