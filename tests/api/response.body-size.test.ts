import { describe, expect, it } from 'vitest';
import { parseJsonBody } from '@/app/api/_lib/response';

describe('bounded JSON body parsing', () => {
  it('rejects a streamed body without Content-Length before reading all chunks', async () => {
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads += 1;
        controller.enqueue(new TextEncoder().encode('x'.repeat(8)));
      },
    });
    const request = new Request('http://localhost/test', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const result = await parseJsonBody(request, 16);
    expect(result.error?.status).toBe(413);
    expect(reads).toBeLessThan(5);
  });

  it('counts UTF-8 bytes rather than JavaScript characters', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ value: 'éééé' }),
    });
    const result = await parseJsonBody(request, 18);
    expect(result.error?.status).toBe(413);
  });

  it('parses a small valid JSON payload', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      body: '{"ok":true}',
    });
    const result = await parseJsonBody<{ ok: boolean }>(request, 32);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ ok: true });
  });
});
