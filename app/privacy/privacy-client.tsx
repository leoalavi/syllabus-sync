'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { APP_CONFIG, UNIVERSITY_CONFIG } from '@/lib/config';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
import StandaloneLanguageSelector from '@/components/layout/StandaloneLanguageSelector';

const SECTION_KEYS = [
  'privacy_s1_title',
  'privacy_s2_title',
  'privacy_s3_title',
  'privacy_s4_title',
  'privacy_s5_title',
  'privacy_s6_title',
  'privacy_s7_title',
  'privacy_s8_title',
  'privacy_s9_title',
  'privacy_s10_title',
  'privacy_s11_title',
  'privacy_s12_title',
  'privacy_s13_title',
  'privacy_s14_title',
] as const;

// Fix: stable table row keys — each row identified by its first cell's translation key
const TABLE_ROWS = [
  ['privacy_s6_table_r1_c1', 'privacy_s6_table_r1_c2', 'privacy_s6_table_r1_c3'],
  ['privacy_s6_table_r2_c1', 'privacy_s6_table_r2_c2', 'privacy_s6_table_r2_c3'],
  ['privacy_s6_table_r3_c1', 'privacy_s6_table_r3_c2', 'privacy_s6_table_r3_c3'],
  ['privacy_s6_table_r4_c1', 'privacy_s6_table_r4_c2', 'privacy_s6_table_r4_c3'],
] as const;

export default function PrivacyPolicyClient() {
  const { t } = useTypedTranslation();

  // Fix: encode mailto subject to avoid spaces breaking the URL in some email clients
  const privacyComplaintHref = `mailto:${APP_CONFIG.contactEmail}?subject=${encodeURIComponent(`Privacy Complaint - ${APP_CONFIG.name}`)}`;

  return (
    <div className="min-h-screen bg-mq-background">
      {/* Language Selector */}
      <StandaloneLanguageSelector />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-mq-red-deep via-mq-primary to-mq-red-deep border-b border-white/10">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 rounded-mq-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-all duration-200 hover:border-white/35 hover:bg-white/20 mb-6"
          >
            {/* Fix: added aria-hidden="true" to decorative icon */}
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t('privacy_back_to', { appName: APP_CONFIG.name })}
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-mq-warning font-semibold">
                {t('terms_legal_doc')}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                {t('privacy_title')}
              </h1>
              <p className="text-sm text-white/50">{t('privacy_last_updated')}</p>
            </div>
            <div className="hidden sm:flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/15">
              <Image src="/images/lock-icon.svg" alt="" width={28} height={28} aria-hidden="true" />
            </div>
          </div>

          {/* Accent bar */}
          <div className="mt-6 h-0.5 w-12 rounded-full bg-mq-warning" />
        </div>
      </div>

      <div>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
            {/* Sticky sidebar TOC — desktop only */}
            <aside className="hidden lg:block">
              <div className="sticky top-8 space-y-1">
                <p className="text-xs uppercase tracking-[0.15em] font-semibold text-mq-content-secondary mb-3">
                  {t('terms_sections')}
                </p>
                {SECTION_KEYS.map((key, i) => (
                  <a
                    key={key}
                    href={`#section-${i + 1}`}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm text-mq-content-secondary hover:text-mq-content hover:bg-mq-border/30 transition-colors group"
                  >
                    <span className="text-xs font-bold text-mq-primary/60 group-hover:text-mq-primary w-5 flex-shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate">{t(key as Parameters<typeof t>[0])}</span>
                  </a>
                ))}
              </div>
            </aside>

            {/* Main content */}
            <div className="space-y-8">
              {/* 1. Purpose and Scope */}
              <section
                id="section-1"
                aria-labelledby="privacy-heading-1"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-1"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    1
                  </span>
                  {t('privacy_s1_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s1_p1', { appName: APP_CONFIG.name })}
                </p>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s1_p2', {
                    appName: APP_CONFIG.name,
                    uniName: UNIVERSITY_CONFIG.name,
                  })}
                </p>
              </section>

              {/* 2. What Personal Information We Collect */}
              <section
                id="section-2"
                aria-labelledby="privacy-heading-2"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-2"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    2
                  </span>
                  {t('privacy_s2_title')}
                </h2>

                <h3 className="text-sm font-semibold text-mq-content">{t('privacy_s2_a_title')}</h3>
                <ul className="space-y-1.5">
                  {(
                    [
                      'privacy_s2_a_li1',
                      'privacy_s2_a_li2',
                      'privacy_s2_a_li3',
                      'privacy_s2_a_li4',
                      'privacy_s2_a_li5',
                      'privacy_s2_a_li6',
                    ] as const
                  ).map((k) => (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-sm text-mq-content-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                      {t(k)}
                    </li>
                  ))}
                </ul>

                <h3 className="text-sm font-semibold text-mq-content">{t('privacy_s2_b_title')}</h3>
                <ul className="space-y-1.5">
                  {(['privacy_s2_b_li1', 'privacy_s2_b_li2'] as const).map((k) => (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-sm text-mq-content-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                      {t(k)}
                    </li>
                  ))}
                </ul>

                <h3 className="text-sm font-semibold text-mq-content">{t('privacy_s2_c_title')}</h3>
                <ul className="space-y-1.5">
                  {(
                    [
                      'privacy_s2_c_li1',
                      'privacy_s2_c_li2',
                      'privacy_s2_c_li3',
                      'privacy_s2_c_li4',
                    ] as const
                  ).map((k) => (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-sm text-mq-content-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                      {t(k)}
                    </li>
                  ))}
                </ul>

                <h3 className="text-sm font-semibold text-mq-content">{t('privacy_s2_d_title')}</h3>
                <ul className="space-y-1.5">
                  {(['privacy_s2_d_li1', 'privacy_s2_d_li2'] as const).map((k) => (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-sm text-mq-content-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                      {t(k)}
                    </li>
                  ))}
                </ul>

                <h3 className="text-sm font-semibold text-mq-content">{t('privacy_s2_e_title')}</h3>
                <ul className="space-y-1.5">
                  {(['privacy_s2_e_li1', 'privacy_s2_e_li2', 'privacy_s2_e_li3'] as const).map(
                    (k) => (
                      <li
                        key={k}
                        className="flex items-start gap-2 text-sm text-mq-content-secondary"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                        {t(k)}
                      </li>
                    ),
                  )}
                </ul>

                <h3 className="text-sm font-semibold text-mq-content">{t('privacy_s2_f_title')}</h3>
                <ul className="space-y-1.5">
                  {(['privacy_s2_f_li1', 'privacy_s2_f_li2', 'privacy_s2_f_li3'] as const).map(
                    (k) => (
                      <li
                        key={k}
                        className="flex items-start gap-2 text-sm text-mq-content-secondary"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                        {t(k)}
                      </li>
                    ),
                  )}
                </ul>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s2_footer')}
                </p>
              </section>

              {/* 3. How We Collect */}
              <section
                id="section-3"
                aria-labelledby="privacy-heading-3"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-3"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    3
                  </span>
                  {t('privacy_s3_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s3_p1')}
                </p>
                <ul className="space-y-1.5">
                  {(['privacy_s3_li1', 'privacy_s3_li2'] as const).map((k) => (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-sm text-mq-content-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                      {t(k)}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s3_footer')}
                </p>
              </section>

              {/* 4. Why We Collect and How We Use */}
              <section
                id="section-4"
                aria-labelledby="privacy-heading-4"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-4"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    4
                  </span>
                  {t('privacy_s4_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s4_p1')}
                </p>
                <ul className="space-y-1.5">
                  {(
                    [
                      'privacy_s4_li1',
                      'privacy_s4_li2',
                      'privacy_s4_li3',
                      'privacy_s4_li4',
                      'privacy_s4_li5',
                      'privacy_s4_li6',
                    ] as const
                  ).map((k) => (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-sm text-mq-content-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                      {t(k)}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s4_footer')}
                </p>
              </section>

              {/* 5. Disclosure */}
              <section
                id="section-5"
                aria-labelledby="privacy-heading-5"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-5"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    5
                  </span>
                  {t('privacy_s5_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s5_p1')}
                </p>
                <ul className="space-y-1.5">
                  {(['privacy_s5_li1', 'privacy_s5_li2', 'privacy_s5_li3'] as const).map((k) => (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-sm text-mq-content-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                      {t(k)}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s5_footer')}
                </p>
              </section>

              {/* 6. Overseas Disclosure and Third-Party Services */}
              <section
                id="section-6"
                aria-labelledby="privacy-heading-6"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-6"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    6
                  </span>
                  {t('privacy_s6_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s6_p1')}
                </p>

                <div className="overflow-x-auto rounded-xl border border-mq-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-mq-card-background border-b border-mq-border">
                        <th className="text-left px-4 py-3 font-semibold text-mq-content text-xs uppercase tracking-wider">
                          {t('privacy_s6_table_h1')}
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-mq-content text-xs uppercase tracking-wider">
                          {t('privacy_s6_table_h2')}
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-mq-content text-xs uppercase tracking-wider">
                          {t('privacy_s6_table_h3')}
                        </th>
                      </tr>
                    </thead>
                    {/* Fix: use row[0] (stable translation key) instead of array index as key */}
                    <tbody className="divide-y divide-mq-border">
                      {TABLE_ROWS.map((row) => (
                        <tr
                          key={row[0]}
                          className="hover:bg-mq-card-background/50 transition-colors"
                        >
                          {row.map((cell) => (
                            <td key={cell} className="px-4 py-3 text-mq-content-secondary">
                              {t(cell as Parameters<typeof t>[0])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 7. Security */}
              <section
                id="section-7"
                aria-labelledby="privacy-heading-7"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-7"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    7
                  </span>
                  {t('privacy_s7_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s7_p1')}
                </p>
                <ul className="space-y-1.5">
                  {(
                    [
                      'privacy_s7_li1',
                      'privacy_s7_li2',
                      'privacy_s7_li3',
                      'privacy_s7_li4',
                      'privacy_s7_li5',
                      'privacy_s7_li6',
                      'privacy_s7_li7',
                      'privacy_s7_li8',
                      'privacy_s7_li9',
                    ] as const
                  ).map((k) => (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-sm text-mq-content-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                      {t(k)}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s7_footer')}
                </p>
              </section>

              {/* 8. Data Retention */}
              <section
                id="section-8"
                aria-labelledby="privacy-heading-8"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-8"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    8
                  </span>
                  {t('privacy_s8_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s8_p1')}
                </p>
                <ul className="space-y-1.5">
                  {(
                    [
                      'privacy_s8_li1',
                      'privacy_s8_li2',
                      'privacy_s8_li3',
                      'privacy_s8_li4',
                    ] as const
                  ).map((k) => (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-sm text-mq-content-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                      {t(k)}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s8_footer')}
                </p>
              </section>

              {/* 9. Cookies and Analytics */}
              <section
                id="section-9"
                aria-labelledby="privacy-heading-9"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-9"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    9
                  </span>
                  {t('privacy_s9_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s9_p1')}
                </p>
                <ul className="space-y-1.5">
                  {(['privacy_s9_li1', 'privacy_s9_li2', 'privacy_s9_li3'] as const).map((k) => (
                    <li
                      key={k}
                      className="flex items-start gap-2 text-sm text-mq-content-secondary"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                      {t(k)}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s9_footer')}
                </p>
              </section>

              {/* 10. Access and Correction */}
              <section
                id="section-10"
                aria-labelledby="privacy-heading-10"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-10"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    10
                  </span>
                  {t('privacy_s10_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s10_p1')}
                </p>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s10_p2_part1')}{' '}
                  <Link href="/settings" className="text-mq-primary hover:underline font-medium">
                    {t('settings')}
                  </Link>{' '}
                  {t('privacy_s10_p2_part2')}{' '}
                  <Link
                    href="/manage-profiles"
                    className="text-mq-primary hover:underline font-medium"
                  >
                    {t('manageProfiles')}
                  </Link>
                  {t('privacy_s10_p2_part3')}{' '}
                  <a
                    href={`mailto:${APP_CONFIG.contactEmail}`}
                    className="text-mq-primary hover:underline font-medium"
                  >
                    {APP_CONFIG.contactEmail}
                  </a>
                  {t('privacy_s10_p2_part4')}
                </p>
              </section>

              {/* 11. Complaints */}
              <section
                id="section-11"
                aria-labelledby="privacy-heading-11"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-11"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    11
                  </span>
                  {t('privacy_s11_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s11_p1_part1')}{' '}
                  {/* Fix: subject is now encodeURIComponent-encoded via privacyComplaintHref */}
                  <a
                    href={privacyComplaintHref}
                    className="text-mq-primary hover:underline font-medium"
                  >
                    {APP_CONFIG.contactEmail}
                  </a>{' '}
                  {t('privacy_s11_p1_part2')}
                </p>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s11_p2_part1')}{' '}
                  <a
                    href="https://www.oaic.gov.au/privacy/privacy-complaints"
                    className="text-mq-primary hover:underline font-medium"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('privacy_s11_p2_link')}
                  </a>
                  .
                </p>
              </section>

              {/* 12. Notifiable Data Breaches */}
              <section
                id="section-12"
                aria-labelledby="privacy-heading-12"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-12"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    12
                  </span>
                  {t('privacy_s12_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s12_p1_part1')}{' '}
                  <a
                    href="https://www.oaic.gov.au/privacy/notifiable-data-breaches/about-the-notifiable-data-breaches-scheme"
                    className="text-mq-primary hover:underline font-medium"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('privacy_s12_p1_link')}
                  </a>
                  .
                </p>
              </section>

              {/* 13. Children and Education */}
              <section
                id="section-13"
                aria-labelledby="privacy-heading-13"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-13"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    13
                  </span>
                  {t('privacy_s13_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s13_p1', {
                    appName: APP_CONFIG.name,
                    uniName: UNIVERSITY_CONFIG.name,
                  })}
                </p>
              </section>

              {/* 14. Changes */}
              <section
                id="section-14"
                aria-labelledby="privacy-heading-14"
                className="scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
              >
                <h2
                  id="privacy-heading-14"
                  className="text-lg font-bold text-mq-content flex items-center gap-3"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                    14
                  </span>
                  {t('privacy_s14_title')}
                </h2>
                <p className="text-sm text-mq-content-secondary leading-relaxed">
                  {t('privacy_s14_p1')}
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
