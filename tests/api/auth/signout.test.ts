import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/signout/route';

const signOutMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({ auth: { signOut: signOutMock } }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe('POST /api/auth/signout', () => {
  beforeEach(() => {
    signOutMock.mockReset();
  });

  it('signs out the current session only, not every device', async () => {
    signOutMock.mockResolvedValue({ error: null });

    const res = await POST();

    expect(res.status).toBe(200);
    // supabase-js defaults to 'global'; "sign out everywhere" is the separate
    // POST /api/auth/sessions action.
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('returns 400 when Supabase reports a sign-out error', async () => {
    signOutMock.mockResolvedValue({ error: { message: 'boom' } });

    const res = await POST();

    expect(res.status).toBe(400);
  });
});
