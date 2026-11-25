import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STRESS_LEVELS } from '@/lib/constants';
import { Deadline, StressLevel } from '@/lib/types';
import { apiRequest, isLikelyNetworkError, isBrowserOffline } from '@/lib/utils/api';
import { errorHandler } from '@/lib/utils/errorHandling';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getBrowserAuthSnapshot } from '@/lib/supabase/browserSession';
import { useGamificationStore } from '@/lib/store/gamificationStore';
import { useNotificationsStore } from '@/lib/store/notificationsStore';
import { isValidUUID } from '@/lib/utils/uuid';
// NOTE: Sample data fallback removed - authenticated users load from database only
// This ensures proper user isolation and data ownership
let hasLoggedNetworkFallback = false;

interface DeadlinesState {
  deadlines: Deadline[];
  isLoading: boolean;
  hasLoaded: boolean;
  loadDeadlines: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  /** Refetch for a page mount/sign-in, sharing any request already in flight. */
  revalidate: () => Promise<void>;
  addDeadline: (deadline: Deadline) => Promise<Deadline | null>;
  removeDeadline: (id: string) => Promise<void>;
  removeDeadlinesByUnit: (unitId: string, unitCode: string) => void;
  updateDeadline: (id: string, deadline: Partial<Deadline>) => Promise<Deadline | null>;
  toggleComplete: (id: string) => Promise<void>;
  toggleNotification: (id: string) => Promise<void>;
  getUpcoming: (limit?: number) => Deadline[];
  getStressLevel: () => StressLevel;
  clearDeadlines: () => void;
  reset: () => void;
}

const normalizeDeadline = (deadline: Deadline): Deadline => ({
  ...deadline,
  dueDate: deadline.dueDate instanceof Date ? deadline.dueDate : new Date(deadline.dueDate),
  createdAt: deadline.createdAt instanceof Date ? deadline.createdAt : new Date(deadline.createdAt),
});

const shouldSyncDeadlines = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  try {
    const { user } = await getBrowserAuthSnapshot();
    return Boolean(user?.id);
  } catch {
    return false;
  }
};

// One shared in-flight GET. Home/Calendar mount several components that each
// ask for this data in the same render pass; without this they each fired an
// identical request. Mutation recovery still calls forceRefresh() directly,
// which always fetches, so it never receives a pre-mutation response.
let pendingRequest: Promise<void> | null = null;
function shareRequest(run: () => Promise<void>): Promise<void> {
  if (!pendingRequest) {
    pendingRequest = run().finally(() => {
      pendingRequest = null;
    });
  }
  return pendingRequest;
}

export const useDeadlinesStore = create<DeadlinesState>()(
  persist(
    (set, get) => ({
      deadlines: [],
      isLoading: false,
      hasLoaded: false,

      loadDeadlines: () => {
        if (get().hasLoaded) return Promise.resolve();
        return shareRequest(async () => {
          set({ isLoading: true });
          try {
            const data = await apiRequest<Deadline[]>('/api/deadlines', {
              noRetry: true,
            });
            // Ensure loaded data has valid UUIDs (filter out bad ones from API if any)
            const validData = data.map(normalizeDeadline).filter((d) => {
              if (!isValidUUID(d.id)) {
                console.warn(`Filtered out invalid deadline ID from API: ${d.id}`);
                return false;
              }
              return true;
            });

            // Use database data directly - no sample data fallback for authenticated users
            // This ensures proper user isolation and data ownership
            set({ deadlines: validData, hasLoaded: true });
          } catch (error) {
            // Silently fail for auth errors - expected when not logged in
            const isAuthError =
              error instanceof Error &&
              (error.message.includes('401') ||
                error.message.includes('authentication') ||
                error.message.includes('Unauthorized'));

            if (isAuthError) {
              // Auth failure: clear persisted data to prevent showing stale user data
              set({ deadlines: [], hasLoaded: true });
            } else {
              const isNetworkError = isLikelyNetworkError(error) || isBrowserOffline();
              if (!isNetworkError) {
                console.warn('Failed to load deadlines from API:', error);
              } else if (!hasLoggedNetworkFallback) {
                hasLoggedNetworkFallback = true;
                console.warn('Deadlines API unavailable; using persisted data fallback.');
              }
              // Non-auth error: keep persisted data but mark as loaded
              set({ hasLoaded: true });
            }
          } finally {
            set({ isLoading: false });
          }
        });
      },

      revalidate: () => shareRequest(() => get().forceRefresh()),

      // Force refresh from database - clears hasLoaded and reloads
      forceRefresh: async () => {
        set({ isLoading: true, hasLoaded: false });
        try {
          const data = await apiRequest<Deadline[]>('/api/deadlines', {
            noRetry: true,
          });
          const validData = data.map(normalizeDeadline).filter((d) => isValidUUID(d.id));
          set({ deadlines: validData, hasLoaded: true });
        } catch (error) {
          console.error('Failed to force refresh deadlines:', error);
          set({ hasLoaded: true });
        } finally {
          set({ isLoading: false });
        }
      },

      addDeadline: async (deadline) => {
        // Ensure new ID is a UUID
        const id = deadline.id && isValidUUID(deadline.id) ? deadline.id : uuidv4();

        const deadlineWithId: Deadline = {
          ...deadline,
          id,
          createdAt: deadline.createdAt || new Date(),
        };

        const normalized = normalizeDeadline(deadlineWithId);
        set((state) => {
          if (state.deadlines.some((existing) => existing.id === normalized.id)) {
            return state;
          }
          return { deadlines: [...state.deadlines, normalized] };
        });

        try {
          const canSync = await shouldSyncDeadlines();
          if (!canSync) {
            return normalized;
          }

          const { createdAt, unitId, ...rest } = normalized;
          void createdAt;
          const apiPayload: Partial<Deadline> = {
            ...rest,
            ...(unitId && isValidUUID(unitId) ? { unitId } : {}),
          };

          const created = await apiRequest<Deadline>('/api/deadlines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiPayload),
          });
          const serverNormalized = normalizeDeadline(created);
          set((state) => ({
            deadlines: state.deadlines.map((d) => (d.id === normalized.id ? serverNormalized : d)),
          }));
          return serverNormalized;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('authentication') && !errorMessage.includes('unauthorized')) {
            errorHandler.logError(
              error instanceof Error ? error : new Error('Failed to add deadline'),
              'DeadlinesStore.addDeadline',
              'medium',
            );
          }
          return normalized;
        }
      },

      removeDeadline: async (id) => {
        // Guard: If ID is invalid, just remove locally and stop
        if (!isValidUUID(id)) {
          console.warn(`Removing invalid ID locally only: ${id}`);
          set((state) => ({
            deadlines: state.deadlines.filter((d) => d.id !== id),
          }));
          return;
        }

        const deadlineToRemove = get().deadlines.find((d) => d.id === id);
        // Optimistic delete
        set((state) => ({
          deadlines: state.deadlines.filter((d) => d.id !== id),
        }));

        // Clean up notifications referencing the deleted deadline (local operation)
        const notifStore = useNotificationsStore.getState();
        const staleNotifs = notifStore.notifications.filter((n) => n.relatedId === id);
        for (const n of staleNotifs) {
          notifStore.removeNotification(n.id);
        }

        try {
          const canSync = await shouldSyncDeadlines();
          if (!canSync) {
            // Not syncing - local delete is final
            return;
          }

          await apiRequest<{ id: string }>(`/api/deadlines/${id}`, {
            method: 'DELETE',
          });
        } catch (error) {
          // FAILURE: Restore the deadline to local state
          if (deadlineToRemove) {
            set((state) => ({
              deadlines: [...state.deadlines, deadlineToRemove],
            }));
          }
          errorHandler.logError(
            error instanceof Error ? error : new Error(`Failed to remove deadline ${id}`),
            'DeadlinesStore.removeDeadline',
            'high',
          );
          // Rethrow so UI can show error feedback
          throw error;
        }
      },

      // Remove all deadlines associated with a deleted unit (cascade delete)
      removeDeadlinesByUnit: (unitId: string, unitCode: string) => {
        set((state) => ({
          deadlines: state.deadlines.filter((d) => d.unitId !== unitId && d.unitCode !== unitCode),
        }));
      },

      updateDeadline: async (id, updatedDeadline) => {
        const currentDeadline = get().deadlines.find((d) => d.id === id);
        if (!currentDeadline) return null;

        // If ID is not a UUID, treat as local-only (sample/legacy) and skip API calls.
        // This prevents console errors and keeps the UI functional (e.g. toggleComplete).
        if (!isValidUUID(id)) {
          console.warn(`Updating non-UUID deadline locally only: ${id}`);
          const localUpdate = { ...currentDeadline, ...updatedDeadline };
          set((state) => ({
            deadlines: state.deadlines.map((d) => (d.id === id ? localUpdate : d)),
          }));
          return localUpdate;
        }

        const optimisticUpdate = { ...currentDeadline, ...updatedDeadline };
        set((state) => ({
          deadlines: state.deadlines.map((d) => (d.id === id ? optimisticUpdate : d)),
        }));

        try {
          const canSync = await shouldSyncDeadlines();
          if (!canSync) {
            return optimisticUpdate;
          }

          const { createdAt, unitId, ...rest } = updatedDeadline;
          void createdAt;
          const apiPayload: Partial<Deadline> = {
            ...rest,
            ...(unitId && isValidUUID(unitId) ? { unitId } : {}),
          };

          const updated = await apiRequest<Deadline>(`/api/deadlines/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiPayload),
          });
          const normalized = normalizeDeadline(updated);
          set((state) => ({
            deadlines: state.deadlines.map((d) => (d.id === id ? normalized : d)),
          }));
          return normalized;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Fix for 404: If deadline is missing on server (e.g. from migration), create it instead
          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            console.warn(
              `Deadline ${id} not found on server during update, attempting to create it...`,
            );
            const fullDeadline = { ...currentDeadline, ...updatedDeadline };
            return get().addDeadline(fullDeadline);
          }

          // FAILURE: Revert to original state
          set((state) => ({
            deadlines: state.deadlines.map((d) => (d.id === id ? currentDeadline : d)),
          }));
          errorHandler.logError(
            error instanceof Error ? error : new Error(`Failed to update deadline ${id}`),
            'DeadlinesStore.updateDeadline',
            'high',
          );
          // Rethrow so UI can show error feedback
          throw error;
        }
      },

      toggleComplete: async (id) => {
        const existing = get().deadlines.find((deadline) => deadline.id === id);
        if (!existing) return;
        const newCompletedState = !existing.completed;
        await get().updateDeadline(id, { completed: newCompletedState });

        // Refresh gamification profile after completion toggle (XP may have been awarded)
        if (newCompletedState) {
          // Small delay to allow database trigger to complete
          setTimeout(() => {
            useGamificationStore.getState().refreshProfile();
          }, 500);
        }
      },

      toggleNotification: async (id) => {
        const existing = get().deadlines.find((deadline) => deadline.id === id);
        if (!existing) return;
        await get().updateDeadline(id, {
          notificationEnabled: !existing.notificationEnabled,
        });
      },

      getUpcoming: (limit = 5) => {
        const now = new Date();
        return get()
          .deadlines.filter((d) => !d.completed && new Date(d.dueDate) > now)
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .slice(0, limit);
      },

      getStressLevel: (): StressLevel => {
        try {
          const upcoming = get().getUpcoming(20);
          const now = new Date();
          if (isNaN(now.getTime())) return STRESS_LEVELS.LOW;

          const priorityPoints: Record<Deadline['priority'], number> = {
            Urgent: 4,
            High: 3,
            Medium: 2,
            Low: 1,
          };

          const totalPoints = upcoming.reduce((sum, deadline) => {
            try {
              const dueDate = new Date(deadline.dueDate);
              if (isNaN(dueDate.getTime())) return sum;
              const daysUntil = Math.ceil(
                (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
              );
              const timeWeight =
                daysUntil <= 0
                  ? 2.0
                  : daysUntil <= 1
                    ? 1.5
                    : daysUntil <= 3
                      ? 1.25
                      : daysUntil <= 7
                        ? 1
                        : daysUntil <= 14
                          ? 0.75
                          : 0.5;
              return sum + (priorityPoints[deadline.priority] || 1) * timeWeight;
            } catch {
              return sum;
            }
          }, 0);

          if (totalPoints >= 12) return STRESS_LEVELS.HIGH;
          if (totalPoints >= 6) return STRESS_LEVELS.BUSY;
          return STRESS_LEVELS.LOW;
        } catch {
          return STRESS_LEVELS.LOW;
        }
      },

      clearDeadlines: () => set({ deadlines: [], hasLoaded: false }),
      reset: () => set({ deadlines: [], hasLoaded: false, isLoading: false }),
    }),
    {
      name: 'deadlines-storage',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      // Only persist deadlines array, not loading state flags
      // This ensures hasLoaded is always false on page reload, forcing fresh API fetch
      partialize: (state) => ({ deadlines: state.deadlines }),
      // When rehydrating, ensure hasLoaded stays false so we fetch fresh data
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasLoaded = false;
          state.isLoading = false;
        }
      },
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as {
          state: { deadlines: Partial<Deadline>[] };
        };
        if (version < 4) {
          if (state?.state?.deadlines && Array.isArray(state.state.deadlines)) {
            // Migration: Version 4 forces ALL IDs to be valid UUIDs
            state.state.deadlines = state.state.deadlines.map((deadline: Partial<Deadline>) => {
              // Legacy hardcoded map
              const idMap: Record<string, string> = {
                'deadline-comp2310-assignment-1': '550e8400-e29b-41d4-a716-446655440001',
                'deadline-math1001-quiz-1': '550e8400-e29b-41d4-a716-446655440002',
                'deadline-hist2002-essay-1': '550e8400-e29b-41d4-a716-446655440003',
              };

              let newId = deadline.id ?? '';

              if (newId && idMap[newId]) {
                // Known legacy ID -> Map to specific UUID
                newId = idMap[newId];
              } else if (!newId || !isValidUUID(newId)) {
                // Unknown legacy/invalid ID -> Generate random UUID
                newId = uuidv4();
              }

              return { ...deadline, id: newId };
            });
          }
        }
        return persistedState;
      },
    },
  ),
);
