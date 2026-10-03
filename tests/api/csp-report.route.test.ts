import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/csp-report/route';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

describe('public CSP report endpoint', () => {
  const url = 'https://www.syllabus-sync.app/api/csp-report';

  it('rejects oversized reports without a Content-Length header', async () => {
    const response = await POST(
      new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({ 'csp-report': { 'blocked-uri': 'x'.repeat(9000) } }),
      }),
    );
    expect(response.status).toBe(413);
  });

  it('rejects malformed report fields', async () => {
    const response = await POST(
      new NextRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          'csp-report': { 'blocked-uri': { invalid: true }, 'violated-directive': 'script-src', disposition: 'enforce' },
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
