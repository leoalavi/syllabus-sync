'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Mail, FileText, ShieldCheck, ArrowLeft, ArrowRight, Send } from 'lucide-react';
import { APP_CONFIG, EXTERNAL_LINKS } from '@/lib/config';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';

export default function ContactClient() {
  const { t } = useTypedTranslation();
  const [contactEmail, setContactEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedFeedback = feedback.trim();
    if (trimmedFeedback.length < 10) {
      setError(t('contact_error_minLength'));
      return;
    }

    setError('');
    const subject = encodeURIComponent(t('contact_emailSubject', { appName: APP_CONFIG.name }));
    const body = encodeURIComponent(
      `${t('contact_emailFieldLabel')}: ${contactEmail.trim() || t('contact_notProvided')}\n\n${t('contact_feedbackFieldLabel')}:\n${trimmedFeedback}`,
    );
    window.location.href = `mailto:${APP_CONFIG.contactEmail}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

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

        <div className="relative mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <Link
            href="/home"
            className="animate-fade-in mb-5 inline-flex items-center gap-1.5 rounded-mq-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-all duration-200 hover:border-white/35 hover:bg-white/20"
            style={{ animationFillMode: 'both' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t('backToApp', { appName: APP_CONFIG.name })}
          </Link>
          <p
            className="animate-fade-in text-[11px] font-bold uppercase tracking-[0.22em] text-mq-warning"
            style={{ animationFillMode: 'both' }}
          >
            {t('contact_supportFeedback')}
          </p>
          <h1
            className="animate-fade-in mt-3 font-serif text-4xl font-bold leading-[1.15] text-white sm:text-5xl"
            style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
          >
            {t('contact_pageTitle', { appName: APP_CONFIG.name })}
          </h1>
          <p
            className="animate-fade-in mt-4 max-w-2xl text-[15px] leading-relaxed text-white/75 sm:text-base"
            style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
          >
            {t('contact_heroDesc')}
          </p>
        </div>
      </section>

      {/* ── Content ── */}
      <main>
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8 lg:py-20">
          {/* ── Sidebar ── */}
          <aside
            className="animate-fade-in space-y-5 lg:col-span-1"
            style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
          >
            <div>
              <div className="flex items-center gap-3">
                <span className="block h-px w-8 bg-mq-primary" aria-hidden="true" />
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-mq-primary">
                  {t('contact_reachOut')}
                </p>
              </div>
              <h2 className="mt-3 font-serif text-2xl font-bold text-mq-content">
                {t('contact_supportChannels')}
              </h2>
            </div>

            <article className="group rounded-xl border border-mq-border bg-mq-card-background p-5 transition-all duration-300 hover:border-mq-primary/25 hover:shadow-lg hover:shadow-mq-primary/5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mq-primary/10 transition-colors duration-300 group-hover:bg-mq-primary/15">
                  <Mail className="h-4 w-4 text-mq-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-mq-content">{t('email')}</p>
                  <a
                    href={`mailto:${APP_CONFIG.contactEmail}`}
                    className="mt-0.5 inline-block text-sm text-mq-content-secondary transition-colors hover:text-mq-primary"
                  >
                    {APP_CONFIG.contactEmail}
                  </a>
                </div>
              </div>
            </article>

            {/* Fix: added `group` to article so group-hover:opacity-100 on ArrowRight fires */}
            <article className="group rounded-xl border border-mq-border bg-mq-card-background p-5 transition-all duration-300 hover:border-mq-primary/25 hover:shadow-lg hover:shadow-mq-primary/5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mq-primary/10 transition-colors duration-300 group-hover:bg-mq-primary/15">
                  <FileText className="h-4 w-4 text-mq-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-mq-content">
                    {t('contact_helpfulLinks')}
                  </p>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {/* Fix: moved `group` from missing parent to the `<a>` itself */}
                    <a
                      href={EXTERNAL_LINKS.projectInfo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/link inline-flex items-center gap-1 text-sm text-mq-content-secondary transition-colors hover:text-mq-primary"
                    >
                      {t('aboutTitle')}
                      <ArrowRight
                        className="h-3 w-3 opacity-0 transition-opacity group-hover/link:opacity-100"
                        aria-hidden="true"
                      />
                    </a>
                    <Link
                      href="/about"
                      className="text-sm text-mq-content-secondary transition-colors hover:text-mq-primary"
                    >
                      {t('about')}
                    </Link>
                    <Link
                      href="/privacy"
                      className="text-sm text-mq-content-secondary transition-colors hover:text-mq-primary"
                    >
                      {t('privacyPolicy')}
                    </Link>
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-xl border border-mq-border bg-mq-card-background p-5 transition-all duration-300 hover:border-mq-primary/25 hover:shadow-lg hover:shadow-mq-primary/5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mq-primary/10">
                  <ShieldCheck className="h-4 w-4 text-mq-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-mq-content">
                    {t('contact_privacyNotice')}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-mq-content-secondary">
                    {t('contact_privacyNoticeDesc')}
                  </p>
                </div>
              </div>
            </article>
          </aside>

          {/* ── Form ── */}
          <article
            className="animate-fade-in rounded-2xl border border-mq-border bg-mq-card-background p-6 sm:p-8 lg:col-span-2"
            style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
          >
            <div className="flex items-center gap-3">
              <span className="block h-px w-8 bg-mq-primary" aria-hidden="true" />
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-mq-primary">
                {t('contact_getInTouch')}
              </p>
            </div>
            <h2 className="mt-3 font-serif text-2xl font-bold text-mq-content">
              {t('contact_feedbackHeading')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-mq-content-secondary">
              {t('contact_formDesc')}
            </p>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-sm font-semibold text-mq-content"
                >
                  {t('contact_emailFieldLabel')}
                  <span className="ml-1.5 text-xs font-normal text-mq-content-secondary">
                    ({t('optional')})
                  </span>
                </label>
                <p
                  id="contact-email-desc"
                  className="mt-1 text-xs leading-relaxed text-mq-content-secondary"
                >
                  {t('contact_emailFieldDesc')}
                </p>
                <input
                  id="contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder={t('emailPlaceholderExample')}
                  aria-describedby="contact-email-desc"
                  maxLength={254}
                  className="mt-2.5 w-full rounded-mq-lg border border-mq-border bg-mq-input-background px-4 py-2.5 text-sm text-mq-content shadow-sm outline-none transition-all duration-200 placeholder:text-mq-content-secondary/50 focus:border-mq-primary focus:ring-2 focus:ring-mq-primary/20"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-feedback"
                  className="block text-sm font-semibold text-mq-content"
                >
                  {t('contact_feedbackFieldLabel')}
                </label>
                <textarea
                  id="contact-feedback"
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder={t('contact_feedbackPlaceholder')}
                  rows={7}
                  required
                  maxLength={2000}
                  aria-describedby={error ? 'feedback-error' : undefined}
                  aria-invalid={!!error}
                  className="mt-2.5 w-full rounded-mq-lg border border-mq-border bg-mq-input-background px-4 py-3 text-sm text-mq-content shadow-sm outline-none transition-all duration-200 placeholder:text-mq-content-secondary/50 focus:border-mq-primary focus:ring-2 focus:ring-mq-primary/20"
                />
              </div>

              {/* Fix: text-mq-danger → text-mq-error (mq-danger is not a defined token) */}
              {error && (
                <p
                  id="feedback-error"
                  role="alert"
                  className="animate-fade-in text-sm font-medium text-mq-error"
                >
                  {error}
                </p>
              )}
              {submitted && (
                <p className="animate-fade-in text-sm font-medium text-mq-success">
                  {t('contact_emailDraftOpened')}
                </p>
              )}

              <button
                type="submit"
                className="inline-flex items-center gap-2.5 rounded-mq-lg bg-mq-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-mq-primary/90 hover:shadow-md"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {t('contact_sendFeedback')}
              </button>
            </form>
          </article>
        </div>
      </main>
    </div>
  );
}
