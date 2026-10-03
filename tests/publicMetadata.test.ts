import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { APP_CONFIG } from '@/lib/config';

describe('public metadata routes', () => {
  it('uses the Syllabus Sync origin for robots and public sitemap entries', () => {
    const siteOrigin = new URL(APP_CONFIG.url).origin;
    expect(robots().sitemap).toBe(`${siteOrigin}/sitemap.xml`);

    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual(
      ['/about', '/contact', '/terms', '/privacy'].map((path) => `${siteOrigin}${path}`),
    );
  });
});
