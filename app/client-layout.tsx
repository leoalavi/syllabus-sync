'use client';

import React, { useEffect, useState, memo, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import AppFooter from '@/components/layout/AppFooter';
import ThemeProvider from '@/components/theme/ThemeProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { errorHandler } from '@/lib/utils/errorHandling';
import { registerServiceWorker } from '@/lib/utils/serviceWorker';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
import { useNotificationScheduler } from '@/lib/hooks/useNotificationScheduler';
import { useReminderChecker } from '@/lib/hooks/useReminderChecker';
import { useInactivityLogout } from '@/lib/hooks/useInactivityLogout';
import { useInstallPrompt } from '@/lib/hooks/useInstallPrompt';
import { useSWUpdate } from '@/lib/hooks/useSWUpdate';
import { useLanguageStore } from '@/lib/store/languageStore';
import { LevelUpNotificationProvider } from '@/features/gamification/components/LevelUpNotification';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  getBrowserAuthSnapshot,
  getConfirmedBrowserAuthSnapshot,
} from '@/lib/supabase/browserSession';
import { clearAllClientStorage, resetAllStores } from '@/lib/utils/clientStorage';
import { apiRequest } from '@/lib/utils/api';
import { API_ROUTES } from '@/lib/constants/config';
import SyncConflictDialog from '@/components/sync/SyncConflictDialog';
import { isRunningAsPWA } from '@/lib/utils/pwa';

const AUTH_ROUTES = ['/login', '/signup', '/reset-password'] as const;
const PUBLIC_ROUTES = ['/terms', '/privacy', '/verify', '/about', '/contact'] as const;
const POST_AUTH_ROUTES = ['/onboarding'] as const;

if (typeof window !== 'undefined') {
  const originalConsoleError = console.error.bind(console);
  const NEXT_KEY_WARNING = 'Each child in a list should have a unique "key" prop';
  const OUTER_LAYOUT_ROUTER = 'OuterLayoutRouter';

  console.error = (...args: unknown[]) => {
    const firstArg = args[0];
    if (
      typeof firstArg === 'string' &&
      firstArg.includes(NEXT_KEY_WARNING) &&
      args.some((arg) => typeof arg === 'string' && arg.includes(OUTER_LAYOUT_ROUTER))
    ) {
      return;
    }
    originalConsoleError(...args);
  };

  // eslint-disable-next-line no-console
  const originalConsoleInfo = console.info.bind(console);
  const REACT_DEVTOOLS_MSG = 'Download the React DevTools';

  // eslint-disable-next-line no-console
  console.info = (...args: unknown[]) => {
    const firstArg = args[0];
    if (typeof firstArg === 'string' && firstArg.includes(REACT_DEVTOOLS_MSG)) {
      return;
    }
    originalConsoleInfo(...args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || '';
    if (
      message.includes('message channel closed') ||
      message.includes('Frame with ID 0 was removed')
    ) {
      event.preventDefault();
    }
  });
}

const scheduleIdleTask = (callback: () => void) => {
  if (typeof window === 'undefined') return;
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => callback());
  } else {
    setTimeout(callback, 200);
  }
};

function ClientLayoutComponent({ children }: { children: React.ReactNode }) {
  const { t } = useTypedTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const language = useLanguageStore((state) => state.language);

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isPostAuthRoute = POST_AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const inactivityLogoutInProgressRef = useRef(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => !isAuthRoute && !isPublicRoute && !isPostAuthRoute,
  );
  const isAuthenticatedRef = useRef(isAuthenticated);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const checkAuth = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    if (isPublicRoute || isPostAuthRoute) return;
    if (pathname.startsWith('/reset-password')) return;

    try {
      const authSnapshot = isAuthenticatedRef.current
        ? await getConfirmedBrowserAuthSnapshot()
        : await getBrowserAuthSnapshot();
      const { user, resolution } = authSnapshot;
      if (resolution === 'unknown') {
        return;
      }
      const authenticated = Boolean(user?.id);

      // Keep the authenticated shell mounted while a focus-time auth recheck is
      // ambiguous. Real sign-outs are handled by Supabase auth events below.
      if (!authenticated && isAuthenticatedRef.current) {
        return;
      }

      setIsAuthenticated(authenticated);

      const searchParams =
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const isMfaUpgradeUrl = searchParams?.get('mfa') === '1';
      const isPasswordResetFlow =
        pathname.startsWith('/reset-password') && searchParams?.has('code');

      if (authenticated && isAuthRoute && !isMfaUpgradeUrl && !isPasswordResetFlow) {
        router.push('/home');
      }

      // Redirect unauthenticated users from protected routes to login
      if (!authenticated && !isAuthRoute) {
        router.replace('/login');
      }
    } catch {
      // Keep optimistic state on error
    }
  }, [router, isAuthRoute, isPublicRoute, isPostAuthRoute, pathname]);

  useEffect(() => {
    scheduleIdleTask(() => {
      void checkAuth();
    });

    const handleFocus = () => {
      void checkAuth();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkAuth]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (isPublicRoute || isPostAuthRoute) return;
    if (pathname.startsWith('/reset-password')) return;

    const supabase = createBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
      const maybeSession =
        session && typeof session === 'object'
          ? (session as { user?: { id?: string } | null })
          : null;
      const hasUser = Boolean(maybeSession?.user?.id);

      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        if (!isAuthRoute) {
          router.replace('/login');
        }
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (hasUser) {
          setIsAuthenticated(true);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router, isAuthRoute, isPublicRoute, isPostAuthRoute, pathname]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      errorHandler.logError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        'UnhandledPromiseRejection',
        'high',
      );
    };

    const handleError = (event: ErrorEvent) => {
      errorHandler.logError(event.error || new Error(event.message), 'UncaughtError', 'critical');
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    scheduleIdleTask(() => {
      void registerServiceWorker();
    });

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  useNotificationScheduler();
  useReminderChecker();
  const { canInstall, promptInstall, dismissPrompt } = useInstallPrompt();
  const { updateAvailable, applyUpdate } = useSWUpdate();

  const handleInactivityLogout = useCallback(async () => {
    if (inactivityLogoutInProgressRef.current) return;
    inactivityLogoutInProgressRef.current = true;

    try {
      await resetAllStores();
      clearAllClientStorage();
      await apiRequest(API_ROUTES.AUTH.LOGOUT, {
        method: 'POST',
        noRetry: true,
      });
    } catch {
      // Best-effort cleanup
    } finally {
      router.replace('/login?reason=inactive');
    }
  }, [router]);

  // Inactivity timeout: Website = 30 minutes, PWA = disabled (no restrictions)
  const isPWA = typeof window !== 'undefined' && isRunningAsPWA();
  const inactivityTimeoutMs = 30 * 60 * 1000; // 30 minutes for website

  useInactivityLogout({
    enabled: isAuthenticated && !isAuthRoute && !isPublicRoute && !isPostAuthRoute && !isPWA,
    timeoutMs: inactivityTimeoutMs,
    onTimeout: () => {
      void handleInactivityLogout();
    },
  });

  if (isAuthRoute || isPostAuthRoute || isPublicRoute || !isAuthenticated) {
    return (
      <ThemeProvider>
        <div className="flex min-h-screen flex-col bg-mq-background">
          <main className="flex-1" role="main">
            {children}
          </main>
          <AppFooter />
          <Toaster />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <LevelUpNotificationProvider locale={language}>
        <a href="#main-content" className="skip-link">
          {t('skipToContent')}
        </a>
        <div className="flex h-screen h-[100dvh] overflow-hidden bg-mq-background layout-shell">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto md:ml-12 layout-main relative">
            <Header />
            <main id="main-content" className="flex-1" role="main" aria-label={t('mainContent')}>
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
            <AppFooter />
            <OfflineIndicator />

            {/* PWA Install Prompt */}
            {canInstall && (
              <div
                role="alert"
                className="fixed bottom-4 right-4 z-50 max-w-sm rounded-mq-lg border border-mq-border bg-mq-card-background p-4 shadow-mq-lg animate-in slide-in-from-bottom-4 fade-in"
              >
                <p className="text-sm font-medium text-mq-content">{t('installApp')}</p>
                <p className="mt-1 text-xs text-mq-content-secondary">{t('installAppDesc')}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void promptInstall()}
                    className="rounded-mq-lg bg-mq-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-mq-primary/90"
                  >
                    {t('install')}
                  </button>
                  <button
                    onClick={dismissPrompt}
                    className="rounded-mq-lg bg-mq-background-secondary px-3 py-1.5 text-xs font-medium text-mq-content-secondary transition-colors hover:bg-mq-hover-background"
                  >
                    {t('dismiss')}
                  </button>
                </div>
              </div>
            )}

            {/* SW Update Notification */}
            {updateAvailable && (
              <div
                role="alert"
                className="fixed top-4 right-4 z-50 max-w-sm rounded-mq-lg border border-mq-info bg-mq-info/10 p-4 shadow-mq-lg animate-in slide-in-from-top-4 fade-in"
              >
                <p className="text-sm font-medium text-mq-content">{t('updateAvailable')}</p>
                <p className="mt-1 text-xs text-mq-content-secondary">{t('updateAvailableDesc')}</p>
                <button
                  onClick={applyUpdate}
                  className="mt-3 rounded-mq-lg bg-mq-info px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-mq-info/90"
                >
                  {t('updateNow')}
                </button>
              </div>
            )}

            <Toaster />
            <SyncConflictDialog />
          </div>
        </div>
      </LevelUpNotificationProvider>
    </ThemeProvider>
  );
}

const ClientLayout = memo(ClientLayoutComponent);
ClientLayout.displayName = 'ClientLayout';
export default ClientLayout;
