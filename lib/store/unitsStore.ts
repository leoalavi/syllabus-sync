// lib/store/unitsStore.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Unit, ClassTime } from '@/lib/types';
import { errorHandler } from '@/lib/utils/errorHandling';
import { apiRequest } from '@/lib/utils/api';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { useDeadlinesStore } from '@/lib/store/deadlinesStore';
import { useNotificationsStore } from '@/lib/store/notificationsStore';

interface UnitsState {
  units: Unit[];
  isLoading: boolean;
  hasLoaded: boolean;
  loadUnits: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  /** Refetch for a page mount/sign-in, sharing any request already in flight. */
  revalidate: () => Promise<void>;
  addUnit: (unit: Unit) => Promise<Unit | null>;
  removeUnit: (id: string) => Promise<void>;
  updateUnit: (id: string, unit: Partial<Unit>) => Promise<Unit | null>;
  toggleNotification: (id: string) => Promise<void>;
  getUnitByCode: (code: string) => Unit | undefined;
  getTodayClasses: () => (Unit & ClassTime)[];
  clearUnits: () => void;
  reset: () => void;
}

const normalizeUnit = (unit: Unit): Unit => ({
  ...unit,
  createdAt: unit.createdAt instanceof Date ? unit.createdAt : new Date(unit.createdAt),
  schedule: unit.schedule ?? [],
});

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

export const useUnitsStore = create<UnitsState>()(
  persist(
    (set, get) => ({
      units: [],
      isLoading: false,
      hasLoaded: false,

      loadUnits: () => {
        if (get().hasLoaded) return Promise.resolve();
        return shareRequest(async () => {
          set({ isLoading: true });
          try {
            const data = await apiRequest<Unit[]>('/api/units', {
              noRetry: true,
            });
            // IMPORTANT: Always use database data as source of truth
            // This ensures IDs are correct and in sync with the server
            // Persisted localStorage data is only for offline caching, not the source of truth
            set({ units: data.map(normalizeUnit), hasLoaded: true });
          } catch (error) {
            // Check if this is an auth error
            const isAuthError =
              error instanceof Error &&
              (error.message.includes('401') ||
                error.message.includes('authentication') ||
                error.message.includes('Unauthorized'));

            if (isAuthError) {
              // Auth failure: clear persisted data to prevent showing stale user data
              set({ units: [], hasLoaded: true });
            } else {
              // Non-auth error: keep persisted data but mark as loaded
              // NOTE: This can cause ID mismatches - users should retry or refresh
              console.warn('Failed to load units from API, using persisted data:', error);
              set({ hasLoaded: true });
            }
          } finally {
            set({ isLoading: false });
          }
        });
      },

      revalidate: () => shareRequest(() => get().forceRefresh()),

      // Force refresh from database - clears local state and reloads
      forceRefresh: async () => {
        set({ isLoading: true, hasLoaded: false });
        try {
          const data = await apiRequest<Unit[]>('/api/units', {
            noRetry: true,
          });
          set({ units: data.map(normalizeUnit), hasLoaded: true });
        } catch (error) {
          console.error('Failed to force refresh units:', error);
          set({ hasLoaded: true });
        } finally {
          set({ isLoading: false });
        }
      },

      addUnit: async (unit) => {
        // For testing compatibility, update state synchronously first
        const normalized = normalizeUnit({
          ...unit,
          id:
            unit.id &&
            unit.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
              ? unit.id
              : uuidv4(),
          createdAt: unit.createdAt || new Date(),
        });

        set((state) => {
          if (state.units.some((existing) => existing.id === normalized.id)) {
            return state;
          }
          return { units: [...state.units, normalized] };
        });

        try {
          // Use standard POST endpoint for creating new units
          const apiPayload = {
            id: normalized.id,
            code: normalized.code,
            name: normalized.name,
            color: normalized.color,
            location: normalized.location,
            schedule: normalized.schedule,
            createdAt: normalized.createdAt,
          };

          const created = await apiRequest<Unit>('/api/units', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiPayload),
          });
          const serverNormalized = normalizeUnit(created);
          // Update with server response if different
          set((state) => ({
            units: state.units.map((u) => (u.id === normalized.id ? serverNormalized : u)),
          }));
          return serverNormalized;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // 409: Unit with this code already exists in DB
          // This can happen if localStorage is out of sync with DB
          // Force refresh to get the correct state and return the existing unit
          if (errorMessage.includes('409') || errorMessage.includes('already exists')) {
            // Unit code already exists in DB - refresh to get correct state
            await get().forceRefresh();
            // Find the existing unit by code (case-insensitive)
            const searchCode = normalized.code.toUpperCase();
            const existingUnit = get().units.find((u) => u.code.toUpperCase() === searchCode);
            return existingUnit || null;
          }

          // Silently handle API errors - stores work with local data
          // Only log unexpected errors, not auth failures
          if (!errorMessage.includes('authentication') && !errorMessage.includes('unauthorized')) {
            errorHandler.logError(
              error instanceof Error ? error : new Error('Failed to add unit'),
              'UnitsStore.addUnit',
              'medium',
            );
          }
          return normalized; // Return the local version on error
        }
      },

      removeUnit: async (id) => {
        // Store the unit before removing for potential rollback
        const unitToRestore = get().units.find((u) => u.id === id);
        const unitCode = unitToRestore?.code;

        // Remove from local state immediately (optimistic)
        set((state) => ({
          units: state.units.filter((u) => u.id !== id),
        }));

        try {
          const response = await apiRequest<{
            id: string;
            code?: string;
            cascadeDeleted?: boolean;
          }>(`/api/units/${id}`, { method: 'DELETE' });

          // If cascade delete was successful, also remove related deadlines from local state
          if (response.cascadeDeleted && unitCode) {
            // Capture deadline IDs before removal for notification cleanup
            const affectedDeadlineIds = useDeadlinesStore
              .getState()
              .deadlines.filter((d) => d.unitId === id || d.unitCode === unitCode)
              .map((d) => d.id);

            // Explicitly sync globally first, so any component reading deadlines is updated
            useDeadlinesStore.getState().removeDeadlinesByUnit(id, unitCode);

            // Clean up notifications referencing deleted deadlines
            if (affectedDeadlineIds.length > 0) {
              const notifStore = useNotificationsStore.getState();
              const toRemove = notifStore.notifications.filter(
                (n) => n.relatedId && affectedDeadlineIds.includes(n.relatedId),
              );
              for (const n of toRemove) {
                notifStore.removeNotification(n.id);
              }
            }

            // Dispatch a custom event that components can listen to
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('unit-deleted', {
                  detail: { unitId: id, unitCode },
                }),
              );
            }
          }
          // SUCCESS: Delete succeeded - state already updated optimistically
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // 404 means unit doesn't exist on server - that's fine, local delete succeeded
          // This happens when deleting units that were never synced to DB
          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            // Dispatch event to clean up related deadlines locally
            if (unitCode) {
              // Capture deadline IDs before removal for notification cleanup
              const affectedDeadlineIds = useDeadlinesStore
                .getState()
                .deadlines.filter((d) => d.unitId === id || d.unitCode === unitCode)
                .map((d) => d.id);

              useDeadlinesStore.getState().removeDeadlinesByUnit(id, unitCode);

              // Clean up notifications referencing deleted deadlines
              if (affectedDeadlineIds.length > 0) {
                const notifStore = useNotificationsStore.getState();
                const toRemove = notifStore.notifications.filter(
                  (n) => n.relatedId && affectedDeadlineIds.includes(n.relatedId),
                );
                for (const n of toRemove) {
                  notifStore.removeNotification(n.id);
                }
              }

              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('unit-deleted', {
                    detail: { unitId: id, unitCode },
                  }),
                );
              }
            }
            return; // Delete successful (unit was local-only)
          }

          // FAILURE: Restore the unit to local state for real errors
          if (unitToRestore) {
            set((state) => ({ units: [...state.units, unitToRestore] }));
          }
          // Always log and rethrow to let UI show error toast
          errorHandler.logError(
            error instanceof Error ? error : new Error(`Failed to remove unit ${id}`),
            'UnitsStore.removeUnit',
            'high',
          );
          // Rethrow so calling code knows delete failed
          throw error;
        }
      },

      updateUnit: async (id, updatedUnit) => {
        // Update local state immediately
        const currentUnit = get().units.find((u) => u.id === id);
        if (!currentUnit) return null;

        const optimisticUpdate = { ...currentUnit, ...updatedUnit };
        set((state) => ({
          units: state.units.map((u) => (u.id === id ? optimisticUpdate : u)),
        }));

        try {
          // Use PUT endpoint for updates - this properly updates existing units
          const updated = await apiRequest<Unit>(`/api/units/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: optimisticUpdate.code,
              name: optimisticUpdate.name,
              color: optimisticUpdate.color,
              location: optimisticUpdate.location,
              schedule: optimisticUpdate.schedule,
              notificationEnabled: optimisticUpdate.notificationEnabled,
            }),
          });

          const normalized = normalizeUnit(updated);
          set((state) => ({
            units: state.units.map((u) => (u.id === id ? normalized : u)),
          }));
          return normalized;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // 404: Unit doesn't exist on server with this ID
          // This could mean: 1) unit was never synced, or 2) unit exists with different ID
          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            // Unit not found on server - sync state from database

            // Force refresh to get the actual state from DB
            // This will replace local units with the correct DB data (including correct IDs)
            await get().forceRefresh();

            // After refresh, find the unit by code (case-insensitive since DB normalizes to uppercase)
            const searchCode = optimisticUpdate.code.toUpperCase();
            const refreshedUnit = get().units.find((u) => u.code.toUpperCase() === searchCode);

            if (refreshedUnit) {
              // Unit exists in DB - now update it with the correct ID
              try {
                const updated = await apiRequest<Unit>(`/api/units/${refreshedUnit.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    code: optimisticUpdate.code,
                    name: optimisticUpdate.name,
                    color: optimisticUpdate.color,
                    location: optimisticUpdate.location,
                    schedule: optimisticUpdate.schedule,
                    notificationEnabled: optimisticUpdate.notificationEnabled,
                  }),
                });

                const normalized = normalizeUnit(updated);
                set((state) => ({
                  units: state.units.map((u) => (u.id === refreshedUnit.id ? normalized : u)),
                }));
                return normalized;
              } catch (retryError) {
                console.error('Failed to update unit after refresh:', retryError);
                // Return the refreshed unit as-is
                return refreshedUnit;
              }
            } else {
              // Unit doesn't exist in DB at all - try to create it
              try {
                const created = await apiRequest<Unit>('/api/units', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    code: optimisticUpdate.code,
                    name: optimisticUpdate.name,
                    color: optimisticUpdate.color,
                    location: optimisticUpdate.location,
                    schedule: optimisticUpdate.schedule,
                    notificationEnabled: optimisticUpdate.notificationEnabled,
                  }),
                });
                const normalized = normalizeUnit(created);
                // Add the newly created unit to state
                set((state) => ({
                  units: [
                    ...state.units.filter(
                      (u) => u.code.toUpperCase() !== optimisticUpdate.code.toUpperCase(),
                    ),
                    normalized,
                  ],
                }));
                return normalized;
              } catch (createError) {
                const createErrorMsg =
                  createError instanceof Error ? createError.message : String(createError);
                console.error('Failed to create unit:', createError);

                // If 409, the unit exists - refresh and find it
                if (createErrorMsg.includes('409') || createErrorMsg.includes('already exists')) {
                  await get().forceRefresh();
                  const searchCode = optimisticUpdate.code.toUpperCase();
                  const found = get().units.find((u) => u.code.toUpperCase() === searchCode);
                  if (found) {
                    return found;
                  }
                }

                // Force another refresh and try to find by code
                await get().forceRefresh();
                const searchCode = optimisticUpdate.code.toUpperCase();
                return get().units.find((u) => u.code.toUpperCase() === searchCode) || null;
              }
            }
          }

          // FAILURE: Revert to original state
          set((state) => ({
            units: state.units.map((u) => (u.id === id ? currentUnit : u)),
          }));
          errorHandler.logError(
            error instanceof Error ? error : new Error(`Failed to update unit ${id}`),
            'UnitsStore.updateUnit',
            'high',
          );
          // Rethrow so calling code knows update failed
          throw error;
        }
      },

      toggleNotification: async (id) => {
        const existing = get().units.find((unit) => unit.id === id);
        if (!existing) return;
        await get().updateUnit(id, {
          notificationEnabled: !existing.notificationEnabled,
        });
      },

      getUnitByCode: (code) => {
        return get().units.find((u) => u.code === code);
      },

      getTodayClasses: () => {
        const days: string[] = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        const today = days[new Date().getDay()];

        const todayClasses = get().units.flatMap((unit) =>
          unit.schedule
            .filter((schedule) => schedule.day === today)
            .map((schedule) => ({
              ...unit,
              ...schedule,
            })),
        );

        return todayClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));
      },

      clearUnits: () => {
        set({ units: [], hasLoaded: false, isLoading: false });
      },
      reset: () => set({ units: [], hasLoaded: false, isLoading: false }),
    }),
    {
      name: 'units-storage',
      storage: createJSONStorage(() => localStorage),
      version: 3, // Bumped to invalidate stale data with incorrect IDs
      // Only persist units array, not loading state flags
      // This ensures hasLoaded is always false on page reload, forcing fresh API fetch
      partialize: (state) => ({ units: state.units }),
      // When rehydrating, ensure hasLoaded stays false so we fetch fresh data
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasLoaded = false;
          state.isLoading = false;
        }
      },
      migrate: (persistedState: unknown, version: number) => {
        // Version 3: Clear all cached data to fix ID mismatch issues
        if (version < 3) {
          // Return empty state to force fresh load from database
          return { state: { units: [] } };
        }
        if (version < 2) {
          // Migration from version 1 to 2: Convert old non-UUID string IDs to UUIDs
          // This migration handles legacy data that used string IDs like 'unit-comp2310'
          const StateSchema = z.object({
            state: z
              .object({
                units: z
                  .array(
                    z.object({
                      id: z.string().optional(),
                      schedule: z.array(z.object({ id: z.string().optional() })).optional(),
                    }),
                  )
                  .optional(),
              })
              .optional(),
          });

          const parsed = StateSchema.safeParse(persistedState);
          if (!parsed.success) {
            // If persisted state doesn't match expected shape, skip migration to avoid runtime errors
            return persistedState;
          }

          // Helper to check if a string is already a valid UUID
          const isUUID = (str: string): boolean =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

          // Helper to generate a deterministic UUID from a string (for consistency across migrations)
          const generateUUID = (): string => {
            // Generate a random UUID v4 format
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });
          };

          const state = parsed.data;
          if (state?.state?.units && Array.isArray(state.state.units)) {
            // Create a mapping of old IDs to new UUIDs (generated once per migration run)
            const idMigrationMap = new Map<string, string>();

            state.state.units = state.state.units.map((unit) => {
              // Skip if already a valid UUID
              if (unit.id && !isUUID(unit.id)) {
                // Get or create a new UUID for this old ID
                if (!idMigrationMap.has(unit.id)) {
                  idMigrationMap.set(unit.id, generateUUID());
                }
                const updatedUnit = {
                  ...unit,
                  id: idMigrationMap.get(unit.id)!,
                };

                // Also migrate schedule IDs if present
                if (updatedUnit.schedule && Array.isArray(updatedUnit.schedule)) {
                  updatedUnit.schedule = updatedUnit.schedule.map((schedule) => {
                    if (schedule.id && !isUUID(schedule.id)) {
                      if (!idMigrationMap.has(schedule.id)) {
                        idMigrationMap.set(schedule.id, generateUUID());
                      }
                      return {
                        ...schedule,
                        id: idMigrationMap.get(schedule.id)!,
                      };
                    }
                    return schedule;
                  });
                }
                return updatedUnit;
              }
              return unit;
            });

            return state;
          }
        }
        return persistedState;
      },
    },
  ),
);
