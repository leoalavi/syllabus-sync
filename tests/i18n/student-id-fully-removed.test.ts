/**
 * Guard for BA-0050 — completes the student ID removal.
 *
 * BA-0050 stopped collecting `profiles.student_id`, nulled the 16 stored values
 * and dropped the column. The removal was reported as complete. It was not: two
 * translation keys survived in every one of the 35 locale files,
 *
 *   validation.studentIdRequired  -> "Student ID is required"
 *   enterStudentIdDesc            -> "Enter your 8-digit student ID number"
 *
 * 70 orphaned strings in total, referenced by no code. They leak no data, but
 * they are the visible residue of a field this project no longer collects, and a
 * future contributor reading the locale files would reasonably conclude the field
 * still exists and wire it back up.
 *
 * This test fails on the state as shipped, which is the point: the earlier
 * "complete" claim rested on the column being gone rather than on a search for
 * what still mentioned it.
 */

import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const LOCALES_DIR = path.resolve(ROOT, 'locales');

async function localeDirs(): Promise<string[]> {
  const entries = await readdir(LOCALES_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function translations(locale: string): Promise<Record<string, unknown>> {
  const raw = await readFile(path.join(LOCALES_DIR, locale, 'translations.json'), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('BA-0050: nothing should still reference a student ID', () => {
  it('covers all 35 locales, so a missed locale fails rather than passes silently', async () => {
    // Guards the guard: if this suite ever runs against an empty directory it
    // would report success while checking nothing.
    expect((await localeDirs()).length).toBe(35);
  });

  it('has no student-ID translation key in any locale', async () => {
    const offenders: string[] = [];

    for (const locale of await localeDirs()) {
      const keys = Object.keys(await translations(locale));
      for (const key of keys) {
        if (/studentid/i.test(key)) offenders.push(`${locale}: ${key}`);
      }
    }

    expect(offenders, `orphaned student-ID keys remain:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('does not drift from English on any key it shares with English', async () => {
    // Guards over-correction: deleting the student-ID keys from some locales but
    // not others would break the fallback chain while still passing the check
    // above for the locales that were done.
    //
    // Scoped to keys English and the locale have in common, deliberately. Full
    // key-for-key parity does NOT hold in this repo: 8 keys added with the MQ
    // Navigation feature on 2026-06-02 (`campus`, `campusSupport*`,
    // `mqNavCompanion*`) exist only in `en`, so all 34 other locales fall back to
    // English for that card. That predates this change and belongs to a different
    // owner, so it is reported rather than silently absorbed into this assertion.
    const english = new Set(Object.keys(await translations('en')));
    const KNOWN_ENGLISH_ONLY = new Set([
      'campus',
      'campusSupportSubtitle',
      'campusSupportNotice',
      'mqNavCompanionTitle',
      'mqNavCompanionDesc',
      'mqNavCompanionStatus',
      'mqNavCompanionCta',
      'mqNavCompanionCtaAria',
      // Added with the Sylla assistant card in October 2026; also English-only.
      'syllaAssistant',
      'syllaCardDescription',
      'syllaOpen',
      'syllaOpenAria',
      // Added with the Sylla panel and Campus Navigation handoff in November
      // 2026; English-only until translated.
      'campusNavHandoffTitle',
      'campusNavHandoffDesc',
      'campusNavAppComingSoon',
      'campusNavOpenWeb',
      'campusNavOrUseHere',
      'syllaAsk',
      'syllaNewChat',
      'syllaClose',
    ]);

    for (const locale of await localeDirs()) {
      if (locale === 'en') continue;
      const keys = new Set(Object.keys(await translations(locale)));
      const missing = [...english].filter((k) => !keys.has(k) && !KNOWN_ENGLISH_ONLY.has(k));
      const extra = [...keys].filter((k) => !english.has(k));
      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
    }
  });

  it('still holds the known English-only set at exactly 20 keys', async () => {
    // If this number moves, the allowance above has started hiding new drift
    // rather than documenting a known one.
    const english = new Set(Object.keys(await translations('en')));
    const other = new Set(Object.keys(await translations('ar')));
    expect([...english].filter((k) => !other.has(k)).sort()).toEqual([
      'campus',
      'campusNavAppComingSoon',
      'campusNavHandoffDesc',
      'campusNavHandoffTitle',
      'campusNavOpenWeb',
      'campusNavOrUseHere',
      'campusSupportNotice',
      'campusSupportSubtitle',
      'mqNavCompanionCta',
      'mqNavCompanionCtaAria',
      'mqNavCompanionDesc',
      'mqNavCompanionStatus',
      'mqNavCompanionTitle',
      'syllaAsk',
      'syllaAssistant',
      'syllaCardDescription',
      'syllaClose',
      'syllaNewChat',
      'syllaOpen',
      'syllaOpenAria',
    ]);
  });
});
