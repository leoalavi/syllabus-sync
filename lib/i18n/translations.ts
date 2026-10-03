// lib/i18n/translations.ts
// Lazy-loaded translations system
// Only the current language is loaded to reduce bundle size

import en from '@/locales/en/translations.json';
import { logger } from '@/lib/logger';

// English is always loaded (default fallback)
export type TranslationKey = keyof typeof en;
export type Language =
  | 'en'
  | 'es'
  | 'fa'
  | 'zh'
  | 'ar'
  | 'hi'
  | 'ko'
  | 'ja'
  | 'ur'
  | 'th'
  | 'vi'
  | 'ru'
  | 'ta'
  | 'bn'
  | 'id'
  | 'ms'
  | 'it'
  | 'fr'
  | 'he'
  | 'de'
  | 'da'
  | 'sv'
  | 'tr'
  | 'pt'
  | 'nl'
  | 'pl'
  | 'no'
  | 'fi'
  | 'el'
  | 'ro'
  | 'cs'
  | 'hu'
  | 'uk'
  | 'ne'
  | 'si';

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  fa: 'فارسی',
  zh: '中文',
  ar: 'العربية',
  hi: 'हिन्दी',
  ko: '한국어',
  ja: '日本語',
  ur: 'اردو',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  ru: 'Русский',
  ta: 'தமிழ்',
  bn: 'বাংলা',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  it: 'Italiano',
  fr: 'Français',
  he: 'עברית',
  de: 'Deutsch',
  da: 'Dansk',
  sv: 'Svenska',
  tr: 'Türkçe',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  no: 'Norsk',
  fi: 'Suomi',
  el: 'Ελληνικά',
  ro: 'Română',
  cs: 'Čeština',
  hu: 'Magyar',
  uk: 'Українська',
  ne: 'नेपाली',
  si: 'සිංහල',
};

export const SUPPORTED_LANGUAGES: Language[] = [
  'en',
  'de',
  'fr',
  'es',
  'it',
  'pt',
  'nl',
  'da',
  'sv',
  'no',
  'fi',
  'tr',
  'pl',
  'el',
  'ro',
  'cs',
  'hu',
  'uk',
  'ne',
  'si',
  'zh',
  'ja',
  'ko',
  'vi',
  'hi',
  'ur',
  'bn',
  'ta',
  'th',
  'id',
  'ms',
  'fa',
  'ru',
  'ar',
  'he',
];

// Cached translations are complete; missing localized values use reviewed English copy.
type TranslationData = typeof en;

// Cache for loaded translations
const translationsCache: Map<Language, TranslationData> = new Map([['en', en]]);

/**
 * Lazy load translations for a specific language
 * Uses dynamic imports to reduce initial bundle size
 */
export async function loadTranslations(lang: Language): Promise<TranslationData> {
  // Return cached translations if available
  const cached = translationsCache.get(lang);
  if (cached) {
    return cached;
  }

  // Load translations dynamically
  try {
    let translations: Partial<TranslationData>;

    switch (lang) {
      case 'es':
        translations = (await import('@/locales/es/translations.json')).default;
        break;
      case 'fa':
        translations = (await import('@/locales/fa/translations.json')).default;
        break;
      case 'zh':
        translations = (await import('@/locales/zh/translations.json')).default;
        break;
      case 'ar':
        translations = (await import('@/locales/ar/translations.json')).default;
        break;
      case 'hi':
        translations = (await import('@/locales/hi/translations.json')).default;
        break;
      case 'ko':
        translations = (await import('@/locales/ko/translations.json')).default;
        break;
      case 'ja':
        translations = (await import('@/locales/ja/translations.json')).default;
        break;
      case 'ur':
        translations = (await import('@/locales/ur/translations.json')).default;
        break;
      case 'th':
        translations = (await import('@/locales/th/translations.json')).default;
        break;
      case 'vi':
        translations = (await import('@/locales/vi/translations.json')).default;
        break;
      case 'ru':
        translations = (await import('@/locales/ru/translations.json')).default;
        break;
      case 'ta':
        translations = (await import('@/locales/ta/translations.json')).default;
        break;
      case 'bn':
        translations = (await import('@/locales/bn/translations.json')).default;
        break;
      case 'id':
        translations = (await import('@/locales/id/translations.json')).default;
        break;
      case 'ms':
        translations = (await import('@/locales/ms/translations.json')).default;
        break;
      case 'it':
        translations = (await import('@/locales/it/translations.json')).default;
        break;
      case 'fr':
        translations = (await import('@/locales/fr/translations.json')).default;
        break;
      case 'he':
        translations = (await import('@/locales/he/translations.json')).default;
        break;
      case 'de':
        translations = (await import('@/locales/de/translations.json')).default;
        break;
      case 'da':
        translations = (await import('@/locales/da/translations.json')).default;
        break;
      case 'sv':
        translations = (await import('@/locales/sv/translations.json')).default;
        break;
      case 'tr':
        translations = (await import('@/locales/tr/translations.json')).default;
        break;
      case 'pt':
        translations = (await import('@/locales/pt/translations.json')).default;
        break;
      case 'nl':
        translations = (await import('@/locales/nl/translations.json')).default;
        break;
      case 'pl':
        translations = (await import('@/locales/pl/translations.json')).default;
        break;
      case 'no':
        translations = (await import('@/locales/no/translations.json')).default;
        break;
      case 'fi':
        translations = (await import('@/locales/fi/translations.json')).default;
        break;
      case 'el':
        translations = (await import('@/locales/el/translations.json')).default;
        break;
      case 'ro':
        translations = (await import('@/locales/ro/translations.json')).default;
        break;
      case 'cs':
        translations = (await import('@/locales/cs/translations.json')).default;
        break;
      case 'hu':
        translations = (await import('@/locales/hu/translations.json')).default;
        break;
      case 'uk':
        translations = (await import('@/locales/uk/translations.json')).default;
        break;
      case 'ne':
        translations = (await import('@/locales/ne/translations.json')).default;
        break;
      case 'si':
        translations = (await import('@/locales/si/translations.json')).default;
        break;
      default:
        translations = en;
    }

    // Keep direct consumers and the translation hook on the same fallback path.
    const completeTranslations = { ...en, ...translations };
    translationsCache.set(lang, completeTranslations);
    return completeTranslations;
  } catch (error) {
    logger.error(`Failed to load translations for ${lang}:`, error);
    // Fall back to English on error
    return en;
  }
}

/**
 * Get cached translations synchronously
 * Returns English as fallback if the language isn't loaded yet
 */
export function getTranslations(lang: Language): TranslationData {
  return translationsCache.get(lang) || en;
}

/**
 * Check if translations for a language are loaded
 */
export function isLanguageLoaded(lang: Language): boolean {
  return translationsCache.has(lang);
}

// Legacy export for backwards compatibility
// This allows existing code to work while we migrate
export const translations: Record<Language, TranslationData> = new Proxy(
  {} as Record<Language, TranslationData>,
  {
    get(_, prop: Language) {
      return translationsCache.get(prop) || en;
    },
  },
);
