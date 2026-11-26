import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidSupabaseUrl } from '@/lib/supabase/url';

afterEach(() => vi.unstubAllEnvs());

describe('isValidSupabaseUrl', () => {
  it('accepts hosted projects and rejects placeholders', () => {
    expect(isValidSupabaseUrl('https://abc.supabase.co')).toBe(true);
    expect(isValidSupabaseUrl('https://your-project-id.supabase.co')).toBe(false);
    expect(isValidSupabaseUrl('')).toBe(false);
    expect(isValidSupabaseUrl(undefined)).toBe(false);
  });

  it('accepts a local Supabase stack outside production only', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isValidSupabaseUrl('http://127.0.0.1:54321')).toBe(true);
    expect(isValidSupabaseUrl('http://localhost:54321')).toBe(true);
    expect(isValidSupabaseUrl('http://evil.example:54321')).toBe(false);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isValidSupabaseUrl('http://127.0.0.1:54321')).toBe(false);
  });
});
