# App-Icon Logo Rebrand — Design

## Problem

Syllabus Sync currently uses the Macquarie University lighthouse crest
(`public/MQ_Logo_Final.png`, 1536×1024, transparent background) as its logo
everywhere — login, signup, header, sidebar, onboarding, reset-password,
social share images, push notifications, and the PWA/favicon icon set
(`public/icons/icon-192/384/512.png`, `apple-touch-icon.png`,
`app/favicon.ico`). The user supplied a new square, rounded, red/white
app-icon-style design (building + book motif) and wants it to become the
one logo used across the whole app, replacing the crest everywhere.

## Source asset

The supplied image has a white margin and a drop shadow around the rounded
square (a mockup-style render, not a raw edge-to-edge export). It will be
cropped to remove the margin/shadow so the rounded-square artwork fills the
frame edge-to-edge, then saved as the new source PNG.

## New asset naming

- New source file: `public/syllabus-sync-logo.png` (replaces
  `public/MQ_Logo_Final.png`, which is deleted once references are updated).
- Regenerated square derivatives from the cropped source:
  - `app/favicon.ico`
  - `public/apple-touch-icon.png` and `public/icons/apple-touch-icon.png` (180×180)
  - `public/icons/icon-192.png`, `public/icons/icon-384.png`, `public/icons/icon-512.png`
  - `public/icons/maskable-512.png` (same artwork; not pixel-perfect to the
    Android maskable safe-zone spec, best-effort only)

## Code references to update

Replace `/MQ_Logo_Final.png` with `/syllabus-sync-logo.png` in:

- `app/layout.tsx` (OG image, Twitter image, JSON-LD organization `logo`)
- `app/home/page.tsx`, `app/calendar/page.tsx`, `app/map/page.tsx`,
  `app/feed/page.tsx`, `app/manage-profiles/layout.tsx` (OG/Twitter meta images)
- `app/login/LoginClient.tsx`, `app/signup/SignupClient.tsx`,
  `app/onboarding/OnboardingClient.tsx`, `app/reset-password/reset-password-client.tsx`
  (inline `<Image>` logo)
- `components/layout/Header.tsx`, `components/layout/Sidebar.tsx` (inline `<Image>` logo)
- `lib/server/push.ts`, `lib/services/notificationService.ts`
  (push-notification icon fallback path)

No sizing/layout changes to the surrounding `<Image>` components — the new
icon renders inside the same boxes the crest used to. It will now appear as
a small red rounded-square tile rather than a transparent crest; that is the
intended app-icon look.

## Copy changes

The `mqLogoAlt` translation string exists in all 35 locale files under
`locales/*/translations.json`. Its value (currently a translation of
"<University name> logo") will be updated to a translation of "Syllabus
Sync logo" in each locale, since the image is no longer the university
crest. The translation key name itself is left unchanged — it is just an
identifier, not user-facing text.

## Out of scope

- No changes to `manifest.webmanifest` structure (icon file paths/sizes stay
  the same; only the underlying image content changes).
- No redesign of where/how large the logo appears on any page.
- No changes to the favicon reference in `app/layout.tsx`'s `icons.icon`
  field beyond the regenerated `favicon.ico` content.
