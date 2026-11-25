import { useEffect, useMemo, useRef } from 'react';
import { useUnitsStore } from '@/lib/store/unitsStore';
import { useDeadlinesStore } from '@/lib/store/deadlinesStore';
import { useTodosStore } from '@/lib/store/todosStore';
import { useEventsStore } from '@/lib/store/eventsStore';
import { useProfilesStore } from '@/lib/store/profilesStore';
import { useGamificationStore } from '@/lib/store/gamificationStore';
import { useHydration } from '@/lib/hooks';
import { createBrowserClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export function useHomeData() {
  const hasHydrated = useHydration();
  const initialLoadDone = useRef(false);

  const units = useUnitsStore((state) => state.units);
  const revalidateUnits = useUnitsStore((state) => state.revalidate);

  const revalidateDeadlines = useDeadlinesStore((state) => state.revalidate);
  const revalidateTodos = useTodosStore((state) => state.revalidate);
  const revalidateEvents = useEventsStore((state) => state.revalidate);
  const fetchProfile = useProfilesStore((state) => state.fetchProfile);
  const loadGamification = useGamificationStore((state) => state.loadProfile);

  // Load all data from database on mount — all calls fire in parallel
  useEffect(() => {
    if (hasHydrated && !initialLoadDone.current) {
      initialLoadDone.current = true;
      // Fire all fetches concurrently for fastest possible load
      revalidateUnits();
      revalidateDeadlines();
      revalidateTodos();
      revalidateEvents();
      fetchProfile();
      loadGamification();
    }
  }, [
    hasHydrated,
    revalidateUnits,
    revalidateDeadlines,
    revalidateTodos,
    revalidateEvents,
    fetchProfile,
    loadGamification,
  ]);

  // Listen for auth state changes and refresh data on sign-in
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_IN') {
        // Refresh all data after sign-in (shares any request already in flight)
        revalidateUnits();
        revalidateDeadlines();
        revalidateTodos();
        revalidateEvents();
        fetchProfile();
        loadGamification();
      }
    });

    return () => subscription.unsubscribe();
  }, [
    revalidateUnits,
    revalidateDeadlines,
    revalidateTodos,
    revalidateEvents,
    fetchProfile,
    loadGamification,
  ]);

  const hasUnits = units.length > 0;

  // Memoized unit stats calculation for better performance
  const unitStats = useMemo(() => {
    try {
      const totalClasses = units.reduce((acc, u) => acc + (u.schedule?.length || 0), 0);
      const totalStudyHours = units.reduce((acc, u) => {
        if (!u.schedule) return acc;
        return (
          acc +
          u.schedule.reduce((hours, s) => {
            try {
              const [startH, startM] = s.startTime.split(':').map(Number);
              const [endH, endM] = s.endTime.split(':').map(Number);

              // Validate time values
              if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
                return hours;
              }

              // Ensure valid time ranges
              if (startH < 0 || startH > 23 || endH < 0 || endH > 23) {
                return hours;
              }

              return hours + Math.max(0, endH - startH + (endM - startM) / 60);
            } catch {
              return hours;
            }
          }, 0)
        );
      }, 0);

      return {
        unitCount: units.length,
        totalClasses,
        studyHours: Math.max(0, Math.round(totalStudyHours)),
      };
    } catch {
      return {
        unitCount: units.length,
        totalClasses: 0,
        studyHours: 0,
      };
    }
  }, [units]);

  return {
    units,
    hasUnits,
    unitStats,
  };
}
