# Google Maps Platform Setup

> **Audience:** Engineers configuring Google Maps for the `/map?view=google` mode.
> **Production URL verified:** 2026-10-03. Recheck Google Cloud key settings before changing them.

This runbook walks through provisioning Google Cloud APIs, creating API keys, and configuring the application for local development and the Cloudflare-hosted production app.

---

## Prerequisites

- A Google Cloud account with billing enabled.
- Access to the [Google Cloud Console](https://console.cloud.google.com/).
- The Syllabus Sync repository cloned locally.

---

## 1. Create or Select a Google Cloud Project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select the existing project used by Syllabus Sync.
3. Confirm that billing is enabled on the project. Google Maps Platform APIs require an active billing account.

---

## 2. Enable Required APIs

Navigate to **APIs & Services > Library** and enable the following APIs:

| API                     | Purpose                                                   |
| :---------------------- | :-------------------------------------------------------- |
| **Maps JavaScript API** | Renders the interactive map in the browser.               |
| **Routes API**          | Computes walking/driving/transit directions server-side.  |
| **Places API (New)**    | Powers place search and place detail lookups server-side. |

---

## 3. Create the Browser API Key

This key is loaded by the Google Maps JavaScript API in the client browser.

1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > API Key**.
3. Click **Edit API Key** and configure restrictions:
   - **Application restriction:** HTTP referrers (websites).
   - **Website restrictions:** Add each domain that serves the application:
     - `http://localhost:3000/*`
     - `https://www.syllabus-sync.app/*`
     - Add an exact preview origin only if that preview needs the browser key.
   - **API restriction:** Restrict to **Maps JavaScript API** only.
4. Save the key.

Set in your environment:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-browser-key>
```

---

## 4. Create the Server API Key

This key is used by the server-side API proxy routes:

- `/api/maps/routes` -- route computation
- `/api/maps/place-search` -- place autocomplete and search
- `/api/maps/place-details` -- place detail lookups

These proxies keep the server key off the client. They include rate limiting (`apiLimiter`) and origin validation (`isTrustedOrigin`).

1. Create a second API key in **APIs & Services > Credentials**.
2. Configure restrictions:
   - **Application restriction:** Review the Cloudflare Worker egress model before choosing an IP restriction. Do not assume a stable outbound IP.
   - **API restriction:** Restrict to **Routes API** and **Places API (New)**.
3. Save the key.

Set in your environment:

```
GOOGLE_ROUTES_API_KEY=<your-server-key>
```

---

## 5. Create a Map ID

Advanced Markers and vector map styling require a Map ID.

1. Navigate to **Google Maps Platform > Map Management**.
2. Click **Create Map ID**.
3. Select **JavaScript** as the map type.
4. Optionally apply a cloud-based map style for custom appearance.
5. Copy the generated Map ID.

Set in your environment:

```
NEXT_PUBLIC_GOOGLE_MAP_ID=<your-map-id>
```

---

## 6. Configure the Application

### Local Development

Add all three variables to `.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-browser-key>
NEXT_PUBLIC_GOOGLE_MAP_ID=<your-map-id>
GOOGLE_ROUTES_API_KEY=<your-server-key>
```

Restart the development server:

```bash
npm run dev
```

### Vercel Deployment

Add all three variables in the Vercel Dashboard under **Settings > Environment Variables**. Apply them to `development`, `preview`, and `production` environments as appropriate.

---

## 7. Verification

After configuration, verify the full map pipeline:

1. Open `/map?view=google` in your browser.
2. Confirm the interactive JavaScript map renders (not an iframe fallback).
3. Use the search HUD to find a campus building.
4. Select a destination and confirm that route computation succeeds.
5. Switch between travel modes (walking, driving, transit) and verify the route polyline and route panel update.
6. Click **Start Navigation** and confirm live tracking activates (location follow, route recalculation).

---

## Troubleshooting

| Symptom                                | Likely Cause                                                          | Resolution                                                                                                             |
| :------------------------------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| Map does not render                    | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` missing or invalid                  | Verify the key exists in `.env.local` and the Maps JavaScript API is enabled.                                          |
| `RefererNotAllowedMapError` in console | Browser key referrer restriction does not match the current domain    | Add the current domain to the key's HTTP referrer allowlist in the Cloud Console.                                      |
| Map renders but routes fail            | `GOOGLE_ROUTES_API_KEY` missing server-side or Routes API not enabled | Confirm the server key is set and the Routes API is enabled on the project.                                            |
| Place search returns no results        | Places API (New) not enabled or server key not authorized             | Enable the Places API and add it to the server key's API restrictions.                                                 |
| Advanced Markers not appearing         | `NEXT_PUBLIC_GOOGLE_MAP_ID` missing or not a JavaScript-type Map ID   | Create a JavaScript Map ID in Map Management.                                                                          |
| Map script blocked by CSP              | Content Security Policy does not allow Google Maps domains            | Confirm that `lib/security/csp.ts` includes the Google Maps script and connect-src allowlists. Redeploy after changes. |
| 401 errors on `/api/maps/*` routes     | API routes not listed in `isPublicApiPath()`                          | Verify that `lib/proxy.ts` includes `/api/maps/` in its public path list.                                              |
