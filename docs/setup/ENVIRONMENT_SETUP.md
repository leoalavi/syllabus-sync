# Environment and Setup Guide

> **Audience:** New contributors setting up a local development environment.
> **Updated:** 2026-10-03 (Australia/Sydney)

This guide walks through every step required to go from a fresh clone to a running local development server.

---

## Runtime Requirements

| Tool    | Minimum Version | Notes                                                                                                            |
| :------ | :-------------- | :--------------------------------------------------------------------------------------------------------------- |
| Node.js | `>=22.0.0`      | Active LTS. Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage versions. |
| npm     | `>=10.0.0`      | Ships with Node.js 22.                                                                                           |
| Docker  | Latest stable   | Optional. Required only for local Supabase emulation or Docker-based development.                                |

---

## Step 1: Clone and Install

```bash
git clone https://github.com/leoalavi/syllabus-sync.git
cd syllabus-sync
npm ci
```

---

## Step 2: Configure Cloud Services

Syllabus Sync depends on several external services. You will need active accounts and credentials for each.

### Supabase (Authentication and Database)

1. Create a project at [supabase.com](https://supabase.com/).
2. Use a dedicated development project. Only link it after confirming its project reference:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
3. Review the migrations, then apply them to that development project:
   ```bash
   npx supabase db push
   ```
4. From the Supabase Dashboard (**Settings > API**), copy:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Resend (Transactional Email)

1. Create an account at [resend.com](https://resend.com/).
2. For local development, use the test sender `onboarding@resend.dev`. For production, verify a sending domain.
3. Create an API key and copy it as `RESEND_API_KEY`.

### Upstash Redis (Rate Limiting -- Optional for Local)

1. Create a Redis database at [console.upstash.com](https://console.upstash.com/).
2. Copy the REST credentials:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

Rate limiting falls back to in-memory storage during local development if these are not set. Production supports distributed stores; see the [architecture guide](../architecture/ARCHITECTURE.md).

### Google Maps Platform (Optional for Local)

Required only if you need the Google map mode (`/map?view=google`). See the full setup guide at [Google Maps Platform Setup](../operations/google-maps-platform-setup.md).

### Sentry (Error Tracking -- Optional for Local)

1. Create a Next.js project at [sentry.io](https://sentry.io/).
2. Copy the DSN as `NEXT_PUBLIC_SENTRY_DSN`.
3. Sentry is optional during local development but required for production.

### Sylla Companion App (Ecosystem -- Not Needed for Local)

Sylla (`https://sylla.syllabus-sync.app`) is a sibling app that shares Syllabus
Sync's Supabase session. These variables are only relevant when Sylla is deployed
and are **safe to leave unset locally** — the shared-cookie logic is gated to
`NODE_ENV=production` and the sidebar link only renders when its URL is set.

| Variable                         | Scope     | Purpose                                                                                      |
| :------------------------------- | :-------- | :------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` | Prod only | Shares the Supabase auth cookie across `*.syllabus-sync.app`. Must start with a dot.         |
| `NEXT_PUBLIC_TRUSTED_ORIGINS`    | Optional  | Comma-separated, exact-match origin allowlist (no wildcards) for CSRF + post-login redirect. |
| `NEXT_PUBLIC_SYLLA_URL`          | Optional  | Target for the "Sylla AI Study Assistant" sidebar link. The link is hidden when unset.       |

Production setup — including Supabase redirect URLs and verification steps — is in
the [Sylla Shared Authentication](../operations/deployment-checklist.md#sylla-shared-authentication)
section of the deployment checklist.

---

## Step 3: Create the Environment File

Copy the example file and fill in the values obtained in Step 2:

```bash
cp .env.example .env.local
```

At minimum, the following variables must be set for a functional local development environment:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email (use Resend test sender for development)
RESEND_API_KEY=your-resend-api-key
VERIFICATION_EMAIL_FROM=onboarding@resend.dev
VERIFICATION_EMAIL_NAME=Syllabus Sync
```

See `.env.example` for the full list of available variables and their descriptions.

### Running locally without production credentials

- Use a local or test Supabase project only.
- Leave Sylla, Sentry, Maps, Upstash, and other optional integrations unset unless you are actively working on them.
- `npm run build` and `npm run cf:build` can be validated with dummy public values for `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `npm run test:e2e` also works without production credentials; the checked-in Playwright config injects dummy public values when it boots its own local dev server.

---

## Step 4: Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Development Commands

| Command                    | Purpose                                                                            |
| :------------------------- | :--------------------------------------------------------------------------------- |
| `npm run dev`              | Start the Next.js development server with hot module replacement.                  |
| `npm run check`            | Run the full quality gate: secrets scan, formatting, typecheck, lint, test, build. |
| `npm run format:check`     | Check Prettier formatting only.                                                    |
| `npm run lint`             | Run ESLint (zero-tolerance policy -- no errors or warnings allowed).               |
| `npm run typecheck`        | Run TypeScript without emitting files.                                             |
| `npm run test`             | Run the Vitest unit and integration test suite.                                    |
| `npm run build`            | Create a production Next.js build locally.                                         |
| `npm run cf:build`         | Build the Cloudflare/OpenNext worker output locally (no deploy).                   |
| `npm run cf:verify-output` | Verify the generated OpenNext output structure.                                    |
| `npm run test:e2e`         | Run Playwright E2E checks from `config/playwright.config.ts`.                      |

### Quality Gate

Before pushing code, always run the full quality gate:

```bash
npm run check
```

This command runs secrets detection, Prettier formatting checks, TypeScript compilation, ESLint, the Vitest suite, and a Next.js production build. The Cloudflare/OpenNext build is a separate command.

### Playwright E2E notes

- `npm run test:e2e` starts its own local dev server unless `E2E_BASE_URL` is already set.
- Authenticated specs require `E2E_EMAIL` and `E2E_PASSWORD` for a disposable test account and are skipped otherwise.
- `E2E_BASE_URL` is optional when you want to point at an existing non-production deployment.

Configure your editor to respect the project's `.editorconfig` and Prettier configuration (`config/prettier/.prettierrc.json`).

---

## Deployment

The current production target is the Cloudflare Worker `syllabus-sync-production`, built with OpenNext. Contributors can validate packaging locally with `npm run cf:build` and `npm run cf:verify-output` after configuring the required build variables. These commands do not deploy. For the reviewed production release path, see the [Deployment Checklist](../operations/deployment-checklist.md).

For Docker-based deployments, see the [Docker README](../../infra/docker/README.md).

---

## Additional Setup Guides

| Guide                   | Location                                                                                       |
| :---------------------- | :--------------------------------------------------------------------------------------------- |
| Google Maps Platform    | [`docs/operations/google-maps-platform-setup.md`](../operations/google-maps-platform-setup.md) |
| Supabase OAuth (Google) | [`docs/operations/supabase-oauth-setup.md`](../operations/supabase-oauth-setup.md)             |
| Legacy Vercel setup     | [`docs/operations/resend-vercel-setup.md`](../operations/resend-vercel-setup.md)               |
| Deployment Checklist    | [`docs/operations/deployment-checklist.md`](../operations/deployment-checklist.md)             |
