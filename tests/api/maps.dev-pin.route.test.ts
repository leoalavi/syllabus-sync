import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/maps/dev-pin/route';

describe('development map pin endpoint', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rejects a null JSON body before accessing its fields', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = await POST(
      new NextRequest('http://localhost/api/maps/dev-pin', {
        method: 'POST',
        body: 'null',
      }),
    );

    expect(response.status).toBe(400);
  });

  it('rejects a non-finite coordinate before editing source', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = await POST(
      new NextRequest('http://localhost/api/maps/dev-pin', {
        method: 'POST',
        body: '{"buildingId":"X","position":[1e400,2]}',
      }),
    );

    expect(response.status).toBe(400);
  });
});
