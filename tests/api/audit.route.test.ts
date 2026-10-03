import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/audit/route';

const createServerClientMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => createServerClientMock(),
}));

describe('audit route query validation', () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentLevel: 'aal1', nextLevel: 'aal1' },
            error: null,
          }),
        },
      },
      rpc: vi.fn(),
      from: vi.fn(),
    });
  });

  it('returns 400 for non-finite pagination parameters', async () => {
    const response = await GET(new NextRequest('http://localhost/api/audit?limit=wat&offset=-1'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.message).toBe('Invalid audit query parameters');
  });
});
