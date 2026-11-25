// lib/store/eventsStore.ts
// Events store with Supabase API integration
// Follows the same pattern as unitsStore for consistency
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Event } from '@/lib/types';
import { errorHandler } from '@/lib/utils/errorHandling';
import { apiRequest, isLikelyNetworkError, isBrowserOffline } from '@/lib/utils/api';
import { useNotificationsStore } from '@/lib/store/notificationsStore';
import { v4 as uuidv4 } from 'uuid';
let hasLoggedNetworkFallback = false;

interface EventsState {
  events: Event[];
  isLoading: boolean;
  hasLoaded: boolean;
  loadEvents: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  /** Refetch for a page mount/sign-in, sharing any request already in flight. */
  revalidate: () => Promise<void>;
  addEvent: (event: Omit<Event, 'id' | 'date' | 'time'> & { id?: string }) => Promise<Event | null>;
  updateEvent: (id: string, updates: Partial<Event>) => Promise<Event | null>;
  removeEvent: (id: string) => Promise<void>;
  toggleNotification: (id: string) => Promise<void>;
  getEventsByDate: (date: Date) => Event[];
  getUpcomingEvents: (days?: number) => Event[];
  clearEvents: () => void;
  reset: () => void;
}

// Normalize event dates from API response
const normalizeEvent = (event: Event): Event => ({
  ...event,
  startAt: event.startAt instanceof Date ? event.startAt : new Date(event.startAt),
  endAt: event.endAt
    ? event.endAt instanceof Date
      ? event.endAt
      : new Date(event.endAt)
    : undefined,
  date: event.startAt instanceof Date ? event.startAt : new Date(event.startAt),
  time: event.allDay
    ? ''
    : new Date(event.startAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
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

export const useEventsStore = create<EventsState>()(
  persist(
    (set, get) => ({
      events: [],
      isLoading: false,
      hasLoaded: false,

      loadEvents: () => {
        if (get().hasLoaded) return Promise.resolve();
        return shareRequest(async () => {
          set({ isLoading: true });
          try {
            const data = await apiRequest<Event[]>('/api/events', {
              noRetry: true,
            });
            const normalizedApi = data.map(normalizeEvent);
            // Use database data directly - no sample data fallback for authenticated users
            // This ensures proper user isolation and data ownership
            set({
              events: normalizedApi,
              hasLoaded: true,
            });
          } catch (error) {
            // Check if this is an auth error
            const isAuthError =
              error instanceof Error &&
              (error.message.includes('401') ||
                error.message.includes('authentication') ||
                error.message.includes('Unauthorized'));

            if (isAuthError) {
              // Auth failure: clear persisted data to prevent showing stale user data
              // Do NOT fall back to sample data - this causes "ghost" events
              set({ events: [], hasLoaded: true });
            } else {
              // Non-auth error: keep persisted data but mark as loaded
              // Do NOT fall back to sample data - this causes "ghost" events
              const isNetworkError = isLikelyNetworkError(error) || isBrowserOffline();
              if (!isNetworkError) {
                console.warn('Failed to load events from API, using persisted data:', error);
              } else if (!hasLoggedNetworkFallback) {
                hasLoggedNetworkFallback = true;
                console.warn('Events API unavailable; using persisted data fallback.');
              }
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
          const data = await apiRequest<Event[]>('/api/events', {
            noRetry: true,
          });
          const normalizedApi = data.map(normalizeEvent);
          set({ events: normalizedApi, hasLoaded: true });
        } catch (error) {
          console.error('Failed to force refresh events:', error);
          set({ hasLoaded: true });
        } finally {
          set({ isLoading: false });
        }
      },

      addEvent: async (eventInput) => {
        // Create full event with computed fields
        const event: Event = {
          ...eventInput,
          id:
            eventInput.id &&
            eventInput.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
              ? eventInput.id
              : uuidv4(),
          date: eventInput.startAt,
          time: eventInput.allDay
            ? ''
            : eventInput.startAt.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              }),
        };

        const normalized = normalizeEvent(event);

        // Optimistic update
        set((state) => {
          if (state.events.some((existing) => existing.id === normalized.id)) {
            return state;
          }
          return { events: [...state.events, normalized] };
        });

        try {
          const created = await apiRequest<Event>('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: normalized.id,
              title: normalized.title,
              description: normalized.description,
              location: normalized.location,
              building: normalized.building,
              room: normalized.room,
              category: normalized.category,
              color: normalized.color,
              imageUrl: normalized.imageUrl,
              startAt: normalized.startAt.toISOString(),
              endAt: normalized.endAt?.toISOString(),
              allDay: normalized.allDay,
            }),
          });
          const serverNormalized = normalizeEvent(created);
          // Update with server response
          set((state) => ({
            events: state.events.map((e) => (e.id === normalized.id ? serverNormalized : e)),
          }));
          return serverNormalized;
        } catch (error) {
          // Silently handle API errors - stores work with local data
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('authentication') && !errorMessage.includes('unauthorized')) {
            errorHandler.logError(
              error instanceof Error ? error : new Error('Failed to add event'),
              'EventsStore.addEvent',
              'medium',
            );
          }
          return normalized; // Return the local version on error
        }
      },

      updateEvent: async (id, updates) => {
        const currentEvent = get().events.find((e) => e.id === id);
        if (!currentEvent) return null;

        const optimisticUpdate = normalizeEvent({
          ...currentEvent,
          ...updates,
        });
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? optimisticUpdate : e)),
        }));

        try {
          const updatePayload: Record<string, unknown> = {};
          if (updates.title !== undefined) updatePayload.title = updates.title;
          if (updates.description !== undefined) updatePayload.description = updates.description;
          if (updates.location !== undefined) updatePayload.location = updates.location;
          if (updates.building !== undefined) updatePayload.building = updates.building;
          if (updates.room !== undefined) updatePayload.room = updates.room;
          if (updates.category !== undefined) updatePayload.category = updates.category;
          if (updates.color !== undefined) updatePayload.color = updates.color;
          if (updates.imageUrl !== undefined) updatePayload.imageUrl = updates.imageUrl;
          if (updates.notificationEnabled !== undefined)
            updatePayload.notificationEnabled = updates.notificationEnabled;
          if (updates.startAt !== undefined)
            updatePayload.startAt =
              updates.startAt instanceof Date ? updates.startAt.toISOString() : updates.startAt;
          if (updates.endAt !== undefined)
            updatePayload.endAt =
              updates.endAt instanceof Date ? updates.endAt.toISOString() : updates.endAt;
          if (updates.allDay !== undefined) updatePayload.allDay = updates.allDay;

          const updated = await apiRequest<Event>(`/api/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
          });
          const serverNormalized = normalizeEvent(updated);
          set((state) => ({
            events: state.events.map((e) => (e.id === id ? serverNormalized : e)),
          }));
          return serverNormalized;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // 404: Event doesn't exist on server, try to create it
          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            console.warn(
              `Event ${id} not found on server during update, attempting to create it...`,
            );
            const fullEvent = { ...currentEvent, ...updates };
            return get().addEvent(fullEvent);
          }

          // FAILURE: Revert to original state
          set((state) => ({
            events: state.events.map((e) => (e.id === id ? currentEvent : e)),
          }));
          errorHandler.logError(
            error instanceof Error ? error : new Error(`Failed to update event ${id}`),
            'EventsStore.updateEvent',
            'high',
          );
          // Rethrow so UI can show error feedback
          throw error;
        }
      },

      removeEvent: async (id) => {
        const eventToRestore = get().events.find((e) => e.id === id);

        // Optimistic delete
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
        }));

        // Clean up notifications referencing the deleted event (local operation)
        const notifStore = useNotificationsStore.getState();
        const staleNotifs = notifStore.notifications.filter((n) => n.relatedId === id);
        for (const n of staleNotifs) {
          notifStore.removeNotification(n.id);
        }

        try {
          await apiRequest<{ id: string }>(`/api/events/${id}`, {
            method: 'DELETE',
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // 404 means event doesn't exist on server - that's fine, local delete succeeded
          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            return;
          }

          // FAILURE: Restore the event to local state for real errors
          if (eventToRestore) {
            set((state) => ({ events: [...state.events, eventToRestore] }));
          }
          errorHandler.logError(
            error instanceof Error ? error : new Error(`Failed to remove event ${id}`),
            'EventsStore.removeEvent',
            'high',
          );
          // Rethrow so UI can show error feedback
          throw error;
        }
      },

      toggleNotification: async (id) => {
        const existing = get().events.find((event) => event.id === id);
        if (!existing) return;
        await get().updateEvent(id, {
          notificationEnabled: !existing.notificationEnabled,
        });
      },

      getEventsByDate: (date) => {
        const { events } = get();
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        return events.filter((event) => {
          const eventDate = new Date(event.startAt);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate.getTime() === targetDate.getTime();
        });
      },

      getUpcomingEvents: (days = 7) => {
        const { events } = get();
        const now = new Date();
        const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        return events
          .filter((event) => {
            const eventDate = new Date(event.startAt);
            return eventDate >= now && eventDate <= futureDate;
          })
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      },

      clearEvents: () => set({ events: [], hasLoaded: false }),
      reset: () => set({ events: [], hasLoaded: false, isLoading: false }),
    }),
    {
      name: 'events-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ events: state.events }),
      // When rehydrating, ensure hasLoaded stays false so we fetch fresh data
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasLoaded = false;
          state.isLoading = false;
        }
      },
    },
  ),
);
