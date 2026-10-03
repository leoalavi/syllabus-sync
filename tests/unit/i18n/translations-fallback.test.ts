import { describe, expect, it } from 'vitest';
import en from '@/locales/en/translations.json';
import fa from '@/locales/fa/translations.json';
import { getTranslations, loadTranslations } from '@/lib/i18n/translations';

describe('translation fallback', () => {
  it('returns reviewed English text for keys missing from a loaded locale', async () => {
    const loaded = await loadTranslations('fa');
    expect(loaded.campusSupportSubtitle).toBe(en.campusSupportSubtitle);
    expect(getTranslations('fa').campusSupportSubtitle).toBe(en.campusSupportSubtitle);
    expect(loaded.campusSupportSubtitle).not.toBe('campusSupportSubtitle');
  });

  it('preserves existing localized text', async () => {
    const loaded = await loadTranslations('fa');
    expect(loaded.signIn).toBe(fa.signIn);
  });
});
