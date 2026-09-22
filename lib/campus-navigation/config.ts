/**
 * Campus Navigation companion-app configuration.
 *
 * Campus Navigation is an Android + iOS product. It has NO web build, so there
 * is deliberately no web fallback anywhere in this module: if the app is not
 * installed we offer the store listings and nothing else.
 *
 * Store URLs live here (overridable by env) so that when the App Store listing
 * finally exists, only this file — or the deployment's env — needs to change.
 * No navigation logic reads a hard-coded store URL.
 */

/** Android listing. The app ships under this applicationId. */
export const CAMPUS_NAV_ANDROID_PACKAGE = "io.mqnavigation.mq_navigation";

/**
 * Google Play listing.
 *
 * Play resolves `/store/apps/details?id=<package>` for an unpublished package
 * with an honest "not found" page rather than a broken link, so it is safe to
 * ship before the listing is live.
 */
export const CAMPUS_NAV_ANDROID_STORE_URL =
  process.env.NEXT_PUBLIC_CAMPUS_NAV_ANDROID_STORE_URL ||
  `https://play.google.com/store/apps/details?id=${CAMPUS_NAV_ANDROID_PACKAGE}`;

/**
 * App Store listing — does not exist yet.
 *
 * Intentionally null rather than a guessed `apps.apple.com` URL: an invented
 * link would 404 and look broken. While this is null the UI marks the iOS
 * download "coming soon" and disables it. Set
 * NEXT_PUBLIC_CAMPUS_NAV_IOS_STORE_URL (or replace this default) once the
 * listing is live — no other file needs touching.
 */
export const CAMPUS_NAV_IOS_STORE_URL: string | null =
  process.env.NEXT_PUBLIC_CAMPUS_NAV_IOS_STORE_URL || null;

/** Whether the iOS listing is available yet. */
export const isIosStoreAvailable = (): boolean =>
  typeof CAMPUS_NAV_IOS_STORE_URL === "string" &&
  CAMPUS_NAV_IOS_STORE_URL.length > 0;

/**
 * Deep-link transport — must match
 * MQ_Navigation/lib/features/deep_link/deep_link_contract.dart.
 */
export const CAMPUS_NAV_SCHEME = "mqnav";
export const CAMPUS_NAV_HOST = "mqnavigation.app";
export const CAMPUS_NAV_OPEN_PATH = "/open";

/**
 * How long to wait for the OS to switch away to Campus Navigation before we
 * conclude it is not installed.
 *
 * A successful handoff backgrounds this tab, which fires `visibilitychange`/
 * `pagehide` well inside this window; the timer is only the backstop for the
 * silent-failure case, where nothing at all happens. Long enough to survive a
 * slow cold start, short enough not to feel broken.
 */
export const CAMPUS_NAV_HANDOFF_TIMEOUT_MS = 1200;
