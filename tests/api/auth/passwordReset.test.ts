import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/password/reset/route';

const createAdminClientMock = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => createAdminClientMock(),
}));

vi.mock(import('@/lib/services/rateLimitService'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    passwordResetTokenLimiter: vi
      .fn()
      .mockResolvedValue({ allowed: true, remaining: 9, resetIn: 0 }),
  };
});

function makePasswordResetsTable(record: { id: string; user_id: string } | null) {
  const chain: any = {};

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gt = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({
    data: record,
    error: record ? null : { message: 'not found' },
  }));

  const updateChain: any = {};
  updateChain.eq = vi.fn(() => updateChain);
  updateChain.select = vi.fn(() => updateChain);
  updateChain.maybeSingle = vi.fn(async () => ({
    data: { id: record?.id ?? 'token-1' },
    error: null,
  }));

  return {
    select: chain.select,
    eq: chain.eq,
    gt: chain.gt,
    limit: chain.limit,
    single: chain.single,
    update: vi.fn(() => updateChain),
    __updateChain: updateChain,
  };
}

describe('password reset consume API', () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
  });

  it('rejects invalid token format', async () => {
    createAdminClientMock.mockReturnValue({
      from: vi.fn(),
      auth: { admin: { updateUserById: vi.fn() } },
    });

    const req = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bad', newPassword: 'A'.repeat(12) }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is not found', async () => {
    const passwordResets = makePasswordResetsTable(null);
    const updateUserById = vi.fn();

    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => passwordResets),
      auth: { admin: { updateUserById } },
    });

    const req = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'a'.repeat(64),
        newPassword: 'A'.repeat(12),
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('resets password when token is valid', async () => {
    const passwordResets = makePasswordResetsTable({
      id: 'token-1',
      user_id: 'user-1',
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });

    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => passwordResets),
      auth: { admin: { updateUserById } },
    });

    const req = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'b'.repeat(64),
        newPassword: 'A'.repeat(12),
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.reset).toBe(true);
    expect(updateUserById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ password: 'A'.repeat(12) }),
    );
  });

  it('fails closed when the token was already consumed by another request', async () => {
    const passwordResets = makePasswordResetsTable({
      id: 'token-1',
      user_id: 'user-1',
    });
    passwordResets.__updateChain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    const updateUserById = vi.fn();

    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => passwordResets),
      auth: { admin: { updateUserById } },
    });

    const req = new NextRequest('http://localhost/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'c'.repeat(64),
        newPassword: 'A'.repeat(12),
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
