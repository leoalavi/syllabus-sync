import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@/locales/en/translations.json';
import fa from '@/locales/fa/translations.json';
import {
  getTranslations,
  loadTranslations,
  SUPPORTED_LANGUAGES,
  type Language,
} from '@/lib/i18n/translations';

const MISSING_COMPANION_KEYS = [
  'campus',
  'campusSupportSubtitle',
  'campusSupportNotice',
  'mqNavCompanionTitle',
  'mqNavCompanionDesc',
  'mqNavCompanionStatus',
  'mqNavCompanionCta',
  'mqNavCompanionCtaAria',
  'syllaAssistant',
  'syllaCardDescription',
  'syllaOpen',
  'syllaOpenAria',
] as const satisfies readonly (keyof typeof en)[];

const NON_ENGLISH_LANGUAGES = SUPPORTED_LANGUAGES.filter(
  (lang): lang is Exclude<Language, 'en'> => lang !== 'en',
);

describe('translation fallback', () => {
  it.each(NON_ENGLISH_LANGUAGES)(
    'returns reviewed English text for the 12 companion keys missing from %s',
    async (lang) => {
      const loaded = await loadTranslations(lang);

      for (const key of MISSING_COMPANION_KEYS) {
        expect(loaded[key]).toBe(en[key]);
        expect(getTranslations(lang)[key]).toBe(en[key]);
        expect(loaded[key]).not.toBe(key);
      }
    },
  );

  it('keeps untranslated locales aligned with the documented 12-key fallback set', async () => {
    for (const lang of NON_ENGLISH_LANGUAGES) {
      const localePath = path.join(process.cwd(), 'locales', lang, 'translations.json');
      const locale = JSON.parse(readFileSync(localePath, 'utf8')) as Partial<typeof en>;
      const missingKeys = (Object.keys(en) as Array<keyof typeof en>).filter(
        (key) => !(key in locale),
      );
      expect(missingKeys).toEqual(MISSING_COMPANION_KEYS);
    }
  });

  it('preserves existing localized text', async () => {
    const loaded = await loadTranslations('fa');
    expect(loaded.signIn).toBe(fa.signIn);
  });
});
