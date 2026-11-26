import { NextResponse, type NextRequest } from 'next/server';

/**
 * One-time cleanup of host-only Supabase auth cookies.
 *
 * Before the shared Sylla login, the auth cookie was host-only
 * (www.syllabus-sync.app). It is now set for `.syllabus-sync.app`. A browser
 * that still holds the old host-only copy keeps BOTH cookies under the same
 * name and sends the older one first, so the server reads a stale session and
 * the student appears signed out right after signing in. Signing out cannot
 * fix it either, because deletes carry the new Domain and never match the
 * host-only copy.
 *
 * Browsers do not send cookie attributes, so the copies cannot be told apart
 * on the server. Instead, the first page load without the marker cookie
 * expires the host-only copies (a Set-Cookie with no Domain only matches a
 * host-only cookie; the shared one is untouched), sets the marker, and
 * reloads the same URL once. Students whose only session was the old
 * host-only cookie sign in again once.
 */

export const AUTH_COOKIE_MIGRATION_MARKER = 'ss-auth-cookie-v2';

const SUPABASE_AUTH_COOKIE = /^sb-[a-z0-9]+-auth-token(?:-code-verifier)?(?:\.\d+)?$/;

export function legacyAuthCookieNames(request: NextRequest): string[] {
  return request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => SUPABASE_AUTH_COOKIE.test(name));
}

/**
 * Returns a redirect that clears host-only auth cookies, or null when nothing
 * needs doing. Only for page loads (GET, non-API) and only when a shared
 * cookie domain is in use.
 */
export function migrateLegacyAuthCookies(
  request: NextRequest,
  sharedDomain: string | undefined,
): NextResponse | null {
  if (!sharedDomain) return null;
  if (request.method !== 'GET' || request.nextUrl.pathname.startsWith('/api/')) return null;
  if (request.cookies.get(AUTH_COOKIE_MIGRATION_MARKER)) return null;

  const names = legacyAuthCookieNames(request);
  const response = NextResponse.redirect(request.nextUrl, 307);
  response.headers.set('Cache-Control', 'no-store');
  for (const name of names) {
    // No Domain attribute: matches only the host-only copy.
    response.headers.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; Secure; SameSite=Lax`);
  }
  response.headers.append(
    'Set-Cookie',
    `${AUTH_COOKIE_MIGRATION_MARKER}=1; Domain=${sharedDomain}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`,
  );
  // Nothing to clean: set the marker on a normal response instead of redirecting.
  if (names.length === 0) return null;
  return response;
}

/** Sets the marker on an ordinary response when there was nothing to clean. */
export function markAuthCookiesMigrated(
  request: NextRequest,
  response: NextResponse,
  sharedDomain: string | undefined,
): void {
  if (!sharedDomain || request.cookies.get(AUTH_COOKIE_MIGRATION_MARKER)) return;
  if (request.method !== 'GET' || request.nextUrl.pathname.startsWith('/api/')) return;
  response.cookies.set(AUTH_COOKIE_MIGRATION_MARKER, '1', {
    domain: sharedDomain,
    path: '/',
    maxAge: 31536000,
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
  });
}
