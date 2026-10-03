import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateHeaderScanTarget } from '@/lib/security/scan-target';
import { scanURLHeaders } from '@/lib/security/headers-scanner';

describe('header scan target boundary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['https://www.syllabus-sync.app/', 'https://info.syllabus-sync.app/'])(
    'accepts approved public project origin %s',
    (url) => {
      expect(validateHeaderScanTarget(url)).toEqual({ valid: true, url });
    },
  );

  it.each([
    'http://www.syllabus-sync.app/',
    'https://localhost/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://169.254.169.254/',
    'https://www.syllabus-sync.app.evil.example/',
    'https://www.syllabus-sync.app@evil.example/',
    'https://user:pass@www.syllabus-sync.app/',
    'https://www.syllabus-sync.app:8443/',
    'https://www.syllabus-sync.app/api/health',
    'https://www.syllabus-sync.app/?url=localhost',
    'https://www.syllabus-sync.app/#section',
    'not a URL',
  ])('rejects unapproved destination %s', (url) => {
    expect(validateHeaderScanTarget(url).valid).toBe(false);
  });

  it('does not fetch an unapproved URL through the shared scanner', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await scanURLHeaders('https://127.0.0.1/');
    expect(result.grade).toBe('F');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
