import { describe, expect, it } from 'vitest';
import { buildCampusNavWebUrl } from '@/lib/campus-navigation/config';

describe('buildCampusNavWebUrl', () => {
  const base = 'https://navigation.example.app';

  it('shows the building location via the /open contract', () => {
    expect(buildCampusNavWebUrl('c5c', 'location', base)).toBe(`${base}/#/open?destination=C5C`);
  });

  it('opens walking directions with action=directions', () => {
    expect(buildCampusNavWebUrl('c5c', 'directions', base)).toBe(
      `${base}/#/open?destination=C5C&action=directions`,
    );
  });

  it('encodes ids and falls back to the map without one', () => {
    expect(buildCampusNavWebUrl('a b&c', 'location', base)).toBe(
      `${base}/#/open?destination=A%20B%26C`,
    );
    expect(buildCampusNavWebUrl('  ', 'directions', base)).toBe(`${base}/#/map`);
  });

  it('returns null when no web app is configured', () => {
    expect(buildCampusNavWebUrl('C5C', 'location', null)).toBeNull();
  });
});
