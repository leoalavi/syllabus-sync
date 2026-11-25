import { describe, expect, it } from 'vitest';
import { buildCampusNavWebUrl } from '@/lib/campus-navigation/config';

describe('buildCampusNavWebUrl', () => {
  const base = 'https://nav.example.app';

  it('opens the web app on the building via the /open contract', () => {
    expect(buildCampusNavWebUrl('c5c', base)).toBe(`${base}/#/open?destination=C5C`);
  });

  it('encodes ids and falls back to the map without one', () => {
    expect(buildCampusNavWebUrl('a b&c', base)).toBe(`${base}/#/open?destination=A%20B%26C`);
    expect(buildCampusNavWebUrl('  ', base)).toBe(`${base}/#/map`);
  });

  it('returns null when no web app is configured', () => {
    expect(buildCampusNavWebUrl('C5C', null)).toBeNull();
  });
});
