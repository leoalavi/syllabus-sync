'use client';

import { useRouter } from 'next/navigation';
import TodaySchedule from '@/features/home/components/TodaySchedule';
import UpcomingDeadlines from '@/features/home/components/UpcomingDeadlines';
import TodosWidget from '@/features/home/components/TodosWidget';
import UserEventsWidget from '@/features/home/components/UserEventsWidget';
import { WelcomeHeader } from '@/features/home/components/WelcomeHeader';
import UnitCard from '@/components/units/UnitCard';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
import { ScrollReveal, revealChildVariants } from '@/components/ui/ScrollReveal';
import { LazyMotion, m, domAnimation } from 'framer-motion';

import { DEMO_USER } from '@/lib/config';
import {
  Info,
  Plus,
  BookOpen,
  Eye,
  Pencil,
  GraduationCap,
  FileText,
  Calendar,
  ListTodo,
} from 'lucide-react';
import { Button } from '@/components/ui/mq/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/mq/badge';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/mq/card';
import Link from 'next/link';
import { CardSolid } from '@/features/home/components/HomeCard';
import HomeKpiStrip from '@/features/home/components/HomeKpiStrip';
import WeekHeatStrip from '@/features/home/components/WeekHeatStrip';

import {
  useHomeUser,
  useHomeData,
  useHomeEventListeners,
  useHomeErrorBoundary,
  useFirstLoginPrompts,
} from '@/features/home/hooks';
import { AuthUser } from '@/features/home/types';
import { useCalendarIntentStore } from '@/lib/store/calendarIntentStore';
import type { CalendarIntentTarget } from '@/features/calendar/lib/calendarIntent';

interface HomeClientProps {
  initialUser?: AuthUser | null;
}

export default function HomeClient({ initialUser = null }: HomeClientProps) {
  const { t } = useTypedTranslation();
  const router = useRouter();
  const queueCalendarIntent = useCalendarIntentStore((state) => state.queueCalendarIntent);

  const { hasError, errorMessage, handleErrorRecovery } = useHomeErrorBoundary();
  const { displayName, hasHydrated } = useHomeUser(initialUser);
  const { units, hasUnits, unitStats } = useHomeData();
  useHomeEventListeners();
  // One-shot permission prompts after a fresh login / onboarding completion.
  // Reads a sessionStorage flag set by login success handlers; no-op otherwise.
  useFirstLoginPrompts();

  const handleQuickCalendarAction = (target: CalendarIntentTarget) => {
    queueCalendarIntent({
      target,
      highlight: true,
      autoOpenForm: true,
    });
    router.push('/calendar');
  };

  // Quick add lives in the header; the bottom-right corner belongs to the
  // Sylla assistant (components/sylla/SyllaLauncher.tsx), shown on every page.
  const quickAddItems: { target: CalendarIntentTarget; label: string; Icon: typeof Plus }[] = [
    { target: 'unit', label: t('addUnitClass'), Icon: BookOpen },
    { target: 'exam', label: t('addExam'), Icon: GraduationCap },
    { target: 'assignment', label: t('addAssignment'), Icon: FileText },
    { target: 'event', label: t('addEvent'), Icon: Calendar },
    { target: 'reminder', label: t('addTodo'), Icon: ListTodo },
  ];

  if (hasError) {
    return (
      <div className="container mx-auto p-6 max-w-7xl home-page">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-mq-content mb-4">{t('somethingWentWrong')}</h1>
          <p className="text-mq-content-secondary mb-6 max-w-md mx-auto">
            {errorMessage || t('unexpectedError')}
          </p>
          <div className="space-y-3">
            <Button onClick={handleErrorRecovery} className="mr-3">
              {t('tryAgain')}
            </Button>
            <Button variant="secondary" onClick={() => router.push('/')}>
              {t('goHome')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <section
        className="home-page overflow-x-hidden container mx-auto p-4 sm:p-6 max-w-7xl"
        aria-label={t('dashboardOverviewLabel')}
      >
        {/* Header */}
        <ScrollReveal>
          <header className="mb-6 flex flex-wrap items-start justify-between gap-3" role="banner">
            <div className="min-w-0 flex-1">
              <WelcomeHeader name={displayName} fallbackName={DEMO_USER.name} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="shrink-0 gap-2" data-testid="home-quick-add">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t('quickActions')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {quickAddItems.map(({ target, label, Icon }) => (
                  <DropdownMenuItem
                    key={target}
                    onSelect={() => handleQuickCalendarAction(target)}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
        </ScrollReveal>

        {/* KPI Strip - Phase 3.1 */}
        <ScrollReveal delay={0.1}>
          <HomeKpiStrip />
        </ScrollReveal>

        {/* Week Heat-Strip - Phase 3.3 */}
        <ScrollReveal delay={0.15}>
          <WeekHeatStrip />
        </ScrollReveal>

        {/* Get Started Banner */}
        {!hasUnits && (
          <ScrollReveal delay={0.1}>
            <section
              className="mb-6 p-4 bg-mq-info/10 border border-mq-info/20 rounded-mq-lg flex items-start gap-3"
              aria-labelledby="get-started-heading"
            >
              <Info className="h-5 w-5 text-mq-info shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <h2 id="get-started-heading" className="sr-only">
                  {t('gettingStartedGuide')}
                </h2>
                <p className="text-mq-sm text-mq-info">
                  <strong>{t('getStarted')}</strong> {t('addUnitsToSync')}
                </p>
              </div>
            </section>
          </ScrollReveal>
        )}

        {/* Main Dashboard Grid - Today's Classes and Deadlines */}
        <section
          className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mb-6 2xl:max-w-[1600px] 2xl:mx-auto"
          aria-label={t('dashboardOverview')}
        >
          <ScrollReveal delay={0.1}>
            <TodaySchedule />
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <UpcomingDeadlines />
          </ScrollReveal>
        </section>

        {/* My Units Section - READ ONLY on Home page */}
        <ScrollReveal delay={0.25} staggerChildren={0.1}>
          <section aria-labelledby="units-section-heading" className="mb-6">
            <CardSolid>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle id="units-section-heading" className="flex items-center gap-2 min-w-0">
                  <BookOpen className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t('myUnits')}</span>
                  {/* View Only Badge - makes read-only state obvious */}
                  {hasHydrated && units.length > 0 && (
                    <Badge
                      variant="neutral"
                      className="ml-2 bg-mq-background-secondary text-mq-content-tertiary text-[10px] px-2 py-0.5 hidden sm:flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" aria-hidden="true" />
                      {t('viewOnly')}
                    </Badge>
                  )}
                </CardTitle>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" asChild>
                  <Link
                    href="/calendar?highlightWidget=units"
                    aria-label={`${t('manageInCalendar')} ${t('myUnits')}`}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">{t('manageInCalendar')}</span>
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {!hasHydrated ? (
                  <div className="h-32 flex items-center justify-center">
                    <div className="animate-pulse space-y-3 w-full max-w-md">
                      <div className="h-4 bg-mq-background-tertiary rounded w-3/4 mx-auto" />
                      <div className="h-4 bg-mq-background-tertiary rounded w-1/2 mx-auto" />
                    </div>
                  </div>
                ) : units.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="text-mq-lg font-semibold text-mq-content mb-2">
                      {t('noUnitsYet')}
                    </h3>
                    <p className="text-mq-content-secondary mb-4 max-w-md mx-auto">
                      {t('addFirstUnitDesc')}
                    </p>
                    <Button asChild className="gap-2">
                      <Link href="/calendar">
                        <Plus className="h-4 w-4" />
                        {t('addYourFirstUnit')}
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Unit Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 bg-mq-background-secondary rounded-mq-lg mb-6 border border-mq-border">
                      <div className="text-center">
                        <p className="text-mq-2xl font-bold text-mq-content">
                          {unitStats.unitCount}
                        </p>
                        <p className="text-mq-xs text-mq-content-secondary">{t('units')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-mq-2xl font-bold text-mq-content">
                          {unitStats.totalClasses}
                        </p>
                        <p className="text-mq-xs text-mq-content-secondary">
                          {t('classesPerWeek')}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-mq-2xl font-bold text-mq-content">
                          {unitStats.studyHours}h
                        </p>
                        <p className="text-mq-xs text-mq-content-secondary">{t('studyHours')}</p>
                      </div>
                    </div>

                    {/* View-only hint */}
                    <p className="text-mq-xs text-mq-content-tertiary mb-3 flex items-center gap-1.5">
                      <Info className="h-3 w-3" aria-hidden="true" />
                      {t('homeViewOnlyHint')}
                    </p>

                    {/* Units Grid - READ ONLY (no edit/delete) */}
                    <m.div
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 auto-rows-fr"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.1 } },
                      }}
                    >
                      {units.map((unit) => (
                        <m.div
                          key={unit.id}
                          variants={revealChildVariants}
                          className="relative z-0 hover:z-50 focus-within:z-50 h-full"
                        >
                          <UnitCard
                            unit={unit}
                            showActions={false}
                            onClick={(clickedUnit) => {
                              const today = new Date().toISOString().split('T')[0];
                              router.push(
                                `/calendar?date=${today}&view=week&highlightUnit=${encodeURIComponent(clickedUnit.id)}`,
                              );
                            }}
                          />
                        </m.div>
                      ))}
                    </m.div>
                  </>
                )}
              </CardContent>
            </CardSolid>
          </section>
        </ScrollReveal>

        {/* Events and Todo Grid */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mb-6 2xl:max-w-[1600px] 2xl:mx-auto">
          <ScrollReveal delay={0.35}>
            <UserEventsWidget />
          </ScrollReveal>
          <ScrollReveal delay={0.4}>
            <TodosWidget />
          </ScrollReveal>
        </section>
      </section>
    </LazyMotion>
  );
}
