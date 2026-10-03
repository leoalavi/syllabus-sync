# Production deployment checklist

> Current target: Cloudflare Worker `syllabus-sync-production`, serving `https://www.syllabus-sync.app`. Verified against the root Wrangler configuration and read-only Worker deployment history on 3 October 2026. The separate information site uses Worker `syllabus-sync-info` and its own repository/configuration. This document does not authorize a deployment.

## Before a release

1. Review the proposed change, any pending Supabase migrations, and the current Worker configuration. The production database and Cloudflare dashboard are external sources of truth; do not assume that repository files prove their current contents.
2. Confirm the target Worker is `syllabus-sync-production` and the intended domain is `www.syllabus-sync.app`. Keep `syllabus-sync-info` out of the main app's config.
3. Confirm the Cloudflare build and Worker runtime have the required variable names and secrets. Never print secret values. Core integrations include Supabase, Resend, WebAuthn, cron authentication, and whichever distributed rate-limit store is configured. Optional Google Maps, Sylla, push, and Sentry settings depend on enabled features. See [Environment setup](../setup/ENVIRONMENT_SETUP.md) and [`.env.example`](../../.env.example).
4. If migrations are pending, review them and plan a backup and recovery path. Applying a migration is a separate production action; `npm run cf:build` does not apply SQL.
5. Run the local checks and review the results:

   ```bash
   npm run check
   npm run check:i18n
   npm run cf:build
   npm run cf:verify-output
   npx wrangler deploy --dry-run --outdir .wrangler/dry-run
   ```

   `npm run check` includes secret scanning, formatting, typecheck, lint, tests, and the Next.js build. The Cloudflare build and dry run validate packaging but do not prove production bindings, secrets, or runtime behavior.

## Release boundary

Only an authorized maintainer should deploy. The repository's `npm run cf:deploy` command builds, verifies, and deploys the root Worker. Confirm the active Cloudflare account and Worker name immediately before using it. Do not use the legacy Vercel scripts or `vercel.json` as the production release path.

The Worker custom domain is managed separately in Cloudflare and is intentionally absent from the root `wrangler.jsonc`; do not add or replace a route without reviewing the live domain attachment. The root config schedules three cleanup jobs through `cloudflare/worker.js`. Push reminders have a separate GitHub Actions schedule in `.github/workflows/push-reminders-cron.yml` and need its repository secrets.

## After an authorized deployment

- Check the public pages `/about`, `/contact`, `/terms`, and `/privacy`, including the Project Info link to `https://info.syllabus-sync.app`.
- Check `/api/health` and inspect its response body: it can return HTTP 200 with `status: degraded`, so the status code alone is insufficient.
- Check security headers and the authenticated login, MFA, dashboard, calendar, map, feed, and logout flows using a suitable test account. Confirm mobile navigation and RTL layout where relevant.
- Confirm the scheduled cleanup jobs and push-reminder workflow are healthy through their respective Cloudflare and GitHub logs. Do not invoke a production cron endpoint manually as a substitute for the schedule.
- Watch Worker logs, Sentry if configured, and Supabase metrics for regressions. Do not infer success solely from a successful upload.

## Recovery

If a deployment regresses, an authorized maintainer can select a previously working Worker version or deployment after checking Cloudflare's current rollback procedure and the affected bindings. Rolling back Worker code does **not** roll back database migrations or connected resource data. Address a database regression with a separately reviewed recovery or compensating migration.

## Sylla shared authentication

Sylla is the connected AI-assisted study layer, deployed separately at `https://sylla.syllabus-sync.app`. If shared login is enabled, both apps must use the intended Supabase project and a production cookie domain of `.syllabus-sync.app`. `NEXT_PUBLIC_TRUSTED_ORIGINS` must explicitly allow the Sylla origin, and `NEXT_PUBLIC_SYLLA_URL` controls the sidebar handoff. Check the Supabase redirect allowlist and test both a permitted Sylla return URL and an untrusted URL that should fall back to `/home`. This integration is optional for a local standalone checkout.
