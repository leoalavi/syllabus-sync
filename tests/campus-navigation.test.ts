import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildCampusNavAppLink,
  buildCampusNavUniversalLink,
  buildingTarget,
} from '@/lib/campus-navigation/deep-link';
import { detectPlatform, canAttemptAppHandoff } from '@/lib/campus-navigation/platform';
import {
  CAMPUS_NAV_ANDROID_STORE_URL,
  CAMPUS_NAV_IOS_STORE_URL,
  isIosStoreAvailable,
} from '@/lib/campus-navigation/config';

describe('Campus Navigation deep links', () => {
  it('builds the custom-scheme link the app registers', () => {
    expect(buildCampusNavAppLink(buildingTarget('17WW'))).toBe(
      'mqnav://open?destination=17WW',
    );
  });

  it('builds the shareable https link', () => {
    expect(buildCampusNavUniversalLink(buildingTarget('14SCO'))).toBe(
      'https://mqnavigation.app/open?destination=14SCO',
    );
  });

  it('percent-encodes ids and queries that would break the URL', () => {
    const link = buildCampusNavAppLink({ kind: 'search', query: 'law & media' });
    expect(link).toContain('q=law+%26+media');
    expect(() => new URL(link)).not.toThrow();
  });

  it('supports coordinate targets', () => {
    expect(buildCampusNavAppLink({ kind: 'coords', lat: -33.7738, lng: 151.1126 })).toBe(
      'mqnav://open?lat=-33.7738&lng=151.1126',
    );
  });

  // Room is intentionally not encoded: it is not part of the app's contract and
  // folding it into the id would produce an id the app cannot resolve.
  it('never smuggles a room into the destination id', () => {
    expect(buildCampusNavAppLink(buildingTarget('17WW', 'G25'))).toBe(
      'mqnav://open?destination=17WW',
    );
  });
});

describe('store links', () => {
  it('always has an Android destination', () => {
    expect(CAMPUS_NAV_ANDROID_STORE_URL).toMatch(/^https:\/\/play\.google\.com\//);
  });

  // The App Store listing does not exist yet. A guessed URL would 404, so the
  // config must stay null and the UI must degrade instead.
  it('does not invent an iOS URL before the listing exists', () => {
    if (CAMPUS_NAV_IOS_STORE_URL === null) {
      expect(isIosStoreAvailable()).toBe(false);
    } else {
      expect(CAMPUS_NAV_IOS_STORE_URL).toMatch(/^https:\/\/apps\.apple\.com\//);
      expect(isIosStoreAvailable()).toBe(true);
    }
  });

  // Campus Navigation has no web build. No config value may be a browsable
  // http(s) URL other than the two store listings, or we would be shipping a
  // "use it in your browser" escape hatch that leads nowhere.
  it('exposes no browsable web-app fallback', async () => {
    const config = await import('@/lib/campus-navigation/config');
    const httpUrls = Object.values(config)
      .filter((v): v is string => typeof v === 'string')
      .filter((v) => /^https?:\/\//.test(v));
    for (const url of httpUrls) {
      expect(url).toMatch(/^https:\/\/(play\.google\.com|apps\.apple\.com)\//);
    }
  });
});

describe('platform detection', () => {
  const ua = (value: string) =>
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(value);
  afterEach(() => vi.restoreAllMocks());

  it('detects Android', () => {
    ua('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36');
    expect(detectPlatform()).toBe('android');
  });

  it('detects iPhone', () => {
    ua('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    expect(detectPlatform()).toBe('ios');
  });

  it('treats desktop as unable to hand off', () => {
    ua('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    expect(detectPlatform()).toBe('desktop');
    expect(canAttemptAppHandoff('desktop')).toBe(false);
  });

  it('allows a handoff attempt on both mobile platforms', () => {
    expect(canAttemptAppHandoff('ios')).toBe(true);
    expect(canAttemptAppHandoff('android')).toBe(true);
  });
});

describe('handoff', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it('reports unsupported-platform on desktop without navigating', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    );
    const { openInCampusNav } = await import('@/lib/campus-navigation/handoff');
    await expect(openInCampusNav(buildingTarget('17WW'))).resolves.toBe(
      'unsupported-platform',
    );
  });

  it('concludes not-installed when nothing handles the scheme', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
    );
    const { openInCampusNav } = await import('@/lib/campus-navigation/handoff');
    const result = await openInCampusNav(buildingTarget('17WW'));
    expect(result).toBe('not-installed');
  }, 8000);

  it('concludes opened when the page is backgrounded', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    );
    const { openInCampusNav } = await import('@/lib/campus-navigation/handoff');
    const pending = openInCampusNav(buildingTarget('17WW'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await expect(pending).resolves.toBe('opened');
  });
});
