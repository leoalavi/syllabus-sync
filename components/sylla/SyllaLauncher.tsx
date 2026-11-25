'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, RotateCcw, X } from 'lucide-react';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';

/**
 * Sylla, the AI study assistant, in the bottom-right corner of every signed-in
 * page (Notion-AI style). The panel shows Sylla's /embed page in a frame:
 * Sylla and Syllabus Sync share one login cookie on .syllabus-sync.app, so the
 * student is already signed in there, and Sylla answers using their own units,
 * deadlines and to-dos. "Open full Sylla" goes to the standalone site.
 *
 * Hidden when NEXT_PUBLIC_SYLLA_URL is not configured.
 */

// Literal property access so Next.js inlines it into the client bundle.
const SYLLA_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SYLLA_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
})();

export function SyllaLauncher() {
  const { t } = useTypedTranslation();
  const [open, setOpen] = useState(false);
  // The frame is created on first open and then kept, so closing and
  // reopening the panel keeps the conversation. "New chat" remounts it.
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const openPanel = useCallback(() => {
    if (!SYLLA_URL) return;
    if (!frameSrc) {
      const dark = document.documentElement.classList.contains('dark');
      setFrameSrc(`${SYLLA_URL}/embed?theme=${dark ? 'dark' : 'light'}`);
    }
    setOpen(true);
  }, [frameSrc]);

  const closePanel = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closePanel]);

  if (!SYLLA_URL) return null;

  return (
    <>
      {frameSrc && (
        <section
          id="sylla-panel"
          role="dialog"
          aria-modal="false"
          aria-label={t('syllaAssistant')}
          hidden={!open}
          data-testid="sylla-panel"
          className="fixed inset-0 z-[1000] flex flex-col overflow-hidden bg-mq-card-background sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-mq-lg sm:border sm:border-mq-border sm:shadow-mq-lg"
        >
          <header className="flex items-center gap-2 border-b border-mq-border px-3 py-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-mq-primary text-xs font-bold text-white"
            >
              S
            </span>
            <p className="flex-1 truncate text-sm font-semibold text-mq-content">
              {t('syllaAssistant')}
            </p>
            <button
              type="button"
              onClick={() => setFrameKey((key) => key + 1)}
              className="rounded-mq p-1.5 text-mq-content-secondary hover:bg-mq-background-secondary"
              aria-label={t('syllaNewChat')}
              title={t('syllaNewChat')}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
            <a
              href={`${SYLLA_URL}/chat`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-mq p-1.5 text-mq-content-secondary hover:bg-mq-background-secondary"
              aria-label={t('syllaOpenAria')}
              title={t('syllaOpen')}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <button
              ref={closeRef}
              type="button"
              onClick={closePanel}
              className="rounded-mq p-1.5 text-mq-content-secondary hover:bg-mq-background-secondary"
              aria-label={t('syllaClose')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>
          <iframe
            key={frameKey}
            src={frameSrc}
            title={t('syllaAssistant')}
            className="min-h-0 w-full flex-1 border-0"
            allow="clipboard-write"
          />
        </section>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={open ? closePanel : openPanel}
        aria-expanded={open}
        aria-controls={frameSrc ? 'sylla-panel' : undefined}
        aria-label={open ? t('syllaClose') : t('syllaAsk')}
        title={t('syllaAsk')}
        data-testid="sylla-launcher"
        className={`fixed z-[1001] h-12 w-12 items-center justify-center rounded-full bg-mq-primary text-lg font-bold text-white shadow-mq-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mq-primary focus-visible:ring-offset-2 sm:h-14 sm:w-14 ${open ? 'hidden sm:flex' : 'flex'}`}
        style={{
          bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          right: 'calc(1.5rem + env(safe-area-inset-right, 0px))',
        }}
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <span aria-hidden="true">S</span>}
      </button>
    </>
  );
}
