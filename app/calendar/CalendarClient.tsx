'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import {
  Edit2,
  AlertTriangle,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/mq/button';
import DeadlineForm from '@/components/deadlines/DeadlineForm';
import { Deadline, Event, Todo, ClassTime } from '@/lib/types';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { cn } from '@/lib/utils';
import { UNIT_COLORS } from '@/lib/config';
import CalendarSidebar from '@/features/calendar/components/CalendarSidebar';
import CalendarWidgets from '@/features/calendar/components/CalendarWidgets';
import DayView from '@/features/calendar/components/DayView';
import AgendaView from '@/features/calendar/components/AgendaView';
import FilterPanel from '@/features/calendar/components/FilterPanel';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getMQKeyDatesForDay, MQ_DATE_COLORS, PROGRAM_STYLES } from '@/data/mqKeyDates';

// Hooks
import { useCalendarData } from '@/features/calendar/hooks/useCalendarData';
import { useCalendarView } from '@/features/calendar/hooks/useCalendarView';
import { useCalendarFiltering } from '@/features/calendar/hooks/useCalendarFiltering';
import { useCalendarDialogs } from '@/features/calendar/hooks/useCalendarDialogs';
import { useCalendarHighlights } from '@/features/calendar/hooks/useCalendarHighlights';
import { useCalendarGetters } from '@/features/calendar/hooks/useCalendarGetters';
import { useLiveCollaboration } from '@/features/calendar/hooks/useLiveCollaboration';
import { usePendingCalendarIntent } from '@/features/calendar/hooks/usePendingCalendarIntent';
import { useProfilesStore } from '@/lib/store/profilesStore';

dayjs.extend(isoWeek);

// Dynamically import forms
const EventForm = dynamic(() => import('@/components/events/EventForm'), {
  loading: () => null,
});

const UnitForm = dynamic(() => import('@/components/units/UnitForm'), {
  loading: () => null,
});

const UnitDetailPanel = dynamic(() => import('@/components/units/UnitDetailPanel'), {
  loading: () => null,
});

const AssignmentForm = dynamic(() => import('@/components/assignments/AssignmentForm'), {
  loading: () => null,
});

const AssignmentDetailPanel = dynamic(
  () => import('@/components/assignments/AssignmentDetailPanel'),
  {
    loading: () => null,
  },
);

const ExamForm = dynamic(() => import('@/components/exams/ExamForm'), {
  loading: () => null,
});

const ExamDetailPanel = dynamic(() => import('@/components/exams/ExamDetailPanel'), {
  loading: () => null,
});

const EventDetailPanel = dynamic(() => import('@/components/events/EventDetailPanel'), {
  loading: () => null,
});

const TodoDetailPanel = dynamic(() => import('@/features/calendar/components/TodoDetailPanel'), {
  loading: () => null,
});

export default function CalendarClient() {
  const { t } = useTypedTranslation();

  // Todo form saving state
  const [todoSaving, setTodoSaving] = useState(false);

  // 1. Data Hook
  const {
    deadlines,
    userEvents,
    units,
    todos,
    hasHydrated,
    removeDeadline,
    removeDeadlinesByUnit,
    removeEvent,
    removeUnit,
    addTodo,
    removeTodo,
    updateTodo,
  } = useCalendarData();

  // 2. View Hook
  const {
    view,
    setView,
    handleViewChange,
    currentWeekStart,
    mobileSelectedDayIndex,
    setMobileSelectedDayIndex,
    goToPreviousWeek,
    goToNextWeek,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    goToThisWeek,
    isCurrentWeek,
    isToday,
    weekDays,
  } = useCalendarView();

  // 3. Filtering Hook
  const {
    filters,
    setFilters,
    isFiltersOpen,
    handleToggleFilters,
    filteredUnits,
    filteredDeadlines,
    filteredEvents,
  } = useCalendarFiltering(units, deadlines, userEvents);

  // 4. Dialogs Hook
  const dialogs = useCalendarDialogs();
  const {
    // Dialog states
    deadlineDialogOpen,
    setDeadlineDialogOpen,
    editDeadline,
    setEditDeadline,
    assignmentDialogOpen,
    setAssignmentDialogOpen,
    editAssignment,
    setEditAssignment,
    examDialogOpen,
    setExamDialogOpen,
    editExam,
    setEditExam,
    eventDialogOpen,
    setEventDialogOpen,
    editEvent,
    setEditEvent,
    unitDialogOpen,
    setUnitDialogOpen,
    editingUnit,
    setEditingUnit,
    todoDialogOpen,
    setTodoDialogOpen,
    editingTodo,
    setEditingTodo,
    editTodoTitle,
    setEditTodoTitle,
    editTodoPriority,
    setEditTodoPriority,
    editTodoDueDate,
    setEditTodoDueDate,
    editTodoDueTime,
    setEditTodoDueTime,
    editTodoColor,
    setEditTodoColor,

    // Detail panel states
    unitDetailOpen,
    setUnitDetailOpen,
    selectedUnit,
    setSelectedUnit,
    assignmentDetailOpen,
    setAssignmentDetailOpen,
    selectedAssignment,
    setSelectedAssignment,
    examDetailOpen,
    setExamDetailOpen,
    selectedExam,
    setSelectedExam,
    eventDetailOpen,
    setEventDetailOpen,
    selectedEvent,
    setSelectedEvent,
    todoDetailOpen,
    setTodoDetailOpen,
    selectedTodo,
    setSelectedTodo,

    // Delete confirm states
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    unitToDelete,
    setUnitToDelete,
    assignmentDeleteConfirmOpen,
    setAssignmentDeleteConfirmOpen,
    assignmentToDelete,
    setAssignmentToDelete,
    examDeleteConfirmOpen,
    setExamDeleteConfirmOpen,
    examToDelete,
    setExamToDelete,
    deadlineDeleteConfirmOpen,
    setDeadlineDeleteConfirmOpen,
    deadlineToDelete,
    setDeadlineToDelete,
    eventDeleteConfirmOpen,
    setEventDeleteConfirmOpen,
    eventToDelete,
    setEventToDelete,
    todoDeleteConfirmOpen,
    setTodoDeleteConfirmOpen,
    todoToDelete,
    setTodoToDelete,

    // Actions
    openAddAssignment,
    openEditAssignment,
    openAssignmentDetail,
    openAddExam,
    openEditExam,
    openAddEvent,
    handleEventClick,
    openEditEvent,
    openAddTodo,
    openEditTodo,
    openAddUnit,
    openEditUnit,
    handleDeleteUnit,
  } = dialogs;

  // 5. Highlights Hook
  const { unitsWidgetRef, assignmentsWidgetRef, deadlineRefs, highlightedDeadlineId } =
    useCalendarHighlights(units, deadlines, userEvents, todos, hasHydrated, dialogs, setView);

  const examsWidgetRef = useRef<HTMLDivElement>(null);
  const eventsWidgetRef = useRef<HTMLDivElement>(null);
  const remindersWidgetRef = useRef<HTMLDivElement>(null);

  const prepareForPendingIntent = useCallback(() => {
    setDeadlineDialogOpen(false);
    setEditDeadline(null);
    setAssignmentDialogOpen(false);
    setEditAssignment(null);
    setExamDialogOpen(false);
    setEditExam(null);
    setEventDialogOpen(false);
    setEditEvent(null);
    setUnitDialogOpen(false);
    setEditingUnit(null);
    setTodoDialogOpen(false);
    setEditingTodo(null);

    setUnitDetailOpen(false);
    setSelectedUnit(null);
    setAssignmentDetailOpen(false);
    setSelectedAssignment(null);
    setExamDetailOpen(false);
    setSelectedExam(null);
    setEventDetailOpen(false);
    setSelectedEvent(null);
    setTodoDetailOpen(false);
    setSelectedTodo(null);

    setDeleteConfirmOpen(false);
    setUnitToDelete(null);
    setAssignmentDeleteConfirmOpen(false);
    setAssignmentToDelete(null);
    setExamDeleteConfirmOpen(false);
    setExamToDelete(null);
    setDeadlineDeleteConfirmOpen(false);
    setDeadlineToDelete(null);
    setEventDeleteConfirmOpen(false);
    setEventToDelete(null);
    setTodoDeleteConfirmOpen(false);
    setTodoToDelete(null);
  }, [
    setAssignmentDeleteConfirmOpen,
    setAssignmentDetailOpen,
    setAssignmentDialogOpen,
    setAssignmentToDelete,
    setDeadlineDeleteConfirmOpen,
    setDeadlineDialogOpen,
    setDeadlineToDelete,
    setDeleteConfirmOpen,
    setEditAssignment,
    setEditDeadline,
    setEditEvent,
    setEditExam,
    setEditingTodo,
    setEditingUnit,
    setEventDeleteConfirmOpen,
    setEventDetailOpen,
    setEventDialogOpen,
    setEventToDelete,
    setExamDeleteConfirmOpen,
    setExamDetailOpen,
    setExamDialogOpen,
    setExamToDelete,
    setSelectedAssignment,
    setSelectedEvent,
    setSelectedExam,
    setSelectedTodo,
    setSelectedUnit,
    setTodoDeleteConfirmOpen,
    setTodoDetailOpen,
    setTodoDialogOpen,
    setTodoToDelete,
    setUnitDetailOpen,
    setUnitDialogOpen,
    setUnitToDelete,
  ]);

  const calendarIntentWidgetRefs = useMemo(
    () => ({
      unit: unitsWidgetRef,
      assignment: assignmentsWidgetRef,
      exam: examsWidgetRef,
      event: eventsWidgetRef,
      reminder: remindersWidgetRef,
    }),
    [assignmentsWidgetRef, unitsWidgetRef],
  );

  const calendarIntentOpenStates = useMemo(
    () => ({
      unit: unitDialogOpen,
      assignment: assignmentDialogOpen,
      exam: examDialogOpen,
      event: eventDialogOpen,
      reminder: todoDialogOpen,
    }),
    [assignmentDialogOpen, eventDialogOpen, examDialogOpen, todoDialogOpen, unitDialogOpen],
  );

  const calendarIntentOpenForms = useMemo(
    () => ({
      unit: openAddUnit,
      assignment: openAddAssignment,
      exam: openAddExam,
      event: openAddEvent,
      reminder: openAddTodo,
    }),
    [openAddAssignment, openAddEvent, openAddExam, openAddTodo, openAddUnit],
  );

  const intentHighlightTarget = usePendingCalendarIntent({
    hasHydrated,
    widgetRefs: calendarIntentWidgetRefs,
    openStates: calendarIntentOpenStates,
    openForms: calendarIntentOpenForms,
    prepareForIntent: prepareForPendingIntent,
  });

  // 6. Getters Hook
  const {
    formatDayNumber,
    formatMonthYear,
    formatWeekRange,
    formatWeekdayShort,
    formatWeekdayLong,
    formatTimeShort,
  } = useCalendarGetters(filteredUnits, filteredDeadlines, filteredEvents);

  // 7. Live Collaboration Hook - activates when a shared schedule is selected
  // scheduleId is null until shared schedules feature is enabled (no-op when null)
  const currentProfile = useProfilesStore((s) => {
    const id = s.currentProfileId;
    return id ? (s.profiles.find((p) => p.id === id) ?? null) : null;
  });
  const collabUserProfile = currentProfile
    ? {
        id: currentProfile.id,
        name: currentProfile.name,
        avatar: currentProfile.avatar,
      }
    : null;
  const { activeUsers } = useLiveCollaboration(
    null, // scheduleId — set to a real ID when shared schedules UI is built
    collabUserProfile,
  );

  // Local Helpers — memoized so stable references are passed to child components.
  const handleDeleteAssignment = useCallback(
    (assignment: Deadline) => {
      setAssignmentToDelete(assignment);
      setAssignmentDeleteConfirmOpen(true);
    },
    [setAssignmentToDelete, setAssignmentDeleteConfirmOpen],
  );

  const confirmDeleteAssignment = useCallback(() => {
    if (assignmentToDelete) {
      removeDeadline(assignmentToDelete.id);
      setAssignmentDeleteConfirmOpen(false);
      setAssignmentToDelete(null);
    }
  }, [assignmentToDelete, removeDeadline, setAssignmentDeleteConfirmOpen, setAssignmentToDelete]);

  const handleDeleteExam = useCallback(
    (exam: Deadline) => {
      setExamToDelete(exam);
      setExamDeleteConfirmOpen(true);
    },
    [setExamToDelete, setExamDeleteConfirmOpen],
  );

  const confirmDeleteExam = useCallback(() => {
    if (examToDelete) {
      removeDeadline(examToDelete.id);
      setExamDeleteConfirmOpen(false);
      setExamToDelete(null);
    }
  }, [examToDelete, removeDeadline, setExamDeleteConfirmOpen, setExamToDelete]);

  const confirmDeleteDeadline = useCallback(() => {
    if (deadlineToDelete) {
      removeDeadline(deadlineToDelete.id);
      setDeadlineDeleteConfirmOpen(false);
      setDeadlineToDelete(null);
    }
  }, [deadlineToDelete, removeDeadline, setDeadlineDeleteConfirmOpen, setDeadlineToDelete]);

  const handleDeleteEvent = useCallback(
    (event: Event) => {
      setEventToDelete(event);
      setEventDeleteConfirmOpen(true);
    },
    [setEventToDelete, setEventDeleteConfirmOpen],
  );

  const confirmDeleteEvent = useCallback(() => {
    if (eventToDelete) {
      removeEvent(eventToDelete.id);
      setEventDeleteConfirmOpen(false);
      setEventToDelete(null);
    }
  }, [eventToDelete, removeEvent, setEventDeleteConfirmOpen, setEventToDelete]);

  const handleDeleteTodo = useCallback(
    (todo: Todo) => {
      setTodoToDelete({ id: todo.id, title: todo.title });
      setTodoDeleteConfirmOpen(true);
    },
    [setTodoToDelete, setTodoDeleteConfirmOpen],
  );

  // No-op stub — notification logic will be wired up when the feature ships.
  const handleNotifyTodo = useCallback((_todo: Todo) => {}, []);

  const confirmDeleteUnit = useCallback(() => {
    if (unitToDelete) {
      // Cascade-delete all deadlines for this unit, then remove the unit itself
      removeDeadlinesByUnit(unitToDelete.id, unitToDelete.code);
      removeUnit(unitToDelete.id);
      setDeleteConfirmOpen(false);
      setUnitToDelete(null);
    }
  }, [unitToDelete, removeDeadlinesByUnit, removeUnit, setDeleteConfirmOpen, setUnitToDelete]);

  const handleUnitDetailOpenChange = useCallback(
    (open: boolean) => setUnitDetailOpen(open),
    [setUnitDetailOpen],
  );

  // Get unit schedules for a specific day (week-view column renderer)
  const getUnitsForDay = useCallback(
    (date: Date) => {
      const dayName = dayjs(date).locale('en').format('dddd');
      return filteredUnits.flatMap((unit) =>
        unit.schedule
          .filter((s: ClassTime) => s.day === dayName)
          .map((s: ClassTime) => ({ ...unit, schedule: [s] })),
      );
    },
    [filteredUnits],
  );

  const getItemsForDay = useCallback(
    (date: Date) => {
      const dayDeadlines = filteredDeadlines.filter((d) => dayjs(d.dueDate).isSame(date, 'day'));
      const dayEvents = filteredEvents.filter((e) => {
        const eventDate = e.startAt || e.date;
        return dayjs(eventDate).isSame(date, 'day');
      });
      return { dayDeadlines, dayEvents };
    },
    [filteredDeadlines, filteredEvents],
  );

  if (!hasHydrated) {
    return null;
  }

  return (
    <div className="flex flex-col bg-mq-background min-h-dvh md:min-h-0 md:h-full">
      {/* Mobile Header (Date Selector) */}
      <div className="md:hidden flex flex-col bg-mq-card-background border-b border-mq-border sticky top-0 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-mq-content sm:text-xl">
            {formatMonthYear(dayjs(currentWeekStart).add(mobileSelectedDayIndex, 'day').toDate())}
          </h1>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={view === 'day' ? goToPreviousDay : goToPreviousWeek}
            >
              <ChevronLeft className="h-5 w-5 text-mq-content" />
            </Button>
            {view === 'day' ? (
              <Button variant="outline" size="sm" onClick={goToToday} disabled={isToday}>
                {t('today')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={goToThisWeek} disabled={isCurrentWeek}>
                {t('thisWeek')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={view === 'day' ? goToNextDay : goToNextWeek}
            >
              <ChevronRight className="h-5 w-5 text-mq-content" />
            </Button>
          </div>
        </div>

        {/* Mobile Days Row */}
        <div className="flex overflow-x-auto pb-2 px-2 gap-2 scrollbar-hide -webkit-overflow-scrolling-touch">
          {weekDays.map((date, index) => {
            const isSelected = index === mobileSelectedDayIndex;
            // Renamed from `isToday` to avoid shadowing the outer `isToday` from useCalendarView
            const isDayToday = dayjs(date).isSame(dayjs(), 'day');

            return (
              <button
                key={index}
                onClick={() => setMobileSelectedDayIndex(index)}
                aria-label={`${formatWeekdayLong(date)} ${formatDayNumber(date)}${isDayToday ? ` (${t('today')})` : ''}`}
                aria-pressed={isSelected}
                className={cn(
                  'flex flex-col items-center justify-center min-w-[3.5rem] py-2 rounded-lg transition-colors',
                  isSelected
                    ? 'bg-mq-primary text-white'
                    : 'bg-mq-background text-mq-content hover:bg-mq-background-hover',
                  isDayToday && !isSelected && 'border border-mq-primary text-mq-primary',
                )}
              >
                <span className="text-xs font-medium opacity-80" aria-hidden="true">
                  {formatWeekdayShort(date)}
                </span>
                <span className="text-lg font-bold" aria-hidden="true">
                  {formatDayNumber(date)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block shrink-0 bg-mq-background px-4 pb-4 pt-4 lg:px-6 lg:pt-6 border-b border-mq-border">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-mq-content lg:text-3xl">
                {formatMonthYear(currentWeekStart)}
              </h1>
              <p className="text-mq-content-secondary mt-1">{formatWeekRange(currentWeekStart)}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:gap-3">
              <div className="flex flex-wrap bg-mq-card-background rounded-lg p-1 border border-mq-border">
                <Button
                  variant={view === 'day' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewChange('day')}
                  className="text-sm"
                  aria-pressed={view === 'day'}
                >
                  {t('dayView')}
                </Button>
                <Button
                  variant={view === 'week' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewChange('week')}
                  className="text-sm"
                  aria-pressed={view === 'week'}
                >
                  {t('weekView')}
                </Button>
                <Button
                  variant={view === 'agenda' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewChange('agenda')}
                  className="text-sm"
                  aria-pressed={view === 'agenda'}
                >
                  {t('agendaView')}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={view === 'day' ? goToPreviousDay : goToPreviousWeek}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {view === 'day' ? (
                  <Button variant="outline" size="sm" onClick={goToToday} disabled={isToday}>
                    {t('today')}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToThisWeek}
                    disabled={isCurrentWeek}
                  >
                    {t('thisWeek')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={view === 'day' ? goToNextDay : goToNextWeek}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Active collaborators indicator */}
              {activeUsers.length > 0 && (
                <div
                  className="flex items-center gap-1"
                  aria-label={t('activeCollaboratorsCount', { count: activeUsers.length })}
                >
                  <div className="flex -space-x-2">
                    {activeUsers.slice(0, 4).map((user) => (
                      <div
                        key={user.id}
                        className="w-7 h-7 rounded-full border-2 border-mq-card-background flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: user.color }}
                        title={user.name}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {activeUsers.length > 4 && (
                      <div className="w-7 h-7 rounded-full border-2 border-mq-card-background bg-mq-content-secondary flex items-center justify-center text-[10px] font-bold text-white">
                        +{activeUsers.length - 4}
                      </div>
                    )}
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              )}

              <Button
                variant={isFiltersOpen ? 'secondary' : 'outline'}
                onClick={handleToggleFilters}
                className="gap-2 whitespace-nowrap"
              >
                <Calendar className="h-4 w-4 text-mq-content" />
                {t('filter')}
              </Button>
            </div>
          </div>

          <div className="pt-2">
            <FilterPanel
              filters={filters}
              onFilterChange={setFilters}
              isOpen={isFiltersOpen}
              onClose={handleToggleFilters}
            />
          </div>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row md:overflow-hidden">
        <div className="order-1 flex-1 min-w-0 overflow-visible p-4 pb-24 scrollbar-hide md:p-6 md:pb-6 md:overflow-x-hidden md:overflow-y-auto">
          {/* Week View */}
          {view === 'week' && (
            <ScrollReveal>
              <div className="overflow-x-auto pb-4">
                <div className="grid grid-cols-7 gap-3 min-w-[900px]">
                  {weekDays.map((date, index) => {
                    const { dayDeadlines, dayEvents } = getItemsForDay(date);
                    const dayUnits = getUnitsForDay(date);
                    const isToday = dayjs(date).isSame(dayjs(), 'day');

                    // Get MQ key dates for this day (filtered by program)
                    const dayMQDates = filters.showMQKeyDates
                      ? getMQKeyDatesForDay(date)
                          .filter((d) => d.category !== 'classes')
                          .filter(
                            (d) => !filters.mqPrograms || filters.mqPrograms.includes(d.program),
                          )
                      : [];

                    return (
                      <div
                        key={index}
                        className={cn(
                          'flex flex-col gap-2 p-3 rounded-xl border min-h-[150px] min-w-[120px] transition-colors',
                          isToday
                            ? 'bg-mq-primary/5 border-mq-primary/20'
                            : 'bg-mq-card-background border-mq-border hover:border-mq-primary/30',
                        )}
                      >
                        <div className="flex flex-col items-center mb-2">
                          <span className="text-xs font-medium text-mq-content-secondary uppercase">
                            {formatWeekdayShort(date)}
                          </span>
                          <span
                            className={cn(
                              'text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full mt-1',
                              isToday ? 'bg-mq-primary text-white' : 'text-mq-content',
                            )}
                          >
                            {formatDayNumber(date)}
                          </span>
                        </div>

                        <div className="flex-1 flex flex-col gap-2">
                          {/* MQ Key Dates */}
                          {dayMQDates.map((mqDate) => {
                            const categoryColors = MQ_DATE_COLORS[mqDate.category];
                            const programStyle = PROGRAM_STYLES[mqDate.program];
                            const categoryLabel =
                              t(`mqCat_${mqDate.category}` as TranslationKey) || mqDate.category;
                            return (
                              <div
                                key={mqDate.id}
                                className={cn(
                                  'text-xs p-2 rounded-lg border-l-[3px]',
                                  programStyle.bgLight,
                                )}
                                style={{
                                  borderLeftColor: programStyle.bg.replace('bg-', '').includes('-')
                                    ? `var(--${programStyle.bg.replace('bg-', '')})`
                                    : undefined,
                                }}
                                title={mqDate.description || `${mqDate.event} - ${mqDate.term}`}
                              >
                                <div className="flex items-center gap-1 mb-1">
                                  <span className="text-sm" aria-hidden="true">
                                    {programStyle.icon}
                                  </span>
                                  <span
                                    className={cn(
                                      'text-[8px] font-bold uppercase px-1 py-0.5 rounded',
                                      categoryColors.bg,
                                      categoryColors.text,
                                    )}
                                  >
                                    {categoryLabel}
                                  </span>
                                </div>
                                <div className={cn('font-medium truncate', programStyle.text)}>
                                  {mqDate.event}
                                </div>
                                <div
                                  className={cn(
                                    'text-[10px] opacity-70 truncate',
                                    programStyle.text,
                                  )}
                                >
                                  {mqDate.term}
                                </div>
                              </div>
                            );
                          })}

                          {/* Units */}
                          {dayUnits.map((item) => (
                            <div
                              key={`unit-${item.id}-${(item.schedule[0] as ClassTime).startTime}`}
                              onClick={() => {
                                setSelectedUnit(item);
                                setUnitDetailOpen(true);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedUnit(item);
                                  setUnitDetailOpen(true);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className="text-xs p-2 rounded-lg bg-mq-background border border-mq-border cursor-pointer hover:border-mq-primary transition-colors group"
                              style={{
                                borderLeftColor: item.color,
                                borderLeftWidth: '3px',
                              }}
                            >
                              <div className="font-semibold truncate">{item.code}</div>
                              <div className="text-[10px] text-mq-content-secondary truncate">
                                {item.location?.building} {item.location?.room}
                              </div>
                              <div className="text-[10px] text-mq-content-secondary mt-1 group-hover:text-mq-primary">
                                {(item.schedule[0] as ClassTime).startTime}
                              </div>
                            </div>
                          ))}

                          {/* Deadlines */}
                          {dayDeadlines.map((deadline) => (
                            <div
                              key={deadline.id}
                              ref={(el) => {
                                if (el && deadlineRefs.current) {
                                  deadlineRefs.current.set(deadline.id, el);
                                }
                              }}
                              onClick={() => {
                                if (deadline.type === 'Exam' || deadline.type === 'Quiz') {
                                  setSelectedExam(deadline);
                                  setExamDetailOpen(true);
                                } else {
                                  setSelectedAssignment(deadline);
                                  setAssignmentDetailOpen(true);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  if (deadline.type === 'Exam' || deadline.type === 'Quiz') {
                                    setSelectedExam(deadline);
                                    setExamDetailOpen(true);
                                  } else {
                                    setSelectedAssignment(deadline);
                                    setAssignmentDetailOpen(true);
                                  }
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className={cn(
                                'text-xs p-2 rounded-lg border cursor-pointer transition-all',
                                highlightedDeadlineId === deadline.id
                                  ? 'ring-2 ring-mq-primary shadow-lg scale-[1.02]'
                                  : 'hover:scale-[1.02]',
                              )}
                              style={{
                                backgroundColor: `${deadline.type === 'Exam' ? '#ef4444' : '#3b82f6'}15`,
                                borderColor: `${deadline.type === 'Exam' ? '#ef4444' : '#3b82f6'}30`,
                                borderLeftWidth: '3px',
                                borderLeftColor: deadline.type === 'Exam' ? '#ef4444' : '#3b82f6',
                              }}
                            >
                              <div className="font-medium truncate">{deadline.title}</div>
                              <div className="flex items-center gap-1 text-[10px] text-mq-content-secondary mt-1">
                                <Clock className="h-3 w-3" />
                                {formatTimeShort(new Date(deadline.dueDate))}
                              </div>
                            </div>
                          ))}

                          {/* Events */}
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              onClick={() => handleEventClick(event)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleEventClick(event);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className="text-xs p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 border-l-emerald-500 border-l-[3px] cursor-pointer hover:bg-emerald-500/20 transition-colors"
                            >
                              <div className="font-medium truncate">{event.title}</div>
                              {event.startAt && (
                                <div className="text-[10px] text-mq-content-secondary mt-1">
                                  {formatTimeShort(new Date(event.startAt))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollReveal>
          )}

          {/* Day View */}
          {view === 'day' && (
            <DayView
              date={dayjs(currentWeekStart).add(mobileSelectedDayIndex, 'day').toDate()}
              units={filteredUnits}
              deadlines={filteredDeadlines}
              events={filteredEvents}
              todos={todos}
              onUnitClick={(u) => {
                setSelectedUnit(u);
                setUnitDetailOpen(true);
              }}
              onDeadlineClick={(d) => {
                if (d.type === 'Exam' || d.type === 'Quiz') {
                  setSelectedExam(d);
                  setExamDetailOpen(true);
                } else {
                  setSelectedAssignment(d);
                  setAssignmentDetailOpen(true);
                }
              }}
              onEventClick={handleEventClick}
              onTodoClick={(todo) => {
                setSelectedTodo(todo);
                setTodoDetailOpen(true);
              }}
              onGoToToday={goToToday}
              showMQKeyDates={filters.showMQKeyDates}
              mqProgramFilter={filters.mqPrograms}
            />
          )}

          {/* Agenda View */}
          {view === 'agenda' && (
            <AgendaView
              date={currentWeekStart}
              units={filteredUnits}
              deadlines={filteredDeadlines}
              events={filteredEvents}
              onUnitClick={(u) => {
                setSelectedUnit(u);
                setUnitDetailOpen(true);
              }}
              onDeadlineClick={(d) => {
                if (d.type === 'Exam' || d.type === 'Quiz') {
                  setSelectedExam(d);
                  setExamDetailOpen(true);
                } else {
                  setSelectedAssignment(d);
                  setAssignmentDetailOpen(true);
                }
              }}
              onEventClick={handleEventClick}
              showMQKeyDates={filters.showMQKeyDates}
              mqProgramFilter={filters.mqPrograms}
            />
          )}
        </div>

        {/* Sticky Sidebar with Widgets */}
        <CalendarSidebar className="order-2 lg:order-none">
          <CalendarWidgets
            onAddAssignment={openAddAssignment}
            onEditAssignment={openEditAssignment}
            onOpenAssignmentDetail={openAssignmentDetail}
            onAddExam={openAddExam}
            onEditExam={openEditExam}
            onOpenExamDetail={(exam) => {
              setSelectedExam(exam);
              setExamDetailOpen(true);
            }}
            onAddUnit={openAddUnit}
            onEditUnit={openEditUnit}
            onOpenUnitDetail={(u) => {
              setSelectedUnit(u);
              setUnitDetailOpen(true);
            }}
            onDeleteUnit={handleDeleteUnit}
            onAddEvent={openAddEvent}
            onEditEvent={openEditEvent}
            onOpenEventDetail={handleEventClick}
            onDeleteEvent={handleDeleteEvent}
            onDeleteAssignment={handleDeleteAssignment}
            onDeleteExam={handleDeleteExam}
            onEditTodo={openEditTodo}
            onAddTodo={openAddTodo}
            onOpenTodoDetail={(todo) => {
              setSelectedTodo(todo);
              setTodoDetailOpen(true);
            }}
            onDeleteTodo={handleDeleteTodo}
            onNotifyTodo={handleNotifyTodo}
            unitsWidgetRef={unitsWidgetRef}
            assignmentsWidgetRef={assignmentsWidgetRef}
            examsWidgetRef={examsWidgetRef}
            eventsWidgetRef={eventsWidgetRef}
            remindersWidgetRef={remindersWidgetRef}
            intentHighlightTarget={intentHighlightTarget}
          />
        </CalendarSidebar>
      </div>

      {/* Deadline Form Dialog */}
      <DeadlineForm
        open={deadlineDialogOpen}
        onOpenChange={setDeadlineDialogOpen}
        editDeadline={editDeadline}
      />

      {/* Assignment Form Dialog */}
      <AssignmentForm
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        editAssignment={editAssignment}
      />

      {/* Exam Form Dialog */}
      <ExamForm open={examDialogOpen} onOpenChange={setExamDialogOpen} editExam={editExam} />

      {/* Event Form Dialog */}
      <EventForm open={eventDialogOpen} onOpenChange={setEventDialogOpen} editEvent={editEvent} />

      {/* Unit Form Dialog */}
      <UnitForm open={unitDialogOpen} onOpenChange={setUnitDialogOpen} editUnit={editingUnit} />

      {/* Unit Detail Panel */}
      <UnitDetailPanel
        unit={selectedUnit}
        open={unitDetailOpen}
        onOpenChange={handleUnitDetailOpenChange}
        onEditDeadline={(deadline) => {
          if (deadline.type === 'Exam' || deadline.type === 'Quiz') {
            setSelectedExam(deadline);
            setExamDetailOpen(true);
          } else {
            setSelectedAssignment(deadline);
            setAssignmentDetailOpen(true);
          }
        }}
        onEditUnit={() => {
          if (selectedUnit) {
            handleUnitDetailOpenChange(false);
            openEditUnit(selectedUnit);
          }
        }}
        onDeleteUnit={() => {
          if (selectedUnit) {
            handleUnitDetailOpenChange(false);
            handleDeleteUnit(selectedUnit);
          }
        }}
      />

      {/* Delete Confirmation Modals — portaled to body to escape the overflow-y-auto
          layout container, preventing iOS Safari scroll-jump on mount */}
      {deleteConfirmOpen &&
        unitToDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-0 dark:backdrop-blur-sm p-4">
            <div className="bg-mq-background dark:bg-mq-card-background border border-mq-border rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/25 dark:ring-2 dark:ring-red-400/60">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-100" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-mq-content">
                    {t('deleteUnitConfirm')}
                  </h3>
                  <p className="text-sm text-mq-content-secondary">
                    {unitToDelete.code} - {unitToDelete.name}
                  </p>
                </div>
              </div>
              <p className="text-sm text-mq-content-secondary mb-6">{t('deleteUnitConfirmDesc')}</p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setUnitToDelete(null);
                  }}
                >
                  {t('cancelAction')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteUnit}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  {t('confirmDelete')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {assignmentDeleteConfirmOpen &&
        assignmentToDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-0 dark:backdrop-blur-sm p-4">
            <div className="bg-mq-background dark:bg-mq-card-background border border-mq-border rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/25 dark:ring-2 dark:ring-red-400/60">
                  <Trash2 className="h-6 w-6 text-red-600 dark:text-red-100" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-mq-content">
                    {t('deleteAssignmentConfirm' as TranslationKey)}
                  </h3>
                  <p className="text-sm text-mq-content-secondary">{assignmentToDelete.title}</p>
                </div>
              </div>
              <p className="text-sm text-mq-content-secondary mb-6">
                {t('deleteAssignmentConfirmDesc' as TranslationKey)}
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAssignmentDeleteConfirmOpen(false);
                    setAssignmentToDelete(null);
                  }}
                >
                  {t('cancelAction')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteAssignment}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  {t('confirmDelete')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {examDeleteConfirmOpen &&
        examToDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-0 dark:backdrop-blur-sm p-4">
            <div className="bg-mq-background dark:bg-mq-card-background border border-mq-border rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/25 dark:ring-2 dark:ring-red-400/60">
                  <Trash2 className="h-6 w-6 text-red-600 dark:text-red-100" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-mq-content">
                    {t('deleteExamConfirm' as TranslationKey)}
                  </h3>
                  <p className="text-sm text-mq-content-secondary">{examToDelete.title}</p>
                </div>
              </div>
              <p className="text-sm text-mq-content-secondary mb-6">
                {t('deleteExamConfirmDesc' as TranslationKey)}
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setExamDeleteConfirmOpen(false);
                    setExamToDelete(null);
                  }}
                >
                  {t('cancelAction')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteExam}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  {t('confirmDelete')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {deadlineDeleteConfirmOpen &&
        deadlineToDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-0 dark:backdrop-blur-sm p-4">
            <div className="bg-mq-background dark:bg-mq-card-background border border-mq-border rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/25 dark:ring-2 dark:ring-red-400/60">
                  <Trash2 className="h-6 w-6 text-red-600 dark:text-red-100" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-mq-content">
                    {t('deleteDeadlineConfirm' as TranslationKey)}
                  </h3>
                  <p className="text-sm text-mq-content-secondary">{deadlineToDelete.title}</p>
                </div>
              </div>
              <p className="text-sm text-mq-content-secondary mb-6">
                {t('deleteDeadlineConfirmDesc' as TranslationKey)}
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeadlineDeleteConfirmOpen(false);
                    setDeadlineToDelete(null);
                  }}
                >
                  {t('cancelAction')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteDeadline}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  {t('confirmDelete')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {eventDeleteConfirmOpen &&
        eventToDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-0 dark:backdrop-blur-sm p-4">
            <div className="bg-mq-background dark:bg-mq-card-background border border-mq-border rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/25 dark:ring-2 dark:ring-red-400/60">
                  <Trash2 className="h-6 w-6 text-red-600 dark:text-red-100" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-mq-content">
                    {t('deleteEventConfirm' as TranslationKey)}
                  </h3>
                  <p className="text-sm text-mq-content-secondary">{eventToDelete.title}</p>
                </div>
              </div>
              <p className="text-sm text-mq-content-secondary mb-6">
                {t('deleteEventConfirmDesc' as TranslationKey)}
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEventDeleteConfirmOpen(false);
                    setEventToDelete(null);
                  }}
                >
                  {t('cancelAction')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteEvent}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  {t('confirmDelete')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {todoDeleteConfirmOpen &&
        todoToDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-0 dark:backdrop-blur-sm p-4">
            <div className="bg-mq-background dark:bg-mq-card-background border border-mq-border rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/25 dark:ring-2 dark:ring-red-400/60">
                  <Trash2 className="h-6 w-6 text-red-600 dark:text-red-100" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-mq-content">
                    {t('deleteTodoConfirm')}
                  </h3>
                  <p className="text-sm text-mq-content-secondary">{todoToDelete.title}</p>
                </div>
              </div>
              <p className="text-sm text-mq-content-secondary mb-6">{t('deleteTodoConfirmDesc')}</p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTodoDeleteConfirmOpen(false);
                    setTodoToDelete(null);
                  }}
                >
                  {t('cancelAction')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (todoToDelete) {
                      removeTodo(todoToDelete.id);
                      setTodoDeleteConfirmOpen(false);
                      setTodoToDelete(null);
                    }
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  {t('confirmDelete')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Todo Modal */}
      <Dialog
        open={todoDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTodoDialogOpen(false);
            setEditingTodo(null);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                <Edit2 className="h-5 w-5 text-emerald-600" />
              </div>
              {editingTodo ? t('editTodo') : t('addTodo')}
            </DialogTitle>
          </DialogHeader>
          <form
            method="post"
            onSubmit={async (e) => {
              e.preventDefault();
              if (editTodoTitle.trim() && editTodoDueDate && !todoSaving) {
                setTodoSaving(true);
                try {
                  // Build due date (required).
                  // Use dayjs to parse the date string in LOCAL time — `new Date('YYYY-MM-DD')`
                  // parses as UTC midnight, which becomes the previous day in timezones west of UTC.
                  const [hours, minutes] = editTodoDueTime
                    ? editTodoDueTime.split(':').map(Number)
                    : [23, 59];
                  const dueDate = dayjs(editTodoDueDate)
                    .hour(hours)
                    .minute(minutes)
                    .second(editTodoDueTime ? 0 : 59)
                    .millisecond(editTodoDueTime ? 0 : 999)
                    .toDate();

                  if (editingTodo) {
                    await updateTodo(editingTodo.id, {
                      title: editTodoTitle.trim(),
                      priority: editTodoPriority,
                      dueDate,
                      color: editTodoColor,
                    });
                  } else {
                    await addTodo({
                      title: editTodoTitle.trim(),
                      priority: editTodoPriority,
                      dueDate,
                      color: editTodoColor,
                    });
                  }

                  setTodoDialogOpen(false);
                  setEditingTodo(null);
                  setEditTodoTitle('');
                  setEditTodoPriority('Medium');
                  setEditTodoDueDate('');
                  setEditTodoDueTime('');
                  setEditTodoColor('#10b981');
                } finally {
                  setTodoSaving(false);
                }
              }
            }}
            className="space-y-3 sm:space-y-4"
          >
            {/* Task Title - Required */}
            <div>
              <label
                htmlFor="edit-todo-title"
                className="block text-sm font-medium text-mq-content mb-1"
              >
                {t('taskTitle')} <span className="text-mq-error">*</span>
              </label>
              <input
                id="edit-todo-title"
                type="text"
                value={editTodoTitle}
                onChange={(e) => setEditTodoTitle(e.target.value)}
                placeholder={t('enterTaskTitle')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-mq-border bg-mq-background focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                autoFocus
                required
              />
            </div>

            {/* Priority */}
            <div>
              <label
                htmlFor="edit-todo-priority"
                className="block text-sm font-medium text-mq-content mb-1"
              >
                {t('priority')}
              </label>
              <select
                id="edit-todo-priority"
                value={editTodoPriority}
                onChange={(e) => setEditTodoPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-lg border border-mq-border bg-mq-background focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
                  editTodoPriority === 'High' && 'text-red-600 dark:text-red-400',
                  editTodoPriority === 'Medium' && 'text-amber-600 dark:text-amber-400',
                  editTodoPriority === 'Low' && 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                <option value="High">{t('priorityHigh')}</option>
                <option value="Medium">{t('priorityMedium')}</option>
                <option value="Low">{t('priorityLow')}</option>
              </select>
            </div>

            {/* Due Date and Time - Required */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-mq-content">
                {t('dueDateTime')} <span className="text-mq-error">*</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex items-center gap-2 w-full sm:w-40">
                  <Calendar className="h-4 w-4 text-mq-content-secondary shrink-0" />
                  <input
                    type="date"
                    value={editTodoDueDate}
                    onChange={(e) => setEditTodoDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-mq-border bg-mq-background focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    aria-label={t('selectDueDate')}
                    required
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Clock className="h-4 w-4 text-mq-content-secondary shrink-0" />
                  <input
                    type="time"
                    value={editTodoDueTime}
                    onChange={(e) => setEditTodoDueTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-mq-border bg-mq-background focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    aria-label={t('selectDueTime')}
                  />
                </div>
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-mq-content mb-2">{t('color')}</label>
              <div className="flex gap-2 overflow-x-auto pb-2 px-2 pt-2 scrollbar-thin scrollbar-thumb-mq-border">
                {UNIT_COLORS.map((colorOption) => (
                  <button
                    key={colorOption.value}
                    type="button"
                    onClick={() => setEditTodoColor(colorOption.value)}
                    className={cn(
                      'w-8 h-8 rounded-full border transition-transform hover:scale-110',
                      editTodoColor === colorOption.value
                        ? 'ring-2 ring-offset-2 ring-offset-mq-background ring-mq-primary scale-110'
                        : 'border-transparent',
                    )}
                    style={{ backgroundColor: colorOption.value }}
                    aria-label={t('selectColorAria', {
                      color: t(colorOption.translationKey as TranslationKey),
                    })}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  setTodoDialogOpen(false);
                  setEditingTodo(null);
                }}
                disabled={todoSaving}
              >
                {t('cancelAction')}
              </Button>
              <Button type="submit" variant="outline" disabled={todoSaving}>
                {todoSaving
                  ? editingTodo
                    ? t('saving')
                    : t('adding')
                  : editingTodo
                    ? t('saveChanges')
                    : t('addTodo')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Todo Detail Panel */}
      <TodoDetailPanel
        todo={selectedTodo}
        open={todoDetailOpen}
        onOpenChange={setTodoDetailOpen}
        onEdit={(todo) => {
          setTodoDetailOpen(false);
          openEditTodo(todo);
        }}
        onDelete={(todo) => {
          setTodoDetailOpen(false);
          handleDeleteTodo(todo);
        }}
      />

      {/* Assignment Detail Panel */}
      <AssignmentDetailPanel
        assignment={selectedAssignment}
        open={assignmentDetailOpen}
        onOpenChange={setAssignmentDetailOpen}
        onEdit={(assignment) => {
          setAssignmentDetailOpen(false);
          openEditAssignment(assignment);
        }}
        onDelete={(assignment) => {
          setAssignmentDetailOpen(false);
          handleDeleteAssignment(assignment);
        }}
        onUnitClick={(unitCode) => {
          const clickedUnit = units.find((u) => u.code === unitCode);
          if (clickedUnit) {
            setAssignmentDetailOpen(false);
            setSelectedUnit(clickedUnit);
            setUnitDetailOpen(true);
          }
        }}
      />

      {/* Exam Detail Panel */}
      <ExamDetailPanel
        exam={selectedExam}
        open={examDetailOpen}
        onOpenChange={setExamDetailOpen}
        onEdit={(exam) => {
          setExamDetailOpen(false);
          openEditExam(exam);
        }}
        onDelete={(exam) => {
          setExamDetailOpen(false);
          handleDeleteExam(exam);
        }}
        onUnitClick={(unitCode) => {
          const clickedUnit = units.find((u) => u.code === unitCode);
          if (clickedUnit) {
            setExamDetailOpen(false);
            setSelectedUnit(clickedUnit);
            setUnitDetailOpen(true);
          }
        }}
      />

      {/* Event Detail Panel */}
      <EventDetailPanel
        event={selectedEvent}
        open={eventDetailOpen}
        onOpenChange={setEventDetailOpen}
        onEdit={
          selectedEvent?.sourcePublicEventId
            ? undefined
            : (event) => {
                setEventDetailOpen(false);
                openEditEvent(event);
              }
        }
        onDelete={(event) => {
          setEventDetailOpen(false);
          handleDeleteEvent(event);
        }}
      />
    </div>
  );
}
