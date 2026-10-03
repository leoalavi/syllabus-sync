# Resend and Vercel Setup

> **Legacy Vercel reference:** Syllabus Sync production currently uses Cloudflare Workers through OpenNext. Do not follow this page for a production release; use the [current deployment checklist](./deployment-checklist.md). Resend-specific concepts here may still help with email configuration.

> **Audience:** Engineers configuring email delivery and the Vercel deployment environment.
> **Last verified:** 2026-03-21

This runbook covers Resend (transactional email), Vercel environment variable management, cron job security, and production rate limiting configuration.

---

## Prerequisites

- A [Resend](https://resend.com/) account with a verified sending domain (or use `onboarding@resend.dev` for development).
- Access to the Vercel project dashboard.
- The Vercel CLI installed (`npm i -g vercel` or use the project's pinned version).

---

## 1. Required Environment Variables

Configure the following variables in the Vercel Dashboard under **Settings > Environment Variables**. Apply them to the appropriate environments (development, preview, production).

### Core Application

| Variable                        | Visibility | Description                                                                                                  |
| :------------------------------ | :--------- | :----------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public     | Supabase project URL.                                                                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public     | Supabase anonymous/public key.                                                                               |
| `SUPABASE_SERVICE_ROLE_KEY`     | Secret     | Supabase service role key. Server-side only.                                                                 |
| `NEXT_PUBLIC_APP_URL`           | Public     | Primary production domain (e.g., `https://syllabus-sync.vercel.app`). Falls back to `VERCEL_URL` if not set. |

### Email (Resend)

| Variable                  | Visibility | Description                                                                                          |
| :------------------------ | :--------- | :--------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`          | Secret     | Resend API key for sending transactional email.                                                      |
| `VERIFICATION_EMAIL_FROM` | Plain      | Sender address. Use `onboarding@resend.dev` in development; a verified domain address in production. |
| `VERIFICATION_EMAIL_NAME` | Plain      | Display name for outbound emails (e.g., `Syllabus Sync`).                                            |

### Google Maps

| Variable                          | Visibility | Description                                     |
| :-------------------------------- | :--------- | :---------------------------------------------- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Public     | Browser key for the Maps JavaScript API.        |
| `NEXT_PUBLIC_GOOGLE_MAP_ID`       | Public     | Map ID for Advanced Markers and vector styling. |
| `GOOGLE_ROUTES_API_KEY`           | Secret     | Server key for Routes and Places API proxies.   |

### Rate Limiting

| Variable                   | Visibility | Description                                                           |
| :------------------------- | :--------- | :-------------------------------------------------------------------- |
| `KV_REST_API_URL`          | Secret     | Vercel KV REST endpoint. Required by the production env check script. |
| `KV_REST_API_TOKEN`        | Secret     | Vercel KV REST token. Required by the production env check script.    |
| `UPSTASH_REDIS_REST_URL`   | Secret     | Upstash Redis REST endpoint (preferred over KV at higher traffic).    |
| `UPSTASH_REDIS_REST_TOKEN` | Secret     | Upstash Redis REST token.                                             |

### Security

| Variable      | Visibility | Description                                                                           |
| :------------ | :--------- | :------------------------------------------------------------------------------------ |
| `CRON_SECRET` | Secret     | Protects cron endpoints. Minimum 32 characters. Generate with `openssl rand -hex 32`. |

---

## 2. Managing Variables with the Vercel CLI

The repository includes helper scripts for common Vercel operations.

### Link the project

```bash
npm run vercel:link
```

### Pull remote variables to local `.env.local`

```bash
npm run vercel:env:pull
```

### Add or update a variable

```bash
vercel env add RESEND_API_KEY production
# The CLI prompts for the value interactively; it is never printed back.
```

### Validate that all required variable names exist

This checks names only and does not reveal secret values:

```bash
VERCEL_ENVIRONMENT=production npm run vercel:env:check
```

---

## 3. Cron Job Security

The `vercel.json` configuration schedules periodic cleanup jobs:

| Endpoint                           | Purpose                                    |
| :--------------------------------- | :----------------------------------------- |
| `/api/auth/email/cleanup`          | Removes expired email verification tokens. |
| `/api/auth/password/cleanup`       | Removes expired password reset tokens.     |
| `/api/security/rate-limit/cleanup` | Purges stale rate-limit entries.           |

These endpoints require the `Authorization: Bearer <CRON_SECRET>` header. Vercel Cron Jobs sends this header automatically when `CRON_SECRET` is configured in the project's environment variables.

**Verification:** After setting `CRON_SECRET`, confirm that an unauthenticated request returns 401:

```bash
curl -s -o /dev/null -w "%{http_code}" https://your-domain.vercel.app/api/auth/email/cleanup
# Expected: 401
```

---

## 4. Rate Limiting in Production

The application includes a distributed rate limiter that selects a backend in the following priority order:

| Priority | Backend                      | Required Variables                                   |
| :------- | :--------------------------- | :--------------------------------------------------- |
| 1        | Upstash Redis                | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| 2        | Vercel KV                    | `KV_REST_API_URL`, `KV_REST_API_TOKEN`               |
| 3        | Supabase Postgres (fallback) | `SUPABASE_SERVICE_ROLE_KEY`                          |

**Important considerations:**

- The production env check script (`tools/vercel/check-required-env.mjs`) requires `KV_REST_API_URL` and `KV_REST_API_TOKEN` to be set, even if the runtime would fall back to another backend. Provision a compatible KV or Redis resource that supplies these variables.
- Do not set `ALLOW_MEMORY_RATE_LIMIT=true` in production. In-memory rate limiting is per-instance only and does not work correctly across Vercel's serverless function invocations.
- `REDIS_URL` alone is not sufficient; the application expects the REST-based `KV_*` or `UPSTASH_*` variables.

---

## Troubleshooting

| Symptom                                                  | Likely Cause                                                           | Resolution                                                                     |
| :------------------------------------------------------- | :--------------------------------------------------------------------- | :----------------------------------------------------------------------------- |
| Verification emails not sending                          | `RESEND_API_KEY` missing or invalid                                    | Verify the key in the Resend dashboard and confirm it is set in Vercel.        |
| Emails arrive from `onboarding@resend.dev` in production | `VERIFICATION_EMAIL_FROM` still set to the development sender          | Update to a verified production domain address.                                |
| `vercel:env:check` fails                                 | One or more required variables are missing from the target environment | Run `vercel env ls` to see what is configured, then add the missing variables. |
| Cron jobs returning 401                                  | `CRON_SECRET` not set or mismatched                                    | Regenerate with `openssl rand -hex 32` and set in Vercel.                      |
| Rate limiting not working                                | No distributed store configured                                        | Provision Upstash Redis or Vercel KV and set the corresponding variables.      |
