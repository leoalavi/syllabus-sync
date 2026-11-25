import { useEffect, useCallback, useRef } from 'react';
import { useDeadlinesStore } from '@/lib/store/deadlinesStore';
import { useEventsStore } from '@/lib/store/eventsStore';
import { useUnitsStore } from '@/lib/store/unitsStore';
import { useTodosStore } from '@/lib/store/todosStore';
import { useHydration } from '@/lib/hooks';
import { createBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

export function useCalendarData() {
  const deadlines = useDeadlinesStore((state) => state.deadlines);
  const revalidateDeadlines = useDeadlinesStore((state) => state.revalidate);
  const removeDeadline = useDeadlinesStore((state) => state.removeDeadline);
  const removeDeadlinesByUnit = useDeadlinesStore((state) => state.removeDeadlinesByUnit);

  const userEvents = useEventsStore((state) => state.events);
  const revalidateEvents = useEventsStore((state) => state.revalidate);
  const removeEvent = useEventsStore((state) => state.removeEvent);

  const units = useUnitsStore((state) => state.units);
  const revalidateUnits = useUnitsStore((state) => state.revalidate);
  const removeUnit = useUnitsStore((state) => state.removeUnit);

  const todos = useTodosStore((state) => state.todos);
  const revalidateTodos = useTodosStore((state) => state.revalidate);
  const addTodo = useTodosStore((state) => state.addTodo);
  const removeTodo = useTodosStore((state) => state.removeTodo);
  const updateTodo = useTodosStore((state) => state.updateTodo);

  const hasHydrated = useHydration();
  const initialLoadDone = useRef(false);

  // Refresh all data from the database on mount (concurrent requests are shared)
  useEffect(() => {
    if (hasHydrated && !initialLoadDone.current) {
      initialLoadDone.current = true;
      revalidateUnits();
      revalidateDeadlines();
      revalidateEvents();
      revalidateTodos();
    }
  }, [hasHydrated, revalidateUnits, revalidateDeadlines, revalidateEvents, revalidateTodos]);

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
        revalidateEvents();
        revalidateTodos();
      }
    });

    return () => subscription.unsubscribe();
  }, [revalidateUnits, revalidateDeadlines, revalidateEvents, revalidateTodos]);

  // Listen for unit-deleted events to cascade delete deadlines
  const handleUnitDeleted = useCallback(
    (event: Event) => {
      const customEvent = event as CustomEvent<{
        unitId: string;
        unitCode: string;
      }>;
      const { unitId, unitCode } = customEvent.detail;
      removeDeadlinesByUnit(unitId, unitCode);
    },
    [removeDeadlinesByUnit],
  );

  useEffect(() => {
    window.addEventListener('unit-deleted', handleUnitDeleted);
    return () => {
      window.removeEventListener('unit-deleted', handleUnitDeleted);
    };
  }, [handleUnitDeleted]);

  return {
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
  };
}
