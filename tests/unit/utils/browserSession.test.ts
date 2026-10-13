import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createBrowserClientMock, getUserMock, isSupabaseConfiguredMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const createBrowserClientMock = vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  }));
  const isSupabaseConfiguredMock = vi.fn(() => true);

  return {
    createBrowserClientMock,
    getUserMock,
    isSupabaseConfiguredMock,
  };
});

vi.mock('@/lib/supabase/client', () => ({
  createBrowserClient: createBrowserClientMock,
  isSupabaseConfigured: isSupabaseConfiguredMock,
}));

import {
  getBrowserAuthSnapshot,
  getConfirmedBrowserAuthSnapshot,
} from '@/lib/supabase/browserSession';

describe('browserSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    isSupabaseConfiguredMock.mockReturnValue(true);
  });

  it('returns the resolved user when getUser succeeds', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    });

    const snapshot = await getBrowserAuthSnapshot();

    expect(snapshot.resolution).toBe('resolved');
    expect(snapshot.user?.id).toBe('user-1');
  });

  it('returns an unknown resolution when getUser errors', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error('token refresh in progress'),
    });

    const snapshot = await getBrowserAuthSnapshot();

    expect(snapshot).toEqual({
      resolution: 'unknown',
      session: null,
      user: null,
    });
  });

  it('treats a missing session as a resolved signed-out state', async () => {
    // auth-js returns this locally (no network call) when no token is stored.
    const missing = Object.assign(new Error('Auth session missing!'), {
      name: 'AuthSessionMissingError',
    });
    getUserMock.mockResolvedValue({ data: { user: null }, error: missing });

    const snapshot = await getBrowserAuthSnapshot();

    expect(snapshot).toEqual({ resolution: 'resolved', session: null, user: null });
  });

  it('retries once before confirming a signed-out snapshot', async () => {
    vi.useFakeTimers();
    getUserMock
      .mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: 'user-2' } },
        error: null,
      });

    const snapshotPromise = getConfirmedBrowserAuthSnapshot({ retryDelayMs: 150 });
    await vi.advanceTimersByTimeAsync(150);
    const snapshot = await snapshotPromise;

    expect(getUserMock).toHaveBeenCalledTimes(2);
    expect(snapshot.resolution).toBe('resolved');
    expect(snapshot.user?.id).toBe('user-2');
  });

  it('returns signed out after the confirmation retry still finds no user', async () => {
    vi.useFakeTimers();
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const snapshotPromise = getConfirmedBrowserAuthSnapshot({ retryDelayMs: 150 });
    await vi.advanceTimersByTimeAsync(150);
    const snapshot = await snapshotPromise;

    expect(getUserMock).toHaveBeenCalledTimes(2);
    expect(snapshot).toEqual({
      resolution: 'resolved',
      session: null,
      user: null,
    });
  });
});
