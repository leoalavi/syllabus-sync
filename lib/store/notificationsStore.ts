// lib/store/notificationsStore.ts
'use client';

import { create } from 'zustand';
import { API_ROUTES } from '@/lib/constants/config';
import { Notification } from '@/lib/types';
import { errorHandler } from '@/lib/utils/errorHandling';
import { apiRequest, isLikelyNetworkError, isBrowserOffline } from '@/lib/utils/api';
import { hasStoredBrowserSession } from '@/lib/supabase/browserSession';
import { toastUtils } from '@/lib/utils/toast';
import { isValidUUID } from '@/lib/utils/uuid';

// Maximum number of notifications to keep in state
const MAX_NOTIFICATIONS = 100;
const STALE_MS = 3 * 60 * 1000; // 3 minutes revalidation window (reduces invocations)
let hasLoggedNetworkFallback = false;

// Concurrency guard: prevents overlapping loadNotifications calls from
// overwriting each other's results (the root cause of the disappearing badge).
let _loadInFlight = false;
let _loadStartedAt = 0;
const LOAD_TIMEOUT_MS = 30_000; // safety valve if a fetch hangs

// Recently-added notifications are protected from being removed by loadNotifications.
// Maps notification ID (temp or server) → timestamp when added.
const _protectedIds = new Map<string, number>();
const PROTECTION_WINDOW_MS = 120_000; // 2 minutes

type LoadOptions = { force?: boolean };

interface NotificationsState {
  notifications: Notification[];
  isLoading: boolean;
  hasLoaded: boolean;
  lastLoadedAt: number | null;
  loadNotifications: (options?: LoadOptions) => Promise<void>;
  addNotification: (
    notification: Omit<Notification, 'id' | 'createdAt'> & {
      id?: string;
      createdAt?: Date;
    },
  ) => Promise<Notification | null>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  getUnreadCount: () => number;
  clearNotifications: () => void;
  reset: () => void;
}

const normalizeNotification = (notification: Notification): Notification => ({
  ...notification,
  createdAt:
    notification.createdAt instanceof Date
      ? notification.createdAt
      : new Date(notification.createdAt),
});

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
  notifications: [],
  isLoading: false,
  hasLoaded: false,
  lastLoadedAt: null,

  loadNotifications: async (options?: LoadOptions) => {
    const { force = false } = options ?? {};
    const now = Date.now();

    const lastLoadedAt = get().lastLoadedAt;
    if (!force && lastLoadedAt !== null && now - lastLoadedAt < STALE_MS) {
      return;
    }

    // Concurrency guard: skip if another load is already in-flight
    // (prevents a concurrent GET from overwriting just-added notifications)
    if (_loadInFlight && now - _loadStartedAt < LOAD_TIMEOUT_MS) {
      return;
    }

    // The layout can mount the Header optimistically before auth resolves, so
    // a signed-out visitor would otherwise fire a guaranteed 401 here.
    if (!(await hasStoredBrowserSession())) {
      return;
    }
    _loadInFlight = true;
    _loadStartedAt = now;

    set({ isLoading: true });
    try {
      const data = await apiRequest<Notification[]>(API_ROUTES.NOTIFICATIONS.BASE, {
        noRetry: true,
      });
      const serverNotifications = data
        .map(normalizeNotification)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // MERGE STRATEGY: never remove existing notifications, only add/update.
      // This prevents the "appears then disappears" bug regardless of what
      // triggers loadNotifications (focus, visibility, Header remount, etc.).
      const currentNotifications = get().notifications;
      const currentById = new Map(currentNotifications.map((n) => [n.id, n]));

      // Update existing notifications with server data (e.g., read status)
      // and add new server notifications we don't have locally
      for (const serverNotif of serverNotifications) {
        const existing = currentById.get(serverNotif.id);
        if (existing) {
          // Update with server version (picks up read status, etc.)
          // BUT if it's a temp or protected notification, keep the local version
          if (!existing.id.startsWith('temp-') && !_protectedIds.has(existing.id)) {
            currentById.set(serverNotif.id, serverNotif);
          }
        } else {
          // New from server — add it
          currentById.set(serverNotif.id, serverNotif);
        }
      }

      // Purge expired entries from the protection map
      const now = Date.now();
      for (const [id, ts] of _protectedIds) {
        if (now - ts > PROTECTION_WINDOW_MS) _protectedIds.delete(id);
      }

      const merged = Array.from(currentById.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_NOTIFICATIONS);

      set({
        notifications: merged,
        hasLoaded: true,
        lastLoadedAt: Date.now(),
      });
    } catch (error) {
      const isAuthError =
        error instanceof Error &&
        (error.message.includes('401') ||
          error.message.includes('authentication') ||
          error.message.includes('Unauthorized'));

      if (isAuthError) {
        // Keep ALL existing notifications intact — don't clear the bell on
        // transient auth errors (e.g., token refresh, cold start race).
        // Previously this aggressively wiped non-temp/non-recent notifications,
        // causing the bell to appear empty after any brief auth hiccup.
        set({ hasLoaded: true, lastLoadedAt: Date.now() });
      } else {
        const isNetworkError = isLikelyNetworkError(error) || isBrowserOffline();
        if (!isNetworkError) {
          console.warn('Failed to load notifications from API:', error);
        } else if (!hasLoggedNetworkFallback) {
          hasLoggedNetworkFallback = true;
          console.warn('Notifications API unavailable; using local state fallback.');
        }
        // Keep existing notifications (including optimistic) as fallback
        set({ hasLoaded: true, lastLoadedAt: Date.now() });
      }
    } finally {
      _loadInFlight = false;
      set({ isLoading: false });
    }
  },

  addNotification: async (notificationData) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const notification: Notification = {
      ...notificationData,
      id: notificationData.id || tempId,
      createdAt: notificationData.createdAt || new Date(),
    };

    const normalized = normalizeNotification(notification);
    // `system` notifications are informational bell entries, not entity-bound reminders.
    // The database has a unique index on (user_id, related_id, type) when related_id exists,
    // so persisting a system notification with relatedId causes false 409 conflicts on repeat actions.
    const sanitizedNotification =
      normalized.type === 'system' ? { ...normalized, relatedId: undefined } : normalized;
    const localNotification = { ...sanitizedNotification, id: tempId };

    // Protect this notification from being removed by loadNotifications
    _protectedIds.set(tempId, Date.now());

    set((state) => ({
      notifications: [localNotification, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
    }));

    // Block concurrent loadNotifications while the POST is in-flight.
    // Without this, a focus-triggered load can race the POST and overwrite
    // the just-added notification (the "appears then disappears" bug).
    _loadInFlight = true;
    _loadStartedAt = Date.now();

    try {
      const apiPayload: Partial<Notification> = { ...sanitizedNotification };

      if (apiPayload.id && !isValidUUID(apiPayload.id)) {
        delete apiPayload.id;
      }

      delete apiPayload.createdAt;

      if (apiPayload.link) {
        try {
          const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
          // Handle relative URLs by prepending base
          const linkUrl = apiPayload.link.startsWith('/')
            ? new URL(apiPayload.link, base).toString()
            : new URL(apiPayload.link).toString();
          apiPayload.link = linkUrl;
        } catch {
          // If URL parsing fails, remove the invalid link
          delete apiPayload.link;
        }
      }

      if (apiPayload.relatedId && !isValidUUID(apiPayload.relatedId)) {
        delete apiPayload.relatedId;
      }

      const created = await apiRequest<Notification>('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });
      const serverNormalized = normalizeNotification(created);
      // Transfer protection from temp ID to server ID
      _protectedIds.delete(tempId);
      _protectedIds.set(serverNormalized.id, Date.now());
      // Atomic replace-or-prepend: if a concurrent loadNotifications removed the
      // temp notification before this POST completed, re-add the server version
      // instead of silently losing it.
      set((state) => {
        const tempExists = state.notifications.some((n) => n.id === tempId);
        if (tempExists) {
          return {
            notifications: state.notifications.map((n) => (n.id === tempId ? serverNormalized : n)),
            // Mark as freshly loaded so focus/visibility handlers don't
            // immediately trigger a loadNotifications that could race us.
            lastLoadedAt: Date.now(),
          };
        }
        // Temp was removed — check if server ID already exists (dedup)
        if (state.notifications.some((n) => n.id === serverNormalized.id)) {
          return {};
        }
        // Re-add the confirmed notification
        return {
          notifications: [serverNormalized, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
          lastLoadedAt: Date.now(),
        };
      });
      _loadInFlight = false;
      return serverNormalized;
    } catch (error) {
      _loadInFlight = false;
      // Handle 409 Conflict (notification already exists) gracefully
      const is409 = error instanceof Error && error.message.includes('409');
      if (is409) {
        // Remove the optimistic notification since it already exists
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== tempId),
        }));
        // Reload notifications to get the existing one
        get().loadNotifications({ force: true });
        return null;
      }

      // For other errors, log and keep the local notification as optimistic fallback
      const isNetwork = isLikelyNetworkError(error) || isBrowserOffline();
      if (!isNetwork) {
        toastUtils.warning(
          'Notification saved locally',
          'It will sync when the connection is restored.',
        );
      }
      errorHandler.logError(
        error instanceof Error ? error : new Error('Failed to add notification'),
        'NotificationsStore.addNotification',
        'medium',
      );
      return sanitizedNotification;
    }
  },

  markAsRead: async (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));

    if (!isValidUUID(id) || id.startsWith('temp-')) {
      return;
    }

    try {
      await apiRequest<Notification>(`/api/notifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
    } catch (error) {
      const is404 = error instanceof Error && error.message.includes('404');
      if (is404) {
        return;
      }

      set((state) => ({
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: false } : n)),
      }));
      errorHandler.logError(
        error instanceof Error ? error : new Error(`Failed to mark notification ${id} as read`),
        'NotificationsStore.markAsRead',
        'high',
      );
    }
  },

  markAllAsRead: async () => {
    const originalReadStates = new Map(get().notifications.map((n) => [n.id, n.read]));

    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));

    try {
      await apiRequest<{ updated: number }>('/api/notifications/mark-all-read', { method: 'PUT' });
    } catch (error) {
      const isExpectedError =
        error instanceof Error && (error.message.includes('404') || error.message.includes('500'));
      if (isExpectedError) {
        return;
      }

      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          read: originalReadStates.get(n.id) ?? n.read,
        })),
      }));
      errorHandler.logError(
        error instanceof Error ? error : new Error('Failed to mark all notifications as read'),
        'NotificationsStore.markAllAsRead',
        'high',
      );
    }
  },

  removeNotification: async (id) => {
    // Snapshot the full list so we can restore exact order on rollback
    const previousNotifications = get().notifications;
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));

    // Temp or non-UUID IDs only exist locally — skip the API call entirely.
    // Without this guard the DELETE would always 404 and the server-side
    // notification would silently survive, reappearing on next load.
    if (!isValidUUID(id) || id.startsWith('temp-')) {
      return;
    }

    try {
      await apiRequest<{ id: string }>(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      const is404 = error instanceof Error && error.message.includes('404');
      if (is404) {
        return;
      }

      // Restore the full previous list to preserve original order
      set({ notifications: previousNotifications });
      errorHandler.logError(
        error instanceof Error ? error : new Error(`Failed to remove notification ${id}`),
        'NotificationsStore.removeNotification',
        'high',
      );
    }
  },

  clearAll: async () => {
    const notificationsToRestore = [...get().notifications];
    set({ notifications: [], isLoading: true });

    try {
      await apiRequest<{ deleted: number }>('/api/notifications', {
        method: 'DELETE',
      });
      set({ notifications: [], isLoading: false });
    } catch (error) {
      set({ notifications: notificationsToRestore, isLoading: false });
      errorHandler.logError(
        error instanceof Error ? error : new Error('Failed to clear all notifications'),
        'NotificationsStore.clearAll',
        'high',
      );
    }
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.read).length;
  },

  clearNotifications: () => {
    set({
      notifications: [],
      hasLoaded: false,
      isLoading: false,
      lastLoadedAt: null,
    });
  },

  reset: () => {
    set({
      notifications: [],
      hasLoaded: false,
      isLoading: false,
      lastLoadedAt: null,
    });
  },
}));
