'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  CalendarCheck,
  BarChart3,
  Download,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { APP_CONFIG, EXTERNAL_LINKS } from '@/lib/config';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';

const VALUE_CARD_KEYS: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}[] = [
  { icon: Users, titleKey: 'about_value1Title', descKey: 'about_value1Desc' },
  { icon: ShieldCheck, titleKey: 'about_value2Title', descKey: 'about_value2Desc' },
  { icon: Sparkles, titleKey: 'about_value3Title', descKey: 'about_value3Desc' },
  { icon: Target, titleKey: 'about_value4Title', descKey: 'about_value4Desc' },
];

const FEATURE_CARD_KEYS: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}[] = [
  { icon: CalendarCheck, titleKey: 'about_feature1Title', descKey: 'about_feature1Desc' },
  { icon: BarChart3, titleKey: 'about_feature2Title', descKey: 'about_feature2Desc' },
  { icon: Download, titleKey: 'about_feature3Title', descKey: 'about_feature3Desc' },
];

const DEVELOPERS = [
  {
    name: 'Leo Alavi',
    roleKey: 'about_devRoleFrontend' as TranslationKey,
    photo: '/images/team/pouya.jpg',
  },
  {
    name: 'Raouf',
    roleKey: 'about_devRoleBackend' as TranslationKey,
    photo: '/images/team/raouf.jpg',
  },
] as const;

export default function AboutClient() {
  const { t } = useTypedTranslation();

  return (
    <div className="min-h-screen bg-mq-background">
      {/* ── Hero ── */}
      <section
        aria-label={t('heroSection')}
        className="relative overflow-hidden border-b border-mq-border bg-gradient-to-br from-mq-red-deep via-mq-primary to-mq-red-deep"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-mq-warning/10 blur-[80px]" />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:gap-14 lg:px-8 lg:py-20">
          <div className="flex-1 space-y-5">
            <Link
              href="/home"
              className="animate-fade-in inline-flex items-center gap-1.5 rounded-mq-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-all duration-200 hover:border-white/35 hover:bg-white/20"
              style={{ animationFillMode: 'both' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t('backToApp', { appName: APP_CONFIG.name })}
            </Link>
            <p
              className="animate-fade-in text-[11px] font-bold uppercase tracking-[0.22em] text-mq-warning"
              style={{ animationFillMode: 'both' }}
            >
              {APP_CONFIG.name}
            </p>
            <h1
              className="animate-fade-in font-serif text-4xl font-bold leading-[1.15] text-white sm:text-5xl"
              style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
            >
              {t('aboutTitle')}
            </h1>
            <p
              className="animate-fade-in max-w-xl text-[15px] leading-relaxed text-white/75 sm:text-base"
              style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
            >
              {t('about_heroDesc', { appName: APP_CONFIG.name })}
            </p>
            <div
              className="animate-fade-in flex flex-wrap items-center gap-3 pt-1"
              style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
            >
              {/* Fix: added `group` so group-hover:translate-x-0.5 on ArrowRight fires */}
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 rounded-mq-lg bg-white px-5 py-2.5 text-sm font-semibold text-mq-primary shadow-lg shadow-black/15 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-xl hover:shadow-black/20"
              >
                {t('getStarted')}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <a
                href={EXTERNAL_LINKS.projectInfo}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-mq-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {t('aboutTitle')}
              </a>
            </div>
          </div>

          <div
            className="animate-fade-in relative h-60 w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/30 lg:h-80 lg:w-[440px]"
            style={{ animationDelay: '0.35s', animationFillMode: 'both' }}
          >
            <Image
              src="/images/login-bg.png"
              alt={t('about_heroImgAlt')}
              fill
              sizes="(max-width: 1024px) 100vw, 440px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-mq-red-deep/50 via-transparent to-transparent" />
          </div>
        </div>
      </section>

      <div>
        {/* ── Values ── */}
        <section
          aria-labelledby="values-heading"
          className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="flex items-center gap-3">
            <span className="block h-px w-8 bg-mq-primary" aria-hidden="true" />
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-mq-primary">
              {t('about_whatWeStandFor')}
            </p>
          </div>
          <h2
            id="values-heading"
            className="mt-3 font-serif text-3xl font-bold text-mq-content sm:text-4xl"
          >
            {t('about_ourValues')}
          </h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-mq-content-secondary">
            {t('about_valuesDesc')}
          </p>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            {VALUE_CARD_KEYS.map((item, i) => (
              <article
                key={item.titleKey}
                className="animate-fade-in group rounded-xl border border-mq-border bg-mq-card-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-mq-primary/25 hover:shadow-lg hover:shadow-mq-primary/5"
                style={{
                  animationDelay: `${0.1 + i * 0.08}s`,
                  animationFillMode: 'both',
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mq-primary/10 transition-colors duration-300 group-hover:bg-mq-primary/15">
                  <item.icon className="h-5 w-5 text-mq-primary" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-mq-content">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mq-content-secondary">
                  {t(item.descKey)}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section aria-labelledby="features-heading" className="border-y border-mq-border/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="flex items-center gap-3">
              <span className="block h-px w-8 bg-mq-primary" aria-hidden="true" />
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-mq-primary">
                {t('about_whatWeBuild')}
              </p>
            </div>
            <h2
              id="features-heading"
              className="mt-3 font-serif text-3xl font-bold text-mq-content sm:text-4xl"
            >
              {t('about_builtForSuccess')}
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-mq-content-secondary">
              {t('about_featuresDesc')}
            </p>
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
              {FEATURE_CARD_KEYS.map((item, i) => (
                <article
                  key={item.titleKey}
                  className="animate-fade-in group rounded-xl border border-mq-border bg-mq-card-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-mq-primary/25 hover:shadow-lg hover:shadow-mq-primary/5"
                  style={{
                    animationDelay: `${0.1 + i * 0.1}s`,
                    animationFillMode: 'both',
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mq-primary/10 transition-colors duration-300 group-hover:bg-mq-primary/15">
                    <item.icon className="h-5 w-5 text-mq-primary" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-mq-content">
                    {t(item.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-mq-content-secondary">
                    {t(item.descKey)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Developers ── */}
        <section
          aria-labelledby="team-heading"
          className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="flex items-center gap-3">
            <span className="block h-px w-8 bg-mq-primary" aria-hidden="true" />
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-mq-primary">
              {t('about_theTeam')}
            </p>
          </div>
          <h2
            id="team-heading"
            className="mt-3 font-serif text-3xl font-bold text-mq-content sm:text-4xl"
          >
            {t('about_ourDevelopers')}
          </h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-mq-content-secondary">
            {t('about_developersDesc')}
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {DEVELOPERS.map((dev, i) => (
              <article
                key={dev.name}
                className="animate-fade-in group relative overflow-hidden rounded-2xl border border-mq-border transition-all duration-500 hover:border-mq-primary/25 hover:shadow-xl hover:shadow-mq-primary/5"
                style={{
                  animationDelay: `${0.15 + i * 0.15}s`,
                  animationFillMode: 'both',
                }}
              >
                <div className="relative h-[400px] w-full overflow-hidden sm:h-[440px]">
                  <Image
                    src={dev.photo}
                    alt={`${dev.name} — ${t(dev.roleKey)}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h3 className="text-overlay-white text-2xl font-bold tracking-tight">
                      {dev.name}
                    </h3>
                    <p className="text-overlay-white-muted mt-1 text-sm font-medium">
                      {t(dev.roleKey)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
