/**
 * Campus Navigation handoff (Syllabus Sync → Campus Navigation).
 *
 * Campus Navigation is a separate Flutter app. Its mobile builds are not in the
 * App Store or Google Play yet, so the UI shows the mobile app as "coming soon"
 * and offers the Campus Navigation web app instead.
 *
 * The web app uses Flutter's default hash URL strategy, so its public entry
 * point is `<web url>/#/open?destination=<buildingId>`. `/open` and its
 * parameter names are the stable contract defined in Campus Navigation's
 * lib/features/deep_link/deep_link_contract.dart; do not rename them here.
 *
 * Every link is driven by env so nothing points at a URL that does not exist:
 * - NEXT_PUBLIC_CAMPUS_NAV_WEB_URL: unset → the web option is hidden.
 * - NEXT_PUBLIC_CAMPUS_NAV_IOS_STORE_URL / _ANDROID_STORE_URL: unset → the
 *   platform shows "coming soon" instead of a download button.
 */

function httpUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? trimmed.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

// Read as literal property accesses so Next.js inlines them into the client bundle.
export const CAMPUS_NAV_WEB_URL = httpUrl(process.env.NEXT_PUBLIC_CAMPUS_NAV_WEB_URL);
export const CAMPUS_NAV_IOS_STORE_URL = httpUrl(process.env.NEXT_PUBLIC_CAMPUS_NAV_IOS_STORE_URL);
export const CAMPUS_NAV_ANDROID_STORE_URL = httpUrl(
  process.env.NEXT_PUBLIC_CAMPUS_NAV_ANDROID_STORE_URL,
);

/**
 * Link that opens the Campus Navigation web app focused on a building.
 * Building ids are matched case-insensitively by the app (BuildingIdResolver),
 * so they are sent upper-case, the form its data uses.
 */
export function buildCampusNavWebUrl(
  buildingId: string | undefined,
  baseUrl: string | null = CAMPUS_NAV_WEB_URL,
): string | null {
  if (!baseUrl) return null;
  const id = buildingId?.trim();
  if (!id) return `${baseUrl}/#/map`;
  return `${baseUrl}/#/open?destination=${encodeURIComponent(id.toUpperCase())}`;
}
