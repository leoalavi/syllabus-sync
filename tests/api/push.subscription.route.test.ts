import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, POST } from '@/app/api/push/subscription/route';

const createServerClientMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => createServerClientMock(),
}));

vi.mock('@/app/api/_lib/middleware', () => ({
  requireAuthWithRateLimit: (_request: Request, handler: (userId: string) => Promise<Response>) =>
    handler('user-1'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function createUpsertChain(result: { data: unknown; error: unknown }) {
  const chain = {
    upsert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(async () => result),
  };
  chain.upsert.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  return chain;
}

function createDeleteChain(result: { error: unknown }) {
  const chain = {
    delete: vi.fn(),
    eq: vi.fn(),
    then: (resolve: (value: { error: unknown }) => void) => resolve(result),
  };
  chain.delete.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

describe('push subscription route', () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
  });

  it('stores a push subscription via POST', async () => {
    const table = createUpsertChain({
      data: { id: 'sub-1', endpoint: 'https://fcm.googleapis.com/fcm/send/sub' },
      error: null,
    });

    createServerClientMock.mockReturnValue({
      from: vi.fn(() => table),
    });

    const response = await POST(
      new Request('http://localhost/api/push/subscription', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/sub',
          expirationTime: null,
          keys: {
            p256dh: 'p256dh-key',
            auth: 'auth-key',
          },
          userAgent: 'Vitest',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(table.upsert).toHaveBeenCalledTimes(1);
    expect(table.upsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/sub',
        p256dh_key: 'p256dh-key',
        auth_key: 'auth-key',
      }),
    );
  });

  it('deletes a push subscription via DELETE', async () => {
    const table = createDeleteChain({ error: null });
    createServerClientMock.mockReturnValue({
      from: vi.fn(() => table),
    });

    const response = await DELETE(
      new Request('http://localhost/api/push/subscription', {
        method: 'DELETE',
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/sub',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(table.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('rejects an arbitrary server-side push destination before database access', async () => {
    const response = await POST(
      new Request('http://localhost/api/push/subscription', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://127.0.0.1/internal',
          keys: { p256dh: 'key', auth: 'key' },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('rejects an expiration outside the Date range', async () => {
    const response = await POST(
      new Request('http://localhost/api/push/subscription', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://fcm.googleapis.com/fcm/send/sub',
          expirationTime: 9e15,
          keys: { p256dh: 'key', auth: 'key' },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});
