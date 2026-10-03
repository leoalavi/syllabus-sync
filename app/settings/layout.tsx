'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
import { useHydration } from '@/lib/hooks/useHydration';
import ErrorBoundary from '@/components/ErrorBoundary';
import { SettingsSectionBoundary } from '@/features/settings/components/SettingsSectionBoundary';
import { cn } from '@/lib/utils';
import { Palette, Shield, Layout, Settings, Sparkles, Info } from 'lucide-react';
import MovingMeshBackground from '@/components/ui/MovingMeshBackground';
import type { TranslationKey } from '@/lib/i18n/translations';

import { SettingsSkeleton } from '@/features/settings/components';

const SECTIONS: {
  id: string;
  icon: React.ElementType;
  labelKey: TranslationKey;
  color: string;
  path: string;
}[] = [
  {
    id: 'general',
    icon: Layout,
    labelKey: 'settings_general',
    color: 'text-mq-info',
    path: '/settings/general',
  },
  {
    id: 'appearance',
    icon: Palette,
    labelKey: 'settings_appearance',
    color: 'text-mq-purple',
    path: '/settings/appearance',
  },
  {
    id: 'security',
    icon: Shield,
    labelKey: 'security',
    color: 'text-mq-success',
    path: '/settings/security',
  },
  {
    id: 'experience',
    icon: Sparkles,
    labelKey: 'settings_experience',
    color: 'text-mq-warning',
    path: '/settings/experience',
  },
  {
    id: 'about',
    icon: Info,
    labelKey: 'settings_about',
    color: 'text-mq-content-secondary',
    path: '/settings/about',
  },
];

function SettingsLayout({ children }: { children?: React.ReactNode }) {
  const isClient = useHydration();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTypedTranslation();

  // Determine active section based on current path
  const activeSectionId =
    SECTIONS.find((section) => pathname?.startsWith(section.path))?.id || 'general';

  const navigateToSection = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router],
  );

  return (
    <div className="min-h-screen text-mq-content transition-colors duration-300">
      <MovingMeshBackground />
      {/* Hero Header Shell */}
      <div className="relative bg-mq-background/80 backdrop-blur-xl border-b border-mq-border sticky top-0 z-40 transition-all duration-300 supports-[backdrop-filter]:bg-mq-background/60">
        <div className="absolute inset-0 bg-gradient-to-r from-mq-primary/5 via-transparent to-mq-secondary/5 opacity-50 pointer-events-none" />
        <div className="container mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-4 relative">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-mq-primary/10 text-mq-primary">
              <Settings className="h-5 w-5" />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-mq-content tracking-tight">
              {t('settingsTitle')}
            </h1>
          </div>
          <p className="text-sm text-mq-content-secondary mt-1 max-w-md sm:ml-[44px]">
            {t('settingsSubtitle')}
          </p>
        </div>

        {/* Mobile Navigation (Horizontal Scroll) */}
        <div className="lg:hidden w-full overflow-x-auto scrollbar-hide border-t border-mq-border/50">
          <div className="flex items-center px-3 sm:px-4 py-2 gap-2 min-w-max">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSectionId === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => navigateToSection(section.path)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap',
                    isActive
                      ? 'bg-mq-primary text-mq-background shadow-sm'
                      : 'bg-mq-card-background text-mq-content-secondary border border-mq-border/60 hover:bg-mq-card-background hover:text-mq-content',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-current' : section.color)} />
                  {t(section.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:py-8">
        <div className="lg:grid lg:grid-cols-[260px_1fr] gap-6 lg:gap-10 items-start">
          {/* Desktop Sidebar Navigation */}
          <aside className="hidden lg:block sticky top-32 space-y-1">
            <div className="mb-4 px-3 text-xs font-semibold text-mq-content-tertiary uppercase tracking-wider">
              {t('settings_sections')}
            </div>
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSectionId === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => navigateToSection(section.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative',
                    isActive
                      ? 'bg-mq-primary/10 text-mq-primary'
                      : 'text-mq-content-secondary hover:bg-mq-hover-background hover:text-mq-content',
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-mq-primary rounded-r-full" />
                  )}
                  <Icon
                    className={cn(
                      'h-4.5 w-4.5 transition-colors',
                      isActive
                        ? 'text-mq-primary'
                        : 'text-mq-content-tertiary group-hover:text-mq-content',
                    )}
                  />
                  {t(section.labelKey)}
                </button>
              );
            })}
          </aside>

          {/* Settings Content Area */}
          <div className="min-h-[420px] sm:min-h-[500px] min-w-0">
            {!isClient ? (
              <SettingsSkeleton t={t} />
            ) : (
              <SettingsSectionBoundary sectionName={activeSectionId}>
                {children}
              </SettingsSectionBoundary>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage({ children }: { children?: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <SettingsLayout>{children}</SettingsLayout>
    </ErrorBoundary>
  );
}
