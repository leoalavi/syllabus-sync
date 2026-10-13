// lib/store/notificationPreferencesStore.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  notificationService,
  NotificationPermissionStatus,
} from '@/lib/services/notificationService';
import { useNotificationsStore } from '@/lib/store/notificationsStore';
import { apiRequest } from '@/lib/utils/api';
import { hasStoredBrowserSession } from '@/lib/supabase/browserSession';
import { logger } from '@/lib/logger';

export interface NotificationPreferences {
  // Permission status
  permissionStatus: NotificationPermissionStatus;

  // Notification type toggles
  deadlinesEnabled: boolean;
  classesEnabled: boolean;
  eventsEnabled: boolean;
  assignmentsEnabled: boolean;
  examsEnabled: boolean;
  todosEnabled: boolean;

  // Reminder timing (minutes before)
  deadlineReminderTiming: number; // e.g., 1440 = 24 hours, 60 = 1 hour
  classReminderTiming: number; // e.g., 15 = 15 minutes before
  eventReminderTiming: number; // e.g., 60 = 1 hour before
  assignmentReminderTiming: number;
  examReminderTiming: number;
  todoReminderTiming: number;

  // Push notifications master toggle
  pushEnabled: boolean;

  // Scheduled reminder IDs (to prevent duplicates)
  scheduledReminders: Record<string, number>; // id -> setTimeout handle

  // Pending reminder metadata for re-scheduling across reloads
  pendingReminders: Record<
    string,
    {
      type: 'deadline' | 'class' | 'event';
      payload: Record<string, string | number>;
      triggerAt: number;
    }
  >;

  // IDs of default reminders the user has dismissed (read/deleted).
  // Prevents them from being re-created on subsequent logins.
  dismissedDefaultReminders: string[];
}

interface NotificationPreferencesState extends NotificationPreferences {
  // Actions
  initialize: () => Promise<void>;
  requestPermission: () => Promise<NotificationPermissionStatus>;
  setDeadlinesEnabled: (enabled: boolean) => Promise<boolean>;
  setClassesEnabled: (enabled: boolean) => Promise<boolean>;
  setEventsEnabled: (enabled: boolean) => Promise<boolean>;
  setAssignmentsEnabled: (enabled: boolean) => Promise<boolean>;
  setExamsEnabled: (enabled: boolean) => Promise<boolean>;
  setTodosEnabled: (enabled: boolean) => Promise<boolean>;
  setPushEnabled: (enabled: boolean) => Promise<boolean>;
  setDeadlineReminderTiming: (minutes: number) => Promise<boolean>;
  setClassReminderTiming: (minutes: number) => Promise<boolean>;
  setEventReminderTiming: (minutes: number) => Promise<boolean>;
  setAssignmentReminderTiming: (minutes: number) => Promise<boolean>;
  setExamReminderTiming: (minutes: number) => Promise<boolean>;
  setTodoReminderTiming: (minutes: number) => Promise<boolean>;
  dismissDefaultReminder: (key: string) => void;
  reschedulePending: () => void;
  scheduleDeadlineReminder: (
    deadlineId: string,
    title: string,
    unitCode: string,
    dueDate: Date,
  ) => void;
  scheduleClassReminder: (
    unitCode: string,
    unitName: string,
    building: string,
    room: string,
    classTime: Date,
  ) => void;
  scheduleEventReminder: (
    eventId: string,
    title: string,
    location: string,
    eventTime: Date,
  ) => void;
  cancelReminder: (id: string) => void;
  clearAllReminders: () => void;
  reset: () => void;
}

type ServerNotificationPreferences = {
  push_notifications?: boolean | null;
  deadline_notifications_enabled?: boolean | null;
  class_notifications_enabled?: boolean | null;
  event_notifications_enabled?: boolean | null;
  assignment_notifications_enabled?: boolean | null;
  exam_notifications_enabled?: boolean | null;
  todo_notifications_enabled?: boolean | null;
  deadline_reminder_timing_minutes?: number | null;
  class_reminder_timing_minutes?: number | null;
  event_reminder_timing_minutes?: number | null;
  assignment_reminder_timing_minutes?: number | null;
  exam_reminder_timing_minutes?: number | null;
  todo_reminder_timing_minutes?: number | null;
};

/** Convert a timing in minutes to a human-readable label */
function formatTimingLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes === 60) return '1 hour';
  if (minutes < 1440) return `${Math.round(minutes / 60)} hours`;
  if (minutes === 1440) return '24 hours';
  return `${Math.round(minutes / 1440)} days`;
}

function isAuthPreferenceError(error: unknown): boolean {
  return (
    error instanceof Error && (error.message.startsWith('401:') || error.message.startsWith('403:'))
  );
}

async function loadServerNotificationPreferences(): Promise<ServerNotificationPreferences | null> {
  try {
    // The scheduler that calls this is mounted in the root layout, so it also
    // runs on /login and /signup. Skip the request there instead of firing a
    // guaranteed 401 for every signed-out visitor. After login the page reloads
    // and useFirstLoginPrompts re-runs initialize() with a session.
    if (!(await hasStoredBrowserSession())) {
      return null;
    }
    return await apiRequest<ServerNotificationPreferences>('/api/user-preferences', {
      method: 'GET',
      noRetry: true,
    });
  } catch (error) {
    if (!isAuthPreferenceError(error)) {
      logger.warn('Failed to load notification preferences from server', error);
    }
    return null;
  }
}

async function persistServerNotificationPreferences(
  updates: ServerNotificationPreferences,
): Promise<boolean> {
  try {
    await apiRequest('/api/user-preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
      noRetry: true,
    });
    return true;
  } catch (error) {
    if (!isAuthPreferenceError(error)) {
      logger.warn('Failed to persist notification preferences to server', error);
    }
    return false;
  }
}

export const useNotificationPreferencesStore = create<NotificationPreferencesState>()(
  persist(
    (set, get) => ({
      // Default state
      permissionStatus: 'default',
      deadlinesEnabled: true,
      classesEnabled: true,
      eventsEnabled: true,
      assignmentsEnabled: true,
      examsEnabled: true,
      todosEnabled: true,
      deadlineReminderTiming: 1440, // 24 hours
      classReminderTiming: 15, // 15 minutes
      eventReminderTiming: 60, // 1 hour
      assignmentReminderTiming: 1440, // 24 hours
      examReminderTiming: 1440, // 24 hours
      todoReminderTiming: 60, // 1 hour
      pushEnabled: true,
      scheduledReminders: {},
      pendingReminders: {},
      dismissedDefaultReminders: [],

      initialize: async () => {
        const status = notificationService.getPermissionStatus();
        const deadlinesEnabled = notificationService.isNotificationTypeEnabled('deadlines');
        const classesEnabled = notificationService.isNotificationTypeEnabled('classes');
        const eventsEnabled = notificationService.isNotificationTypeEnabled('events');

        set({ permissionStatus: status, deadlinesEnabled, classesEnabled, eventsEnabled });

        const serverPreferences = await loadServerNotificationPreferences();
        if (serverPreferences) {
          set((state) => ({
            pushEnabled: serverPreferences.push_notifications ?? state.pushEnabled,
            deadlinesEnabled:
              serverPreferences.deadline_notifications_enabled ?? state.deadlinesEnabled,
            classesEnabled: serverPreferences.class_notifications_enabled ?? state.classesEnabled,
            eventsEnabled: serverPreferences.event_notifications_enabled ?? state.eventsEnabled,
            assignmentsEnabled:
              serverPreferences.assignment_notifications_enabled ?? state.assignmentsEnabled,
            examsEnabled: serverPreferences.exam_notifications_enabled ?? state.examsEnabled,
            todosEnabled: serverPreferences.todo_notifications_enabled ?? state.todosEnabled,
            deadlineReminderTiming:
              serverPreferences.deadline_reminder_timing_minutes ?? state.deadlineReminderTiming,
            classReminderTiming:
              serverPreferences.class_reminder_timing_minutes ?? state.classReminderTiming,
            eventReminderTiming:
              serverPreferences.event_reminder_timing_minutes ?? state.eventReminderTiming,
            assignmentReminderTiming:
              serverPreferences.assignment_reminder_timing_minutes ??
              state.assignmentReminderTiming,
            examReminderTiming:
              serverPreferences.exam_reminder_timing_minutes ?? state.examReminderTiming,
            todoReminderTiming:
              serverPreferences.todo_reminder_timing_minutes ?? state.todoReminderTiming,
          }));
        }

        if (status === 'granted' && get().pushEnabled) {
          void notificationService.subscribeToPush();
        }

        // Reschedule any pending reminders that survived persistence
        get().reschedulePending();
      },

      requestPermission: async () => {
        const status = await notificationService.requestPermission();
        set({ permissionStatus: status });
        if (status === 'granted' && get().pushEnabled) {
          void notificationService.subscribeToPush();
        }
        return status;
      },

      setDeadlinesEnabled: async (enabled: boolean) => {
        const previousEnabled = get().deadlinesEnabled;
        notificationService.setNotificationTypeEnabled('deadlines', enabled);
        set({ deadlinesEnabled: enabled });
        const persisted = await persistServerNotificationPreferences({
          deadline_notifications_enabled: enabled,
        });
        if (!persisted) {
          notificationService.setNotificationTypeEnabled('deadlines', previousEnabled);
          set({ deadlinesEnabled: previousEnabled });
        }
        return persisted;
      },

      setClassesEnabled: async (enabled: boolean) => {
        const previousEnabled = get().classesEnabled;
        notificationService.setNotificationTypeEnabled('classes', enabled);
        set({ classesEnabled: enabled });
        const persisted = await persistServerNotificationPreferences({
          class_notifications_enabled: enabled,
        });
        if (!persisted) {
          notificationService.setNotificationTypeEnabled('classes', previousEnabled);
          set({ classesEnabled: previousEnabled });
        }
        return persisted;
      },

      setEventsEnabled: async (enabled: boolean) => {
        const previousEnabled = get().eventsEnabled;
        notificationService.setNotificationTypeEnabled('events', enabled);
        set({ eventsEnabled: enabled });
        const persisted = await persistServerNotificationPreferences({
          event_notifications_enabled: enabled,
        });
        if (!persisted) {
          notificationService.setNotificationTypeEnabled('events', previousEnabled);
          set({ eventsEnabled: previousEnabled });
        }
        return persisted;
      },

      setAssignmentsEnabled: async (enabled: boolean) => {
        const prev = get().assignmentsEnabled;
        set({ assignmentsEnabled: enabled });
        const persisted = await persistServerNotificationPreferences({
          assignment_notifications_enabled: enabled,
        });
        if (!persisted) set({ assignmentsEnabled: prev });
        return persisted;
      },

      setExamsEnabled: async (enabled: boolean) => {
        const prev = get().examsEnabled;
        set({ examsEnabled: enabled });
        const persisted = await persistServerNotificationPreferences({
          exam_notifications_enabled: enabled,
        });
        if (!persisted) set({ examsEnabled: prev });
        return persisted;
      },

      setTodosEnabled: async (enabled: boolean) => {
        const prev = get().todosEnabled;
        set({ todosEnabled: enabled });
        const persisted = await persistServerNotificationPreferences({
          todo_notifications_enabled: enabled,
        });
        if (!persisted) set({ todosEnabled: prev });
        return persisted;
      },

      setPushEnabled: async (enabled: boolean) => {
        if (!enabled) {
          await notificationService.unsubscribeFromPush();
          set({ pushEnabled: false });
          get().clearAllReminders();
          void persistServerNotificationPreferences({
            push_notifications: false,
          });
          return true;
        }

        let status = get().permissionStatus;
        if (status !== 'granted') {
          status = await notificationService.requestPermission();
          set({ permissionStatus: status });
        }

        if (status !== 'granted') {
          set({ pushEnabled: false });
          void persistServerNotificationPreferences({
            push_notifications: false,
          });
          return false;
        }

        const subscribed = await notificationService.subscribeToPush();
        if (!subscribed && notificationService.isPushSupported()) {
          logger.warn('Browser granted notifications but push subscription could not be created');
        }

        set({ pushEnabled: true });
        void persistServerNotificationPreferences({
          push_notifications: true,
        });
        get().reschedulePending();
        return subscribed || !notificationService.isPushSupported();
      },

      setDeadlineReminderTiming: async (minutes: number) => {
        const previousTiming = get().deadlineReminderTiming;
        set({ deadlineReminderTiming: minutes });
        const persisted = await persistServerNotificationPreferences({
          deadline_reminder_timing_minutes: minutes,
        });
        if (!persisted) {
          set({ deadlineReminderTiming: previousTiming });
        }
        return persisted;
      },

      setClassReminderTiming: async (minutes: number) => {
        const previousTiming = get().classReminderTiming;
        set({ classReminderTiming: minutes });
        const persisted = await persistServerNotificationPreferences({
          class_reminder_timing_minutes: minutes,
        });
        if (!persisted) {
          set({ classReminderTiming: previousTiming });
        }
        return persisted;
      },

      setEventReminderTiming: async (minutes: number) => {
        const previousTiming = get().eventReminderTiming;
        set({ eventReminderTiming: minutes });
        const persisted = await persistServerNotificationPreferences({
          event_reminder_timing_minutes: minutes,
        });
        if (!persisted) {
          set({ eventReminderTiming: previousTiming });
        }
        return persisted;
      },

      setAssignmentReminderTiming: async (minutes: number) => {
        const prev = get().assignmentReminderTiming;
        set({ assignmentReminderTiming: minutes });
        const persisted = await persistServerNotificationPreferences({
          assignment_reminder_timing_minutes: minutes,
        });
        if (!persisted) set({ assignmentReminderTiming: prev });
        return persisted;
      },

      setExamReminderTiming: async (minutes: number) => {
        const prev = get().examReminderTiming;
        set({ examReminderTiming: minutes });
        const persisted = await persistServerNotificationPreferences({
          exam_reminder_timing_minutes: minutes,
        });
        if (!persisted) set({ examReminderTiming: prev });
        return persisted;
      },

      setTodoReminderTiming: async (minutes: number) => {
        const prev = get().todoReminderTiming;
        set({ todoReminderTiming: minutes });
        const persisted = await persistServerNotificationPreferences({
          todo_reminder_timing_minutes: minutes,
        });
        if (!persisted) set({ todoReminderTiming: prev });
        return persisted;
      },

      dismissDefaultReminder: (key: string) => {
        set((s) => ({
          dismissedDefaultReminders: s.dismissedDefaultReminders.includes(key)
            ? s.dismissedDefaultReminders
            : [...s.dismissedDefaultReminders, key],
        }));
      },

      scheduleDeadlineReminder: (
        deadlineId: string,
        title: string,
        unitCode: string,
        dueDate: Date,
      ) => {
        if (typeof window === 'undefined') return;

        const state = get();
        if (!state.pushEnabled || !state.deadlinesEnabled) return;
        if (state.permissionStatus !== 'granted') return;

        // Cancel existing reminder for this deadline
        if (state.scheduledReminders[deadlineId]) {
          clearTimeout(state.scheduledReminders[deadlineId]);
        }

        const now = new Date();
        const reminderTime = new Date(dueDate.getTime() - state.deadlineReminderTiming * 60 * 1000);
        const delay = reminderTime.getTime() - now.getTime();

        // setTimeout max safe delay is 2^31 - 1 ms (~24.85 days).
        // Delays exceeding this overflow to 0, firing the callback immediately.
        const MAX_SAFE_TIMEOUT = 2_147_483_647;

        // Only schedule if reminder time is in the future
        if (delay > 0) {
          // Save to pendingReminders so it can be rescheduled on next page load
          set((s) => ({
            pendingReminders: {
              ...s.pendingReminders,
              [deadlineId]: {
                type: 'deadline',
                payload: {
                  title,
                  unitCode,
                  dueDate: dueDate.getTime(),
                },
                triggerAt: reminderTime.getTime(),
              },
            },
          }));

          // If the delay exceeds the safe setTimeout limit, skip the timer.
          // The pending reminder will be rescheduled on the next page load
          // when it's closer to the trigger time.
          if (delay > MAX_SAFE_TIMEOUT) {
            return;
          }

          const timeoutId = window.setTimeout(() => {
            notificationService.sendDeadlineReminder(title, unitCode, dueDate, deadlineId);
            // Add to bell icon notification list (persisted to DB)
            const timingMinutes = get().deadlineReminderTiming;
            const timeLabel = formatTimingLabel(timingMinutes);
            try {
              useNotificationsStore.getState().addNotification({
                title: `Deadline Reminder: ${unitCode}`,
                message: `"${title}" of ${unitCode} is due in ${timeLabel}, hurry up!`,
                type: 'deadline',
                read: false,
                link: '/calendar',
                relatedId: deadlineId,
              });
            } catch {
              /* ignore if store unavailable */
            }
            // Remove from scheduled after sending
            set((s) => {
              const { [deadlineId]: _removed, ...rest } = s.scheduledReminders;
              void _removed; // Silence unused variable warning
              return { scheduledReminders: rest };
            });
          }, delay);

          set((s) => ({
            scheduledReminders: {
              ...s.scheduledReminders,
              [deadlineId]: timeoutId,
            },
          }));
        } else if (delay > -state.deadlineReminderTiming * 60 * 1000) {
          // If we're past the reminder time but before the due date,
          // only send if not previously dismissed and no matching notification exists
          const defaultKey = `default-deadline-${deadlineId}`;
          if (state.dismissedDefaultReminders.includes(defaultKey)) {
            set((s) => {
              const { [deadlineId]: _removed, ...rest } = s.pendingReminders;
              void _removed;
              return { pendingReminders: rest };
            });
            return;
          }

          const existing = useNotificationsStore
            .getState()
            .notifications.find(
              (n) => n.type === 'deadline' && n.title === `Deadline Reminder: ${unitCode}`,
            );
          if (existing) {
            // Already notified for this deadline — skip
            set((s) => {
              const { [deadlineId]: _removed, ...rest } = s.pendingReminders;
              void _removed;
              return { pendingReminders: rest };
            });
            return;
          }

          notificationService.sendDeadlineReminder(title, unitCode, dueDate, deadlineId);
          // Add to bell icon notification list
          const timingMinutes = state.deadlineReminderTiming;
          const timeLabel = formatTimingLabel(timingMinutes);
          try {
            useNotificationsStore.getState().addNotification({
              title: `Deadline Reminder: ${unitCode}`,
              message: `"${title}" of ${unitCode} is due in ${timeLabel}, hurry up!`,
              type: 'deadline',
              read: false,
              link: '/calendar',
              relatedId: deadlineId,
            });
          } catch {
            /* ignore if store unavailable */
          }
          set((s) => {
            const { [deadlineId]: _removed, ...rest } = s.pendingReminders;
            void _removed;
            return { pendingReminders: rest };
          });
        }
      },

      scheduleClassReminder: (
        unitCode: string,
        unitName: string,
        building: string,
        room: string,
        classTime: Date,
      ) => {
        if (typeof window === 'undefined') return;

        const state = get();
        if (!state.pushEnabled || !state.classesEnabled) return;
        if (state.permissionStatus !== 'granted') return;

        const reminderId = `class-${unitCode}-${classTime.getTime()}`;

        // Cancel existing reminder
        if (state.scheduledReminders[reminderId]) {
          clearTimeout(state.scheduledReminders[reminderId]);
        }

        const now = new Date();
        const reminderTime = new Date(classTime.getTime() - state.classReminderTiming * 60 * 1000);
        const delay = reminderTime.getTime() - now.getTime();

        // setTimeout max safe delay is 2^31 - 1 ms (~24.85 days)
        const MAX_SAFE_TIMEOUT = 2_147_483_647;

        if (delay > 0) {
          set((s) => ({
            pendingReminders: {
              ...s.pendingReminders,
              [reminderId]: {
                type: 'class',
                payload: {
                  unitCode,
                  unitName,
                  building,
                  room,
                  classTime: classTime.getTime(),
                },
                triggerAt: reminderTime.getTime(),
              },
            },
          }));

          if (delay > MAX_SAFE_TIMEOUT) {
            return;
          }

          const timeoutId = window.setTimeout(() => {
            const timeStr = classTime.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            notificationService.sendClassReminder(
              unitCode,
              unitName,
              building,
              room,
              timeStr,
              classTime.getTime(),
            );
            // Add to bell icon notification list (persisted to DB)
            try {
              useNotificationsStore.getState().addNotification({
                title: `Class Reminder: ${unitCode}`,
                message: `${unitName} at ${timeStr} in ${building} ${room}`,
                type: 'class',
                read: false,
                link: '/calendar',
              });
            } catch {
              /* ignore if store unavailable */
            }
            set((s) => {
              const { [reminderId]: _removed, ...rest } = s.scheduledReminders;
              void _removed; // Silence unused variable warning
              return {
                scheduledReminders: rest,
                pendingReminders: Object.fromEntries(
                  Object.entries(s.pendingReminders).filter(([key]) => key !== reminderId),
                ),
              };
            });
          }, delay);

          set((s) => ({
            scheduledReminders: {
              ...s.scheduledReminders,
              [reminderId]: timeoutId,
            },
          }));
        }
      },

      scheduleEventReminder: (
        eventId: string,
        title: string,
        location: string,
        eventTime: Date,
      ) => {
        if (typeof window === 'undefined') return;

        const state = get();
        if (!state.pushEnabled || !state.eventsEnabled) return;
        if (state.permissionStatus !== 'granted') return;

        // Cancel existing reminder
        if (state.scheduledReminders[eventId]) {
          clearTimeout(state.scheduledReminders[eventId]);
        }

        const now = new Date();
        const reminderTime = new Date(eventTime.getTime() - state.eventReminderTiming * 60 * 1000);
        const delay = reminderTime.getTime() - now.getTime();

        // setTimeout max safe delay is 2^31 - 1 ms (~24.85 days)
        const MAX_SAFE_TIMEOUT = 2_147_483_647;

        if (delay > 0) {
          set((s) => ({
            pendingReminders: {
              ...s.pendingReminders,
              [eventId]: {
                type: 'event',
                payload: {
                  title,
                  location,
                  eventTime: eventTime.getTime(),
                },
                triggerAt: reminderTime.getTime(),
              },
            },
          }));

          if (delay > MAX_SAFE_TIMEOUT) {
            return;
          }

          const timeoutId = window.setTimeout(() => {
            const timeStr = eventTime.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            notificationService.sendEventReminder(title, location, timeStr, eventId);
            // Add to bell icon notification list (persisted to DB)
            try {
              useNotificationsStore.getState().addNotification({
                title: `Event Reminder: ${title}`,
                message: `${title} at ${timeStr}${location ? ` — ${location}` : ''}`,
                type: 'event',
                read: false,
                link: '/calendar',
              });
            } catch {
              /* ignore if store unavailable */
            }
            set((s) => {
              const { [eventId]: _removed, ...rest } = s.scheduledReminders;
              void _removed; // Silence unused variable warning
              return {
                scheduledReminders: rest,
                pendingReminders: Object.fromEntries(
                  Object.entries(s.pendingReminders).filter(([key]) => key !== eventId),
                ),
              };
            });
          }, delay);

          set((s) => ({
            scheduledReminders: {
              ...s.scheduledReminders,
              [eventId]: timeoutId,
            },
          }));
        }
      },

      cancelReminder: (id: string) => {
        const state = get();
        if (state.scheduledReminders[id]) {
          clearTimeout(state.scheduledReminders[id]);
          set((s) => {
            const { [id]: _removed, ...rest } = s.scheduledReminders;
            void _removed; // Silence unused variable warning
            const { [id]: _removedPending, ...restPending } = s.pendingReminders;
            void _removedPending;
            return {
              scheduledReminders: rest,
              pendingReminders: restPending,
            };
          });
        }
      },

      clearAllReminders: () => {
        Object.values(get().scheduledReminders).forEach((id) => {
          if (typeof window !== 'undefined') clearTimeout(id);
        });
        set({ scheduledReminders: {}, pendingReminders: {} });
      },

      reschedulePending: () => {
        if (typeof window === 'undefined') return;

        const state = get();
        if (!state.pushEnabled || state.permissionStatus !== 'granted') return;

        const now = Date.now();
        // setTimeout max safe delay is 2^31 - 1 ms (~24.85 days)
        const MAX_SAFE_TIMEOUT = 2_147_483_647;

        Object.entries(state.pendingReminders).forEach(([id, reminder]) => {
          const delay = reminder.triggerAt - now;
          if (delay <= 0) {
            // Reminder was due while the page was closed — fire it now
            // (up to 24 hours late; beyond that silently discard).
            const lateMs = -delay;
            const MAX_LATE_MS = 24 * 60 * 60 * 1000;
            if (lateMs < MAX_LATE_MS) {
              // Fire the missed reminder immediately
              if (reminder.type === 'deadline') {
                const deadlineTitle = reminder.payload.title as string;
                const deadlineUnitCode = reminder.payload.unitCode as string;
                notificationService.sendDeadlineReminder(
                  deadlineTitle,
                  deadlineUnitCode,
                  new Date(reminder.payload.dueDate as number),
                  id,
                );
                const timingMinutes = get().deadlineReminderTiming;
                const timeLabel = formatTimingLabel(timingMinutes);
                try {
                  useNotificationsStore.getState().addNotification({
                    title: `Deadline Reminder: ${deadlineUnitCode}`,
                    message: `"${deadlineTitle}" of ${deadlineUnitCode} is due in ${timeLabel}, hurry up!`,
                    type: 'deadline',
                    read: false,
                    link: '/calendar',
                    relatedId: id,
                  });
                } catch {
                  /* ignore */
                }
              } else if (reminder.type === 'class') {
                const classTime = new Date(reminder.payload.classTime as number);
                const timeStr = classTime.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                notificationService.sendClassReminder(
                  reminder.payload.unitCode as string,
                  reminder.payload.unitName as string,
                  reminder.payload.building as string,
                  reminder.payload.room as string,
                  timeStr,
                  reminder.payload.classTime as number,
                );
                try {
                  useNotificationsStore.getState().addNotification({
                    title: `Class Reminder: ${reminder.payload.unitCode as string}`,
                    message: `${reminder.payload.unitName as string} at ${timeStr} in ${reminder.payload.building as string} ${reminder.payload.room as string}`,
                    type: 'class',
                    read: false,
                    link: '/calendar',
                  });
                } catch {
                  /* ignore */
                }
              } else if (reminder.type === 'event') {
                const eventTime = new Date(reminder.payload.eventTime as number);
                const timeStr = eventTime.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                notificationService.sendEventReminder(
                  reminder.payload.title as string,
                  reminder.payload.location as string,
                  timeStr,
                  id,
                );
                try {
                  useNotificationsStore.getState().addNotification({
                    title: `Event Reminder: ${reminder.payload.title as string}`,
                    message: `${reminder.payload.title as string} at ${timeStr}${reminder.payload.location ? ` — ${reminder.payload.location as string}` : ''}`,
                    type: 'event',
                    read: false,
                    link: '/calendar',
                  });
                } catch {
                  /* ignore */
                }
              }
            }
            // Remove from pending regardless (fired or too old)
            set((s) => {
              const { [id]: _removed, ...rest } = s.pendingReminders;
              void _removed;
              return { pendingReminders: rest };
            });
            return;
          }

          // Skip if delay exceeds safe setTimeout limit — will be rescheduled next load
          if (delay > MAX_SAFE_TIMEOUT) {
            return;
          }

          if (state.scheduledReminders[id]) {
            clearTimeout(state.scheduledReminders[id]);
          }

          const timeoutId = window.setTimeout(() => {
            if (reminder.type === 'deadline') {
              const deadlineTitle = reminder.payload.title as string;
              const deadlineUnitCode = reminder.payload.unitCode as string;
              notificationService.sendDeadlineReminder(
                deadlineTitle,
                deadlineUnitCode,
                new Date(reminder.payload.dueDate as number),
                id,
              );
              const timingMinutes = get().deadlineReminderTiming;
              const timeLabel = formatTimingLabel(timingMinutes);
              try {
                useNotificationsStore.getState().addNotification({
                  title: `Deadline Reminder: ${deadlineUnitCode}`,
                  message: `"${deadlineTitle}" of ${deadlineUnitCode} is due in ${timeLabel}, hurry up!`,
                  type: 'deadline',
                  read: false,
                  link: '/calendar',
                  relatedId: id,
                });
              } catch {
                /* ignore */
              }
            } else if (reminder.type === 'class') {
              const classTime = new Date(reminder.payload.classTime as number);
              const timeStr = classTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              notificationService.sendClassReminder(
                reminder.payload.unitCode as string,
                reminder.payload.unitName as string,
                reminder.payload.building as string,
                reminder.payload.room as string,
                timeStr,
                reminder.payload.classTime as number,
              );
              try {
                useNotificationsStore.getState().addNotification({
                  title: `Class Reminder: ${reminder.payload.unitCode as string}`,
                  message: `${reminder.payload.unitName as string} at ${timeStr} in ${reminder.payload.building as string} ${reminder.payload.room as string}`,
                  type: 'class',
                  read: false,
                  link: '/calendar',
                });
              } catch {
                /* ignore */
              }
            } else if (reminder.type === 'event') {
              const eventTime = new Date(reminder.payload.eventTime as number);
              const timeStr = eventTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              notificationService.sendEventReminder(
                reminder.payload.title as string,
                reminder.payload.location as string,
                timeStr,
                id,
              );
              try {
                useNotificationsStore.getState().addNotification({
                  title: `Event Reminder: ${reminder.payload.title as string}`,
                  message: `${reminder.payload.title as string} at ${timeStr}${reminder.payload.location ? ` — ${reminder.payload.location as string}` : ''}`,
                  type: 'event',
                  read: false,
                  link: '/calendar',
                });
              } catch {
                /* ignore */
              }
            }

            set((s) => {
              const { [id]: _removed, ...rest } = s.pendingReminders;
              void _removed;
              const { [id]: _timeout, ...restTimeouts } = s.scheduledReminders;
              void _timeout;
              return {
                pendingReminders: rest,
                scheduledReminders: restTimeouts,
              };
            });
          }, delay);

          set((s) => ({
            scheduledReminders: { ...s.scheduledReminders, [id]: timeoutId },
          }));
        });
      },

      reset: () => {
        // Clear timeouts first
        Object.values(get().scheduledReminders).forEach((id) => {
          if (typeof window !== 'undefined') clearTimeout(id);
        });

        set({
          permissionStatus: 'default',
          deadlinesEnabled: true,
          classesEnabled: true,
          eventsEnabled: true,
          assignmentsEnabled: true,
          examsEnabled: true,
          todosEnabled: true,
          deadlineReminderTiming: 1440,
          classReminderTiming: 15,
          eventReminderTiming: 60,
          assignmentReminderTiming: 1440,
          examReminderTiming: 1440,
          todoReminderTiming: 60,
          pushEnabled: true,
          scheduledReminders: {},
          pendingReminders: {},
          dismissedDefaultReminders: [],
        });
      },
    }),
    {
      name: 'notification-prefs',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        deadlinesEnabled: state.deadlinesEnabled,
        classesEnabled: state.classesEnabled,
        eventsEnabled: state.eventsEnabled,
        assignmentsEnabled: state.assignmentsEnabled,
        examsEnabled: state.examsEnabled,
        todosEnabled: state.todosEnabled,
        deadlineReminderTiming: state.deadlineReminderTiming,
        classReminderTiming: state.classReminderTiming,
        eventReminderTiming: state.eventReminderTiming,
        assignmentReminderTiming: state.assignmentReminderTiming,
        examReminderTiming: state.examReminderTiming,
        todoReminderTiming: state.todoReminderTiming,
        pushEnabled: state.pushEnabled,
        pendingReminders: state.pendingReminders,
        dismissedDefaultReminders: state.dismissedDefaultReminders,
      }),
    },
  ),
);
