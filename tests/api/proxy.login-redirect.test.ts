import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const supabaseMocks = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  signOutMock: vi.fn(),
  getAalMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: supabaseMocks.getUserMock,
      signOut: supabaseMocks.signOutMock,
      mfa: { getAuthenticatorAssuranceLevel: supabaseMocks.getAalMock },
    },
  })),
}));

// A signed-in user who reaches /login from a sibling app's "Sign in" button
// must be sent back there (when the target is trusted), not to /home.
describe('proxy: signed-in user on /login with redirectTo', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJ.test';
    process.env.NEXT_PUBLIC_TRUSTED_ORIGINS = 'https://sylla.syllabus-sync.app';
    supabaseMocks.getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email_confirmed_at: '2026-01-01T00:00:00Z' } },
      error: null,
    });
    supabaseMocks.getAalMock.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  async function locationFor(url: string) {
    const { proxy } = await import('@/lib/proxy');
    const res = await proxy(new NextRequest(url));
    return res.headers.get('location');
  }

  it('returns to a trusted sibling app', async () => {
    const target = 'https://sylla.syllabus-sync.app/chat?x=1';
    expect(
      await locationFor(`http://localhost/login?redirectTo=${encodeURIComponent(target)}`),
    ).toBe(target);
  });

  it('returns to an allowlisted internal path', async () => {
    expect(await locationFor('http://localhost/login?redirectTo=%2Fcalendar')).toBe(
      'http://localhost/calendar',
    );
  });

  it('never follows an untrusted origin (no open redirect)', async () => {
    const location = await locationFor(
      `http://localhost/login?redirectTo=${encodeURIComponent('https://evil.example/phish')}`,
    );
    expect(location).toBe('http://localhost/home');
  });

  it('falls back to /home without a redirectTo', async () => {
    expect(await locationFor('http://localhost/login')).toBe('http://localhost/home');
  });

  it('ignores redirectTo on /signup (only /login hands back)', async () => {
    const target = encodeURIComponent('https://sylla.syllabus-sync.app/');
    expect(await locationFor(`http://localhost/signup?redirectTo=${target}`)).toBe(
      'http://localhost/home',
    );
  });
});
