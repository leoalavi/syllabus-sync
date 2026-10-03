/**
 * Config, Logger, Gamification Utils, and Types Tests
 * Tests for pure data/functions that add branch and line coverage
 */
import { describe, it, expect, vi } from 'vitest';

describe('lib/config', () => {
  it('exports university config', async () => {
    const { UNIVERSITY_CONFIG } = await import('@/lib/config');
    expect(UNIVERSITY_CONFIG.name).toBe('Macquarie University');
    expect(UNIVERSITY_CONFIG.website).toBeDefined();
  });

  it('exports app config', async () => {
    const { APP_CONFIG } = await import('@/lib/config');
    expect(APP_CONFIG.name).toBe('Syllabus Sync');
    expect(APP_CONFIG.version).toBeDefined();
  });

  it('exports brand colors', async () => {
    const { BRAND_COLORS } = await import('@/lib/config');
    expect(BRAND_COLORS.primary).toBe('#A6192E');
    expect(BRAND_COLORS.secondary).toBe('#002A45');
    expect(BRAND_COLORS.accent).toBe('#FFB81C');
  });

  it('exports unit colors array', async () => {
    const { UNIT_COLORS } = await import('@/lib/config');
    expect(UNIT_COLORS.length).toBeGreaterThan(0);
    expect(UNIT_COLORS[0]).toHaveProperty('name');
    expect(UNIT_COLORS[0]).toHaveProperty('value');
  });

  it('exports feature flags', async () => {
    const { FEATURES } = await import('@/lib/config');
    expect(typeof FEATURES.mapEnabled).toBe('boolean');
    expect(typeof FEATURES.calendarEnabled).toBe('boolean');
  });

  it('exports demo user', async () => {
    const { DEMO_USER } = await import('@/lib/config');
    expect(DEMO_USER.name).toBe('Student');
  });

  it('exports social links', async () => {
    const { SOCIAL_LINKS } = await import('@/lib/config');
    expect(SOCIAL_LINKS.linkedin).toBeDefined();
  });

  it('exports external links', async () => {
    const { EXTERNAL_LINKS } = await import('@/lib/config');
    expect(EXTERNAL_LINKS.privacy).toBe('/privacy');
    expect(EXTERNAL_LINKS.terms).toBe('/terms');
    expect(EXTERNAL_LINKS.projectInfo).toBe('https://info.syllabus-sync.app');
  });
});

describe('lib/logger', () => {
  it('logger.info logs without error', async () => {
    const { logger } = await import('@/lib/logger');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('Test info message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logger.warn logs without error', async () => {
    const { logger } = await import('@/lib/logger');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.warn('Test warning');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logger.error logs with error object', async () => {
    const { logger } = await import('@/lib/logger');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.error('Test error', new Error('boom'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logger.info with extra args', async () => {
    const { logger } = await import('@/lib/logger');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('msg', 'extra1', 'extra2');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('lib/utils/gamification', () => {
  it('returns correct level title keys', async () => {
    const { getLevelTitleKey } = await import('@/lib/utils/gamification');

    // Level 1-10 → gamification_level_N
    expect(getLevelTitleKey(1)).toBe('gamification_level_1');
    expect(getLevelTitleKey(5)).toBe('gamification_level_5');
    expect(getLevelTitleKey(10)).toBe('gamification_level_10');

    // Level ranges
    expect(getLevelTitleKey(15)).toBe('gamification_level_veteran');
    expect(getLevelTitleKey(25)).toBe('gamification_level_expert');
    expect(getLevelTitleKey(40)).toBe('gamification_level_legend');
    expect(getLevelTitleKey(60)).toBe('gamification_level_titan');
    expect(getLevelTitleKey(80)).toBe('gamification_level_grand');
  });
});

describe('lib/types - getLevelTier', () => {
  it('returns correct tiers for different levels', async () => {
    const { getLevelTier } = await import('@/lib/types');

    expect(getLevelTier(1)).toBe('bronze');
    expect(getLevelTier(5)).toBe('bronze');
    expect(getLevelTier(6)).toBe('silver');
    expect(getLevelTier(10)).toBe('silver');
    expect(getLevelTier(11)).toBe('gold');
    expect(getLevelTier(20)).toBe('gold');
    expect(getLevelTier(21)).toBe('platinum');
    expect(getLevelTier(35)).toBe('platinum');
    expect(getLevelTier(36)).toBe('diamond');
    expect(getLevelTier(50)).toBe('diamond');
    expect(getLevelTier(51)).toBe('master');
    expect(getLevelTier(100)).toBe('master');
  });
});

describe('lib/types - DEFAULT_GAMIFICATION_SETTINGS', () => {
  it('has correct default values', async () => {
    const { DEFAULT_GAMIFICATION_SETTINGS } = await import('@/lib/types');

    expect(DEFAULT_GAMIFICATION_SETTINGS.showXPNotifications).toBe(true);
    expect(DEFAULT_GAMIFICATION_SETTINGS.showLevelUpNotifications).toBe(true);
    expect(DEFAULT_GAMIFICATION_SETTINGS.showStreakReminders).toBe(true);
    expect(DEFAULT_GAMIFICATION_SETTINGS.displayOnProfile).toBe(true);
  });
});
