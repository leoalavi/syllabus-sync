import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/password/route';

const createServerClientMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => createServerClientMock(),
}));

vi.mock('@/lib/services/rateLimitService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/rateLimitService')>();
  return {
    ...actual,
    passwordResetLimiter: vi.fn().mockResolvedValue({ allowed: true, remaining: 4, resetIn: 0 }),
  };
});

describe('password change API', () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
  });

  it('returns 400 for malformed JSON bodies instead of 413', async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'user@example.com' } },
          error: null,
        }),
        signInWithPassword: vi.fn(),
        updateUser: vi.fn(),
      },
    });

    const request = new NextRequest('http://localhost/api/auth/password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{"currentPassword":"old"',
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.message).toContain('Invalid JSON');
  });
});
