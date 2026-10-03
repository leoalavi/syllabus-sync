'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { APP_CONFIG, UNIVERSITY_CONFIG } from '@/lib/config';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
import StandaloneLanguageSelector from '@/components/layout/StandaloneLanguageSelector';
import type { TranslationKey } from '@/lib/i18n/translations';

type ParagraphBlock = {
  type: 'paragraph';
  key: TranslationKey;
  vars?: Record<string, string>;
};

type ListBlock = {
  type: 'list';
  keys: TranslationKey[];
};

type ContactBlock = {
  type: 'contact';
  key: TranslationKey;
};

type TermsBlock = ParagraphBlock | ListBlock | ContactBlock;

type TermsSection = {
  titleKey: TranslationKey;
  blocks: TermsBlock[];
};

const TERMS_SECTIONS: TermsSection[] = [
  {
    titleKey: 'terms_s1_title',
    blocks: [{ type: 'paragraph', key: 'terms_s1_p1', vars: { appName: APP_CONFIG.name } }],
  },
  {
    titleKey: 'terms_s2_title',
    blocks: [
      {
        type: 'paragraph',
        key: 'terms_s2_p1',
        vars: {
          appName: APP_CONFIG.name,
          uniName: UNIVERSITY_CONFIG.name,
        },
      },
    ],
  },
  {
    titleKey: 'terms_s3_title',
    blocks: [{ type: 'paragraph', key: 'terms_s3_p1' }],
  },
  {
    titleKey: 'terms_s4_title',
    blocks: [
      { type: 'paragraph', key: 'terms_s4_p1' },
      {
        type: 'list',
        keys: ['terms_s4_li1', 'terms_s4_li2', 'terms_s4_li3', 'terms_s4_li4', 'terms_s4_li5'],
      },
    ],
  },
  {
    titleKey: 'terms_s5_title',
    blocks: [{ type: 'paragraph', key: 'terms_s5_p1', vars: { appName: APP_CONFIG.name } }],
  },
  {
    titleKey: 'terms_s6_title',
    blocks: [{ type: 'paragraph', key: 'terms_s6_p1', vars: { appName: APP_CONFIG.name } }],
  },
  {
    titleKey: 'terms_s7_title',
    blocks: [{ type: 'paragraph', key: 'terms_s7_p1' }],
  },
  {
    titleKey: 'terms_s8_title',
    blocks: [
      {
        type: 'paragraph',
        key: 'terms_s8_p1',
        vars: { appNameCaps: APP_CONFIG.name.toUpperCase() },
      },
    ],
  },
  {
    titleKey: 'terms_s9_title',
    blocks: [{ type: 'paragraph', key: 'terms_s9_p1' }],
  },
  {
    titleKey: 'terms_s10_title',
    blocks: [{ type: 'contact', key: 'terms_s10_p1' }],
  },
];

export default function TermsClient() {
  const { t } = useTypedTranslation();

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
            {t('terms_back_to', { appName: APP_CONFIG.name })}
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-mq-warning font-semibold">
                {t('terms_legal_doc')}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                {t('terms_title')}
              </h1>
              <p className="text-sm text-white/50">{t('terms_last_updated')}</p>
            </div>
            <div className="hidden sm:flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/15">
              <Image
                src="/images/shield-icon.svg"
                alt=""
                width={28}
                height={28}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Accent bar */}
          <div className="mt-6 h-0.5 w-12 rounded-full bg-mq-warning" />
        </div>
      </div>

      <main>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
            {/* Sticky sidebar TOC — desktop only */}
            <aside className="hidden lg:block">
              <div className="sticky top-8 space-y-1">
                <p className="text-xs uppercase tracking-[0.15em] font-semibold text-mq-content-secondary mb-3">
                  {t('terms_sections')}
                </p>
                {TERMS_SECTIONS.map((section, index) => (
                  <a
                    key={section.titleKey}
                    href={`#section-${index + 1}`}
                    className="block py-1.5 px-2 rounded-lg text-sm text-mq-content-secondary hover:text-mq-content hover:bg-mq-border/30 transition-colors"
                  >
                    <span className="truncate">{t(section.titleKey)}</span>
                  </a>
                ))}
              </div>
            </aside>

            {/* Sections */}
            <div className="space-y-8">
              {TERMS_SECTIONS.map((section, index) => (
                <section
                  key={section.titleKey}
                  id={`section-${index + 1}`}
                  aria-labelledby={`terms-heading-${index + 1}`}
                  /* Fix: scroll-mt-8 ensures TOC anchor links don't hide heading under sticky nav */
                  className="group scroll-mt-8 space-y-3 border-l-2 border-mq-border/40 hover:border-mq-primary/50 pl-5 transition-colors duration-300"
                >
                  <h2
                    id={`terms-heading-${index + 1}`}
                    className="text-lg font-bold text-mq-content flex items-center gap-3"
                  >
                    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-mq-primary/10 text-mq-primary flex items-center justify-center text-xs font-bold border border-mq-primary/20">
                      {index + 1}
                    </span>
                    {t(section.titleKey)}
                  </h2>

                  {section.blocks.map((block) => {
                    if (block.type === 'paragraph') {
                      return (
                        <p
                          key={block.key}
                          className="text-sm text-mq-content-secondary leading-relaxed"
                        >
                          {t(block.key, block.vars)}
                        </p>
                      );
                    }

                    if (block.type === 'list') {
                      return (
                        <ul key={block.keys.join('-')} className="space-y-2">
                          {block.keys.map((key) => (
                            <li
                              key={key}
                              className="flex items-start gap-2 text-sm text-mq-content-secondary"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mq-primary/60" />
                              {t(key)}
                            </li>
                          ))}
                        </ul>
                      );
                    }

                    return (
                      <p
                        key={block.key}
                        className="text-sm text-mq-content-secondary leading-relaxed"
                      >
                        {t(block.key)}{' '}
                        <a
                          href={`mailto:${APP_CONFIG.contactEmail}`}
                          className="text-mq-primary hover:underline font-medium"
                        >
                          {APP_CONFIG.contactEmail}
                        </a>
                      </p>
                    );
                  })}
                </section>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
