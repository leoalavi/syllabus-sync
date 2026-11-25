// app/global-error.tsx
// This component handles errors at the root level, including layout errors
// NOTE: This file renders outside the normal Next.js context (when root layout fails)
// so we cannot use <Link> component here - must use plain <a> tags
/* eslint-disable @next/next/no-html-link-for-pages */
'use client';

import { useEffect } from 'react';
import { reloadOnceForChunkError } from '@/lib/utils/chunkErrorRecovery';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTypedTranslation();

  useEffect(() => {
    // A stale chunk after a deploy only recovers with a full reload.
    if (reloadOnceForChunkError(error)) return;
    // No-op: Sentry capture removed to avoid dev HMR module factory errors.
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '1rem',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#f8f9fa',
            color: '#333',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '500px' }}>
            <svg
              viewBox="0 0 24 24"
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 1rem',
                color: '#dc3545',
              }}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>

            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
              {t('somethingWentWrong')}!
            </h1>

            <p style={{ color: '#666', marginBottom: '1.5rem' }}>{t('appErrorDesc')}</p>

            <button
              onClick={reset}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#A6192E',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                marginRight: '0.5rem',
              }}
            >
              {t('tryAgain')}
            </button>

            <a
              href="/"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '0.5rem',
              }}
            >
              {t('goHome')}
            </a>

            {error.digest && (
              <p
                style={{
                  marginTop: '1.5rem',
                  fontSize: '0.875rem',
                  color: '#999',
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
