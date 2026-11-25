/**
 * Redirect-target validation for post-auth navigation.
 *
 * Kept free of heavy dependencies so the request proxy can import it without
 * pulling the password-strength library into every request's bundle.
 */
import { APP_CONFIG } from '@/lib/config';
import { getTrustedExternalOrigins } from '@/lib/security/trusted-origins';

// Centralized whitelist - easier to manage
export const SAFE_REDIRECT_PATHS = [
  '/dashboard',
  '/home',
  '/calendar',
  '/feed',
  '/map',
  '/units',
  '/manage-profiles',
  '/settings',
  '/setup',
  '/onboarding',
] as const;

export function isValidRedirect(url: string | null): boolean {
  if (!url) return false;

  // 1. Check if it's a relative path (starts with / but not //)
  const isRelative = url.startsWith('/') && !url.startsWith('//');

  // 2. Allow base URL
  const isBaseUrl = url.startsWith(APP_CONFIG.url);

  // 3. Allow explicitly-trusted sibling apps (e.g. Sylla on another subdomain).
  //    These are absolute URLs whose origin must exactly match an operator-
  //    configured entry in NEXT_PUBLIC_TRUSTED_ORIGINS — never a wildcard, and
  //    never inferred from the URL itself. Any path on a trusted origin is
  //    allowed, since we trust the origin wholesale for the SSO hand-off.
  if (!isRelative && !isBaseUrl) {
    return isTrustedExternalRedirect(url);
  }

  // 4. Whitelist check for internal destinations (Strict Mode)
  // Remove query params for checking
  const path = url.split('?')[0].replace(APP_CONFIG.url, '');

  return SAFE_REDIRECT_PATHS.some((safePath) => path.startsWith(safePath));
}

/**
 * True when `url` is an absolute URL whose origin is in the configured
 * cross-origin allowlist (`NEXT_PUBLIC_TRUSTED_ORIGINS`). Protocol-relative
 * URLs (`//evil.com`) and anything unparseable are rejected.
 */
function isTrustedExternalRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return getTrustedExternalOrigins().includes(parsed.origin);
  } catch {
    return false;
  }
}
