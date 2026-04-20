// lib/store/remindersStore.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type ReminderItemType = 'unit' | 'exam' | 'assignment' | 'event' | 'todo';

export type ReminderTiming =
  | '15min'
  | '30min'
  | '1hour'
  | '2hours'
  | '1day'
  | '2days'
  | '1week'
  | 'custom';

export interface Reminder {
  id: string;
  itemId: string; // ID of the related item (unit, deadline, event, todo)
  itemType: ReminderItemType;
  itemTitle: string; // Title for display
  itemDate?: string; // ISO date string of the item being reminded about
  timing: ReminderTiming;
  customDate?: string; // ISO date string for custom timing
  customTime?: string; // HH:mm format for custom timing
  enabled: boolean;
  createdAt: Date;
  notifiedAt?: Date; // When the notification was sent
}

interface RemindersState {
  reminders: Reminder[];
  hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // CRUD operations
  addReminder: (reminder: Omit<Reminder, 'id' | 'createdAt'>) => Reminder;
  updateReminder: (id: string, updates: Partial<Omit<Reminder, 'id' | 'createdAt'>>) => void;
  removeReminder: (id: string) => void;

  // Getters
  /** Returns only the *active* reminder (enabled, unfired, trigger still in the future). Used by UI bell state. */
  getReminderForItem: (itemId: string, itemType: ReminderItemType) => Reminder | undefined;
  /** Returns any existing reminder for the item/type pair, including fired ones. Used by the reminder modal so users can re-activate a fired reminder in place. */
  findAnyReminderForItem: (itemId: string, itemType: ReminderItemType) => Reminder | undefined;
  getRemindersForItem: (itemId: string) => Reminder[];
  getPendingReminders: () => Reminder[];

  // Utility
  markAsNotified: (id: string) => void;
  clearExpiredReminders: () => void;
  reset: () => void;
}

function shouldRearmReminder(updates: Partial<Omit<Reminder, 'id' | 'createdAt'>>): boolean {
  return (
    updates.enabled === true ||
    updates.timing !== undefined ||
    updates.customDate !== undefined ||
    updates.customTime !== undefined ||
    updates.itemDate !== undefined
  );
}

// Calculate reminder date based on timing and target date
export function calculateReminderDate(
  targetDate: Date,
  timing: ReminderTiming,
  customDate?: string,
  customTime?: string,
): Date {
  if (timing === 'custom' && customDate) {
    const [year, month, day] = customDate.split('-').map(Number);
    if (customTime) {
      const [hours, minutes] = customTime.split(':').map(Number);
      return new Date(year, month - 1, day, hours, minutes);
    }
    return new Date(year, month - 1, day, 9, 0); // Default to 9 AM
  }

  const date = new Date(targetDate);
  switch (timing) {
    case '15min':
      date.setMinutes(date.getMinutes() - 15);
      break;
    case '30min':
      date.setMinutes(date.getMinutes() - 30);
      break;
    case '1hour':
      date.setHours(date.getHours() - 1);
      break;
    case '2hours':
      date.setHours(date.getHours() - 2);
      break;
    case '1day':
      date.setDate(date.getDate() - 1);
      break;
    case '2days':
      date.setDate(date.getDate() - 2);
      break;
    case '1week':
      date.setDate(date.getDate() - 7);
      break;
  }
  return date;
}

/**
 * Compute the actual wall-clock trigger time for a reminder.
 * Returns `null` when the reminder lacks the data needed (e.g. custom with no date,
 * or preset with no itemDate) — callers should treat `null` as "not yet schedulable".
 */
export function getReminderTriggerDate(reminder: {
  timing: ReminderTiming;
  itemDate?: string;
  customDate?: string;
  customTime?: string;
}): Date | null {
  if (reminder.timing === 'custom') {
    if (!reminder.customDate) return null;
    const [year, month, day] = reminder.customDate.split('-').map(Number);
    if (reminder.customTime) {
      const [hours, minutes] = reminder.customTime.split(':').map(Number);
      return new Date(year, month - 1, day, hours, minutes);
    }
    return new Date(year, month - 1, day, 9, 0);
  }
  if (!reminder.itemDate) return null;
  const itemDate = new Date(reminder.itemDate);
  if (isNaN(itemDate.getTime())) return null;
  return calculateReminderDate(itemDate, reminder.timing);
}

// Get timing label for display
export function getTimingLabel(timing: ReminderTiming): string {
  switch (timing) {
    case '15min':
      return '15 minutes before';
    case '30min':
      return '30 minutes before';
    case '1hour':
      return '1 hour before';
    case '2hours':
      return '2 hours before';
    case '1day':
      return '1 day before';
    case '2days':
      return '2 days before';
    case '1week':
      return '1 week before';
    case 'custom':
      return 'Custom time';
    default:
      return timing;
  }
}

export const useRemindersStore = create<RemindersState>()(
  persist(
    (set, get) => ({
      reminders: [],
      hasHydrated: false,

      setHasHydrated: (state) => set({ hasHydrated: state }),

      addReminder: (reminderData) => {
        const reminder: Reminder = {
          ...reminderData,
          id: uuidv4(),
          createdAt: new Date(),
        };

        set((state) => ({
          reminders: [...state.reminders, reminder],
        }));

        return reminder;
      },

      updateReminder: (id, updates) => {
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...updates,
                  // Editing or re-enabling a reminder should arm it again.
                  // Without this, a previously-fired reminder keeps its old
                  // notifiedAt timestamp and the checker will skip it forever.
                  ...(shouldRearmReminder(updates) ? { notifiedAt: undefined } : {}),
                }
              : r,
          ),
        }));
      },

      removeReminder: (id) => {
        set((state) => ({
          reminders: state.reminders.filter((r) => r.id !== id),
        }));
      },

      getReminderForItem: (itemId, itemType) => {
        const now = Date.now();
        return get().reminders.find((r) => {
          if (r.itemId !== itemId || r.itemType !== itemType) return false;
          if (!r.enabled) return false;
          // Already fired → no longer "active" in the UI, even if flag cleanup is pending
          if (r.notifiedAt) return false;
          // Trigger time has already elapsed → treat as inactive so the bell decolors
          // immediately on render, without waiting for useReminderChecker to tick
          const trigger = getReminderTriggerDate(r);
          if (trigger && trigger.getTime() <= now) return false;
          return true;
        });
      },

      findAnyReminderForItem: (itemId, itemType) => {
        // Most-recently-created first, so the modal edits the latest row
        // even if historical fired rows exist for the same item.
        const matches = get().reminders.filter(
          (r) => r.itemId === itemId && r.itemType === itemType,
        );
        if (matches.length === 0) return undefined;
        return matches.reduce((latest, r) =>
          new Date(r.createdAt).getTime() > new Date(latest.createdAt).getTime() ? r : latest,
        );
      },

      getRemindersForItem: (itemId) => {
        return get().reminders.filter((r) => r.itemId === itemId);
      },

      getPendingReminders: () => {
        return get().reminders.filter((r) => r.enabled && !r.notifiedAt);
      },

      markAsNotified: (id) => {
        // notifiedAt acts as the "consumed" flag — getReminderForItem filters
        // by it so the bell uncolors immediately. We intentionally keep `enabled`
        // true so the modal's prefill lookup (findAnyReminderForItem) still
        // recognises it for re-activation; shouldRearmReminder() clears
        // notifiedAt when the user saves the modal again.
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.id === id ? { ...r, notifiedAt: new Date() } : r,
          ),
        }));
      },

      clearExpiredReminders: () => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        set((state) => ({
          reminders: state.reminders.filter(
            (r) => !r.notifiedAt || new Date(r.notifiedAt) > oneWeekAgo,
          ),
        }));
      },

      reset: () => {
        set({ reminders: [], hasHydrated: false });
      },
    }),
    {
      name: 'syllabus-sync-reminders',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        reminders: state.reminders,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
