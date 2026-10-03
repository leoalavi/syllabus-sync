import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getClientIPFromHeaders } from '@/lib/security/ip';

function headersOf(entries: Record<string, string>) {
  return {
    get(name: string) {
      return entries[name.toLowerCase()] ?? null;
    },
  };
}

describe('getClientIPFromHeaders', () => {
  const originalEnv = { ...process.env };

  function setEnv(updates: Record<string, string>) {
    // `process.env.NODE_ENV` is typed as readonly in TS; replace the env object instead.
    process.env = { ...process.env, ...updates } as NodeJS.ProcessEnv;
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses x-forwarded-for on vercel production runtime', () => {
    setEnv({ VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production' });

    const ip = getClientIPFromHeaders(
      headersOf({
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      }),
    );
    expect(ip).toBe('1.2.3.4');
  });

  it('prefers x-real-ip when present in production', () => {
    setEnv({ VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production' });

    const ip = getClientIPFromHeaders(
      headersOf({
        'x-real-ip': '9.9.9.9',
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      }),
    );
    expect(ip).toBe('9.9.9.9');
  });

  it("uses only Cloudflare's connecting-IP on the Cloudflare production runtime", () => {
    setEnv({
      VERCEL: '',
      VERCEL_ENV: '',
      DEPLOYMENT_PLATFORM: 'cloudflare',
      NODE_ENV: 'production',
    });

    const ip = getClientIPFromHeaders(
      headersOf({
        'cf-connecting-ip': '8.8.8.8',
        'x-vercel-forwarded-for': '9.9.9.9',
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'x-real-ip': '2.2.2.2',
      }),
    );
    expect(ip).toBe('8.8.8.8');
  });

  it("rejects spoofed forwarded headers when Cloudflare's header is absent", () => {
    setEnv({
      VERCEL: '',
      VERCEL_ENV: '',
      DEPLOYMENT_PLATFORM: 'cloudflare',
      NODE_ENV: 'production',
    });
    const ip = getClientIPFromHeaders(
      headersOf({
        'x-vercel-forwarded-for': '9.9.9.9',
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'x-real-ip': '2.2.2.2',
        'x-client-ip': '3.3.3.3',
      }),
    );
    expect(ip).toBe('unknown');
  });

  it('does not trust proxy headers in an unknown production runtime', () => {
    setEnv({ VERCEL: '', VERCEL_ENV: '', DEPLOYMENT_PLATFORM: '', NODE_ENV: 'production' });
    expect(
      getClientIPFromHeaders(
        headersOf({
          'cf-connecting-ip': '8.8.8.8',
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '2.2.2.2',
        }),
      ),
    ).toBe('unknown');
  });

  it('falls back to 127.0.0.1 in development when no headers are present', () => {
    setEnv({ VERCEL: '', VERCEL_ENV: '', NODE_ENV: 'development' });

    const ip = getClientIPFromHeaders(headersOf({}));
    expect(ip).toBe('127.0.0.1');
  });
});
