import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';
import { toastUtils } from '@/lib/utils/toast';
import { useGamificationStore, showXPEarnedNotification } from '@/features/gamification/components';
import { useNotificationsStore } from '@/lib/store/notificationsStore';
import { useNotificationPreferencesStore } from '@/lib/store/notificationPreferencesStore';
import { useEventsStore } from '@/lib/store/eventsStore';
import { apiRequest } from '@/lib/utils/api';
import { isValidUUID } from '@/lib/utils/uuid';
import { Event } from '@/lib/types';
import { TimeRange, SortMode, CategoryFilter } from '@/features/feed/components/FeedFilters';

const REMINDER_TIMING_OPTIONS: { labelKey: TranslationKey; value: number }[] = [
  { labelKey: 'timing15min', value: 15 },
  { labelKey: 'timing30min', value: 30 },
  { labelKey: 'timing1hour', value: 60 },
  { labelKey: 'timing2hours', value: 120 },
  { labelKey: 'timing1day', value: 1440 },
  { labelKey: 'timing2days', value: 2880 },
];

export function useFeedLogic() {
  const { t, language } = useTypedTranslation();
  const searchParams = useSearchParams();
  const highlightEventId = searchParams.get('highlight');

  // Filters State
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('upcoming');
  const [sortMode, setSortMode] = useState<SortMode>('soonest');

  // Interactive State
  const [remindedEvents, setRemindedEvents] = useState<Set<string>>(new Set());
  const [loadingEvents, setLoadingEvents] = useState<Set<string>>(new Set());
  const [highlightedEvent, setHighlightedEvent] = useState<string | null>(highlightEventId);

  // Event form state
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  // Ref for scrolling to highlighted event
  const eventRefs = useRef<Map<string, HTMLElement>>(new Map());
  const highlightAttemptsRef = useRef(0);

  // Events store - get all events from Supabase
  const storeEvents = useEventsStore((state) => state.events);
  const removeEvent = useEventsStore((state) => state.removeEvent);
  const loadEvents = useEventsStore((state) => state.loadEvents);
  const eventsHasLoaded = useEventsStore((state) => state.hasLoaded);

  // Ensure events are loaded (previously done eagerly in client-layout)
  useEffect(() => {
    if (!eventsHasLoaded) {
      void loadEvents();
    }
  }, [eventsHasLoaded, loadEvents]);

  // Gamification store - use individual selectors to prevent re-renders
  const isDemo = useGamificationStore((state) => state.isDemo);
  const refreshProfile = useGamificationStore((state) => state.refreshProfile);
  const settings = useGamificationStore((state) => state.settings);

  // Notifications store
  const addNotification = useNotificationsStore((state) => state.addNotification);

  // Notification preferences store - use individual selectors to prevent infinite re-renders
  const eventReminderTiming = useNotificationPreferencesStore((state) => state.eventReminderTiming);
  const eventsEnabled = useNotificationPreferencesStore((state) => state.eventsEnabled);
  const permissionStatus = useNotificationPreferencesStore((state) => state.permissionStatus);
  const pushEnabled = useNotificationPreferencesStore((state) => state.pushEnabled);
  const requestPermission = useNotificationPreferencesStore((state) => state.requestPermission);
  const scheduleEventReminder = useNotificationPreferencesStore(
    (state) => state.scheduleEventReminder,
  );
  const cancelReminder = useNotificationPreferencesStore((state) => state.cancelReminder);

  // Scroll to and highlight the event when component mounts or highlight changes
  useEffect(() => {
    if (highlightEventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHighlightedEvent(highlightEventId);
      setTimeRange('all'); // Use 'all' so past highlighted events are still visible

      highlightAttemptsRef.current = 0;

      // Track all timers so they can be cleaned up on unmount
      const timers: ReturnType<typeof setTimeout>[] = [];

      const scrollToHighlight = () => {
        const eventElement = eventRefs.current.get(highlightEventId);
        if (eventElement) {
          eventElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const clearTimer = setTimeout(() => {
            setHighlightedEvent(null);
          }, 5000);
          timers.push(clearTimer);
          return;
        }
        if (highlightAttemptsRef.current < 3) {
          highlightAttemptsRef.current += 1;
          const retryTimer = setTimeout(scrollToHighlight, 200);
          timers.push(retryTimer);
        }
      };

      const initialTimer = setTimeout(scrollToHighlight, 300);
      timers.push(initialTimer);
      return () => timers.forEach(clearTimeout);
    }
  }, [highlightEventId]);

  // Handle "Remind Me" button click
  const handleRemindMe = useCallback(
    async (eventId: string, eventTitle: string, eventStartAt: Date, eventLocation: string) => {
      const isAlreadyReminded = remindedEvents.has(eventId);

      // Toggle off if already reminded
      if (isAlreadyReminded) {
        setLoadingEvents((prev) => new Set(prev).add(eventId));
        try {
          cancelReminder(eventId);
          setRemindedEvents((prev) => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
          });
        } finally {
          setLoadingEvents((prev) => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
          });
        }
        return;
      }

      if (!pushEnabled || !eventsEnabled) {
        toastUtils.info(t('eventRemindersDisabledTitle'), t('eventRemindersDisabledMsg'));
        return;
      }

      const resolvedPermission =
        permissionStatus === 'default' ? await requestPermission() : permissionStatus;
      if (resolvedPermission !== 'granted') {
        toastUtils.error(t('permissionDenied'), t('permissionDeniedMsg'));
        return;
      }

      const timingOption = REMINDER_TIMING_OPTIONS.find(
        (option) => option.value === eventReminderTiming,
      );
      const timingLabel = timingOption
        ? t(timingOption.labelKey)
        : t('timingMinutes', { minutes: eventReminderTiming });

      // Mark as loading
      setLoadingEvents((prev) => new Set(prev).add(eventId));

      try {
        scheduleEventReminder(eventId, eventTitle, eventLocation, eventStartAt);

        // Create notification - don't provide id (let API generate UUID)
        // Convert relative link to absolute URL for validation (schema requires full URL)
        const notificationLink =
          typeof window !== 'undefined'
            ? `${window.location.origin}/feed?highlight=${encodeURIComponent(eventId)}`
            : undefined;

        // Only include relatedId if eventId is a valid UUID format (sample events use 'event-1' format)
        const hasValidUUID = isValidUUID(eventId);

        await addNotification({
          title: t('reminderTimingUpdated'),
          message: t('reminderTimingUpdatedMsg', { timing: timingLabel }),
          type: 'event',
          read: false,
          ...(notificationLink && { link: notificationLink }),
          ...(hasValidUUID && { relatedId: eventId }),
        });

        // If user is authenticated and the event has a verifiable UUID, award XP
        // (event_attended now requires a concrete event reference for anti-abuse checks)
        if (!isDemo && hasValidUUID) {
          try {
            const response = await apiRequest<{
              message: string;
              result: {
                xpAwarded: number;
                leveledUp: boolean;
                newLevel: number;
              };
            }>('/api/gamification/award-xp', {
              method: 'POST',
              body: JSON.stringify({
                eventType: 'event_attended',
                referenceId: eventId,
                metadata: { eventId, title: eventTitle },
              }),
            });

            // Show XP notification if enabled
            if (settings.showXPNotifications) {
              showXPEarnedNotification(
                response.result.xpAwarded,
                t('eventReminderSetTitle'),
                language,
              );
            }

            // Refresh profile to update XP display
            await refreshProfile();
          } catch {
            // XP error is not critical, continue with reminder
          }
        }

        // Mark event as reminded (works for both demo and authenticated users)
        setRemindedEvents((prev) => new Set(prev).add(eventId));
        toastUtils.success(
          t('reminderTimingUpdated'),
          t('reminderTimingUpdatedMsg', { timing: timingLabel }),
        );
      } catch (error) {
        // Check if it's a "already awarded" error (409 conflict)
        if (error instanceof Error && error.message.includes('already awarded')) {
          setRemindedEvents((prev) => new Set(prev).add(eventId));
          toastUtils.info(t('eventReminderAlreadyTitle'), t('eventReminderAlreadyMsg'));
        } else {
          toastUtils.error(t('eventReminderFailedTitle'), t('eventReminderFailedMsg'));
        }
      } finally {
        setLoadingEvents((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      }
    },
    [
      eventReminderTiming,
      eventsEnabled,
      isDemo,
      permissionStatus,
      pushEnabled,
      cancelReminder,
      requestPermission,
      remindedEvents,
      refreshProfile,
      scheduleEventReminder,
      settings.showXPNotifications,
      language,
      t,
      addNotification,
    ],
  );

  // Get locale string for date formatting
  const getLocaleString = useMemo(() => {
    const localeMap: Record<string, string> = {
      en: 'en-AU',
      es: 'es-ES',
      fa: 'fa-IR',
      zh: 'zh-CN',
      ar: 'ar-SA',
      hi: 'hi-IN',
      ko: 'ko-KR',
      ja: 'ja-JP',
    };
    return localeMap[language] || 'en-AU';
  }, [language]);

  // Filter & Sort Logic
  const filteredEvents = useMemo(() => {
    let result = storeEvents;
    const now = new Date();

    // 1. Time Range
    if (timeRange === 'today') {
      result = result.filter((e) => {
        const d = new Date(e.date);
        return d.toDateString() === now.toDateString();
      });
    } else if (timeRange === 'week') {
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      result = result.filter((e) => {
        const d = new Date(e.date);
        return d >= now && d <= weekFromNow;
      });
    } else if (timeRange === 'upcoming') {
      result = result.filter((e) => new Date(e.date) >= now);
    }

    // 2. Category
    if (activeFilter !== 'All') {
      result = result.filter((event) => event.category === activeFilter);
    }

    // 3. Search (Client-side simple match)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          (e.location && e.location.toLowerCase().includes(q)) ||
          (e.building && e.building.toLowerCase().includes(q)),
      );
    }

    // 4. Sort
    result = [...result].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (sortMode === 'soonest') return dateA - dateB;
      if (sortMode === 'newest') return dateB - dateA; // Approximation, using event date. Ideally "created_at"
      // if (sortMode === 'popular') ... future
      return 0;
    });

    return result;
  }, [storeEvents, activeFilter, timeRange, searchQuery, sortMode]);

  // Filter Counts for Chips
  const filterCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      All: 0,
      Academic: 0,
      Career: 0,
      Social: 0,
      'Free Food': 0,
    };

    // Calculate counts based on current timeRange (but ignoring category filter)
    const timeFiltered = storeEvents.filter((e) => {
      const now = new Date();
      const d = new Date(e.date);
      if (timeRange === 'today') return d.toDateString() === now.toDateString();
      if (timeRange === 'week') return d >= now && d <= new Date(now.getTime() + 7 * 86400000);
      if (timeRange === 'upcoming') return d >= now;
      return true;
    });

    counts.All = timeFiltered.length;
    timeFiltered.forEach((e) => {
      if (counts[e.category as CategoryFilter] !== undefined) {
        counts[e.category as CategoryFilter]++;
      }
    });

    return counts;
  }, [storeEvents, timeRange]);

  // Stats for Sidebar
  const stats = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const thisWeeksEvents = storeEvents.filter((event) => {
      const eventDate = new Date(event.date);
      return eventDate >= now && eventDate <= weekFromNow;
    });

    const freeFoodEvents = storeEvents.filter((event) => event.category === 'Free Food');

    return {
      total: storeEvents.length,
      thisWeek: thisWeeksEvents.length,
      freeFood: freeFoodEvents.length,
    };
  }, [storeEvents]);

  // Category stats for sidebar
  const categoryStats = useMemo(() => {
    const counts = {
      Academic: 0,
      Career: 0,
      Social: 0,
      'Free Food': 0,
    };

    storeEvents.forEach((event) => {
      if (event.category in counts) {
        counts[event.category as keyof typeof counts]++;
      }
    });

    return counts;
  }, [storeEvents]);

  // Handler for category click from sidebar
  const handleCategoryClick = useCallback((category: string) => {
    setActiveFilter(category as CategoryFilter);
  }, []);

  return {
    t,
    language,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    timeRange,
    setTimeRange,
    sortMode,
    setSortMode,
    remindedEvents,
    loadingEvents,
    highlightedEvent,
    eventFormOpen,
    setEventFormOpen,
    editingEvent,
    setEditingEvent,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    eventToDelete,
    setEventToDelete,
    eventRefs,
    storeEvents,
    removeEvent,
    handleRemindMe,
    getLocaleString,
    filteredEvents,
    filterCounts,
    stats,
    categoryStats,
    handleCategoryClick,
  };
}
