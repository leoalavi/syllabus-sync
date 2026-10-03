# Supabase OAuth Setup (Google)

> **Audience:** Engineers configuring Google OAuth authentication via Supabase Auth.
> **Production URL verified:** 2026-10-03. Recheck provider settings in the dashboards before changing them.

Syllabus Sync uses the Supabase Auth PKCE flow for OAuth. The auth code exchange happens in the server-side route handler at `app/auth/callback/route.ts`.

---

## Prerequisites

- A Supabase project with Authentication enabled.
- A Google Cloud project with OAuth 2.0 credentials configured.
- Access to both the [Supabase Dashboard](https://supabase.com/dashboard) and the [Google Cloud Console](https://console.cloud.google.com/).

---

## 1. Configure Supabase Auth URLs

In the Supabase Dashboard, navigate to **Authentication > URL Configuration**.

### Site URL

Set the **Site URL** to your primary production domain:

```
https://www.syllabus-sync.app
```

### Redirect URLs

Add the following redirect URLs. Every domain that serves the application must be listed, because the browser's `window.location.origin` determines which callback URL is used.

**Production:**

```
https://www.syllabus-sync.app/auth/callback
https://www.syllabus-sync.app/auth/callback/**
https://www.syllabus-sync.app/auth/confirm
https://www.syllabus-sync.app/reset-password
```

**Local development:**

```
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback/**
http://localhost:3000/auth/confirm
http://localhost:3000/reset-password
```

**Preview deployments (if applicable):**

Add only the exact preview origins that serve this application and need OAuth. Review each redirect before allowing it in Supabase.

---

## 2. Configure the Google OAuth Provider

### In the Supabase Dashboard

1. Navigate to **Authentication > Providers > Google**.
2. Enable the Google provider.
3. Enter the **Client ID** and **Client Secret** from your Google Cloud OAuth credentials.

### In the Google Cloud Console

1. Navigate to **APIs & Services > Credentials**.
2. Open your OAuth 2.0 Client ID (or create one if it does not exist).
3. Under **Authorized redirect URIs**, add the Supabase callback URL:

```
https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
```

4. Save the changes.

---

## 3. Application Configuration

### Environment variables

Ensure the following are set in `.env.local` (local development) or in Vercel (production):

| Variable                        | Example                    | Notes                                                                    |
| :------------------------------ | :------------------------- | :----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://xxxx.supabase.co` | Your Supabase project URL.                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` or `sb_...`       | Supabase anonymous/public key.                                           |
| `NEXT_PUBLIC_APP_URL`           | `http://localhost:3000`    | Used to construct redirect URLs. Set to production domain in production. |

### Auth flow details

- The login UI redirects users to Supabase OAuth with `redirectTo=<origin>/auth/callback?redirectTo=<safe-path>`.
- The `/auth/callback` route handler validates the `redirectTo` parameter against an allowlist to prevent open redirect attacks.
- After successful authentication, users are redirected to the originally requested page.

---

## 4. Verification

### Local development

1. Confirm `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
2. Start the development server: `npm run dev`.
3. Navigate to the login page.
4. Click **Continue with Google**.
5. Complete the Google sign-in flow.
6. Confirm that you are redirected back to the application and your session is established.

### Production

1. Open the production URL in an incognito browser window.
2. Click **Continue with Google**.
3. Confirm the OAuth flow completes and the session is active.
4. Log out and log back in to verify session persistence.

---

## Troubleshooting

| Symptom                                        | Likely Cause                                                                           | Resolution                                                                                                                          |
| :--------------------------------------------- | :------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| "Redirect URI mismatch" error from Google      | The Supabase callback URL is not listed in Google Cloud OAuth authorized redirect URIs | Add `https://<project-ref>.supabase.co/auth/v1/callback` to the Google OAuth client.                                                |
| OAuth flow completes but user is not logged in | The redirect URL is not listed in Supabase's allowed redirect URLs                     | Add the domain's `/auth/callback` URL to Supabase Auth URL Configuration.                                                           |
| Open redirect warning in security audit        | `redirectTo` parameter not validated                                                   | The `/auth/callback` handler validates against a safe-path allowlist. Confirm the validation logic in `app/auth/callback/route.ts`. |
| "Invalid origin" error                         | `NEXT_PUBLIC_APP_URL` does not match the domain serving the app                        | Update the variable to match the actual serving domain.                                                                             |
| OAuth works locally but not in production      | Site URL or redirect URLs in Supabase are still set to `localhost`                     | Update the Supabase Auth URL Configuration with production URLs.                                                                    |
