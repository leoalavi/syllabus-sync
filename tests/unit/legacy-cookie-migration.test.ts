import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';
import {
  AUTH_COOKIE_MIGRATION_MARKER,
  markAuthCookiesMigrated,
  migrateLegacyAuthCookies,
} from '@/lib/supabase/legacy-cookie-migration';

const DOMAIN = '.syllabus-sync.app';
function req(path: string, cookies: Record<string, string>, method = 'GET') {
  return new NextRequest(`https://www.syllabus-sync.app${path}`, {
    method,
    headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') },
  });
}

describe('legacy host-only auth cookie cleanup', () => {
  it('expires host-only copies, sets the marker and reloads the same URL once', () => {
    const res = migrateLegacyAuthCookies(
      req('/home?x=1', { 'sb-abc-auth-token': 'old', 'sb-abc-auth-token.0': 'old', other: '1' }),
      DOMAIN,
    )!;
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://www.syllabus-sync.app/home?x=1');
    const setCookies = res.headers.getSetCookie();
    expect(setCookies).toContain('sb-abc-auth-token=; Path=/; Max-Age=0; Secure; SameSite=Lax');
    expect(setCookies).toContain('sb-abc-auth-token.0=; Path=/; Max-Age=0; Secure; SameSite=Lax');
    // Deletes carry no Domain, so the shared .syllabus-sync.app cookie is untouched.
    expect(setCookies.filter((c) => c.startsWith('sb-')).every((c) => !/Domain=/i.test(c))).toBe(true);
    expect(setCookies.some((c) => c.startsWith(`${AUTH_COOKIE_MIGRATION_MARKER}=1; Domain=${DOMAIN}`))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('other='))).toBe(false);
  });

  it('runs only once, only for page loads, and only with a shared domain', () => {
    const cookies = { 'sb-abc-auth-token': 'x' };
    expect(migrateLegacyAuthCookies(req('/home', { ...cookies, [AUTH_COOKIE_MIGRATION_MARKER]: '1' }), DOMAIN)).toBeNull();
    expect(migrateLegacyAuthCookies(req('/api/auth/user', cookies), DOMAIN)).toBeNull();
    expect(migrateLegacyAuthCookies(req('/login', cookies, 'POST'), DOMAIN)).toBeNull();
    expect(migrateLegacyAuthCookies(req('/home', cookies), undefined)).toBeNull();
    expect(migrateLegacyAuthCookies(req('/home', {}), DOMAIN)).toBeNull();
  });

  it('marks a browser with nothing to clean on an ordinary response', () => {
    const res = NextResponse.next();
    markAuthCookiesMigrated(req('/login', {}), res, DOMAIN);
    expect(res.cookies.get(AUTH_COOKIE_MIGRATION_MARKER)?.value).toBe('1');
  });
});
