import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/auth/sessions/route';

const createServerClientMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => createServerClientMock(),
}));

describe('auth sessions API', () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const request = new NextRequest('http://localhost/api/auth/sessions');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('returns current session when authenticated', async () => {
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-1', last_sign_in_at: '2026-01-23T00:00:00Z' },
          },
          error: null,
        }),
      },
    });

    const request = new NextRequest('http://localhost/api/auth/sessions', {
      headers: { 'user-agent': 'Mozilla/5.0 Chrome' },
    });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(json.data.sessions).toHaveLength(1);
    expect(json.data.sessions[0].current).toBe(true);
  });

  it('signs out sessions by scope', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
        signOut,
      },
    });

    const request = new NextRequest('http://localhost/api/auth/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': '21' },
      body: JSON.stringify({ scope: 'global' }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(json.data.scope).toBe('global');
    expect(signOut).toHaveBeenCalledWith({ scope: 'global' });
  });
});
