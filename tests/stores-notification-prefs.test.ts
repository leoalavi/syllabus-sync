/**
 * Notification Preferences Store Tests
 * Heavy branch coverage: toggles, timings, scheduling guards, cancel, clear, reset
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNotificationPreferencesStore } from '@/lib/store/notificationPreferencesStore';

const apiRequestMock = vi.fn();
const hasStoredBrowserSessionMock = vi.fn().mockResolvedValue(true);

vi.mock('@/lib/utils/api', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

vi.mock('@/lib/supabase/browserSession', () => ({
  hasStoredBrowserSession: () => hasStoredBrowserSessionMock(),
}));

// Mock the notificationService to avoid real browser APIs
vi.mock('@/lib/services/notificationService', () => ({
  notificationService: {
    getPermissionStatus: vi.fn().mockReturnValue('default'),
    requestPermission: vi.fn().mockResolvedValue('granted'),
    subscribeToPush: vi.fn().mockResolvedValue(true),
    unsubscribeFromPush: vi.fn().mockResolvedValue(true),
    isPushSupported: vi.fn().mockReturnValue(true),
    isNotificationTypeEnabled: vi.fn().mockReturnValue(true),
    setNotificationTypeEnabled: vi.fn(),
    sendDeadlineReminder: vi.fn().mockResolvedValue(true),
    sendClassReminder: vi.fn().mockResolvedValue(true),
    sendEventReminder: vi.fn().mockResolvedValue(true),
  },
  NotificationPermissionStatus: {},
}));

vi.mock('@/lib/store/notificationsStore', () => ({
  useNotificationsStore: {
    getState: () => ({ addNotification: vi.fn() }),
  },
}));

describe('notificationPreferencesStore', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({});
    useNotificationPreferencesStore.getState().reset();
  });

  it('initializes with default state', () => {
    const s = useNotificationPreferencesStore.getState();
    expect(s.permissionStatus).toBe('default');
    expect(s.deadlinesEnabled).toBe(true);
    expect(s.classesEnabled).toBe(true);
    expect(s.eventsEnabled).toBe(true);
    expect(s.deadlineReminderTiming).toBe(1440);
    expect(s.classReminderTiming).toBe(15);
    expect(s.eventReminderTiming).toBe(60);
    expect(s.pushEnabled).toBe(true);
    expect(s.scheduledReminders).toEqual({});
    expect(s.pendingReminders).toEqual({});
  });

  it('setDeadlinesEnabled toggles deadlines and persists to the API', async () => {
    await useNotificationPreferencesStore.getState().setDeadlinesEnabled(false);
    expect(useNotificationPreferencesStore.getState().deadlinesEnabled).toBe(false);
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/user-preferences',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ deadline_notifications_enabled: false }),
      }),
    );
    await useNotificationPreferencesStore.getState().setDeadlinesEnabled(true);
    expect(useNotificationPreferencesStore.getState().deadlinesEnabled).toBe(true);
  });

  it('setClassesEnabled toggles classes and persists to the API', async () => {
    await useNotificationPreferencesStore.getState().setClassesEnabled(false);
    expect(useNotificationPreferencesStore.getState().classesEnabled).toBe(false);
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/user-preferences',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ class_notifications_enabled: false }),
      }),
    );
  });

  it('setEventsEnabled toggles events and persists to the API', async () => {
    await useNotificationPreferencesStore.getState().setEventsEnabled(false);
    expect(useNotificationPreferencesStore.getState().eventsEnabled).toBe(false);
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/user-preferences',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ event_notifications_enabled: false }),
      }),
    );
  });

  it('setPushEnabled disables push and clears all reminders', async () => {
    useNotificationPreferencesStore.setState({
      scheduledReminders: { a: 1 },
      pendingReminders: { a: { type: 'deadline', payload: {}, triggerAt: 0 } },
    });
    await useNotificationPreferencesStore.getState().setPushEnabled(false);
    expect(useNotificationPreferencesStore.getState().pushEnabled).toBe(false);
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
    expect(useNotificationPreferencesStore.getState().pendingReminders).toEqual({});
  });

  it('setPushEnabled(true) does not clear reminders', async () => {
    useNotificationPreferencesStore.setState({
      scheduledReminders: { a: 1 },
      pushEnabled: false,
      permissionStatus: 'granted',
    });
    await useNotificationPreferencesStore.getState().setPushEnabled(true);
    expect(useNotificationPreferencesStore.getState().pushEnabled).toBe(true);
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({ a: 1 });
  });

  it('setDeadlineReminderTiming changes timing and persists to the API', async () => {
    await useNotificationPreferencesStore.getState().setDeadlineReminderTiming(60);
    expect(useNotificationPreferencesStore.getState().deadlineReminderTiming).toBe(60);
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/user-preferences',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ deadline_reminder_timing_minutes: 60 }),
      }),
    );
  });

  it('setClassReminderTiming changes timing and persists to the API', async () => {
    await useNotificationPreferencesStore.getState().setClassReminderTiming(30);
    expect(useNotificationPreferencesStore.getState().classReminderTiming).toBe(30);
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/user-preferences',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ class_reminder_timing_minutes: 30 }),
      }),
    );
  });

  it('setEventReminderTiming changes timing and persists to the API', async () => {
    await useNotificationPreferencesStore.getState().setEventReminderTiming(120);
    expect(useNotificationPreferencesStore.getState().eventReminderTiming).toBe(120);
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/user-preferences',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ event_reminder_timing_minutes: 120 }),
      }),
    );
  });

  it('rolls back reminder toggles when the database update fails', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('500: failed to save'));

    const saved = await useNotificationPreferencesStore.getState().setClassesEnabled(false);

    expect(saved).toBe(false);
    expect(useNotificationPreferencesStore.getState().classesEnabled).toBe(true);
  });

  it('rolls back reminder timing when the database update fails', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('500: failed to save'));

    const saved = await useNotificationPreferencesStore.getState().setEventReminderTiming(120);

    expect(saved).toBe(false);
    expect(useNotificationPreferencesStore.getState().eventReminderTiming).toBe(60);
  });

  it('requestPermission updates permissionStatus', async () => {
    const status = await useNotificationPreferencesStore.getState().requestPermission();
    expect(status).toBe('granted');
    expect(useNotificationPreferencesStore.getState().permissionStatus).toBe('granted');
  });

  it('initialize sets permission and syncs type toggles', async () => {
    apiRequestMock.mockResolvedValueOnce({
      push_notifications: false,
      deadline_notifications_enabled: true,
      class_notifications_enabled: true,
      event_notifications_enabled: true,
      deadline_reminder_timing_minutes: 30,
    });
    await useNotificationPreferencesStore.getState().initialize();
    const s = useNotificationPreferencesStore.getState();
    expect(s.permissionStatus).toBe('default');
    expect(s.deadlinesEnabled).toBe(true);
    expect(s.classesEnabled).toBe(true);
    expect(s.eventsEnabled).toBe(true);
    expect(s.pushEnabled).toBe(false);
    expect(s.deadlineReminderTiming).toBe(30);
  });

  it('initialize skips the server request when no session is stored', async () => {
    hasStoredBrowserSessionMock.mockResolvedValueOnce(false);
    await useNotificationPreferencesStore.getState().initialize();
    expect(apiRequestMock).not.toHaveBeenCalledWith('/api/user-preferences', expect.anything());
    expect(useNotificationPreferencesStore.getState().permissionStatus).toBe('default');
  });

  // scheduleDeadlineReminder guards
  it('scheduleDeadlineReminder does nothing if push disabled', () => {
    useNotificationPreferencesStore.setState({ pushEnabled: false });
    useNotificationPreferencesStore
      .getState()
      .scheduleDeadlineReminder('d1', 'Title', 'COMP2310', new Date(Date.now() + 86400000));
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
  });

  it('scheduleDeadlineReminder does nothing if deadlines disabled', () => {
    useNotificationPreferencesStore.setState({
      deadlinesEnabled: false,
      permissionStatus: 'granted',
    });
    useNotificationPreferencesStore
      .getState()
      .scheduleDeadlineReminder('d1', 'Title', 'COMP2310', new Date(Date.now() + 86400000));
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
  });

  it('scheduleDeadlineReminder does nothing if permission not granted', () => {
    useNotificationPreferencesStore.setState({ permissionStatus: 'denied' });
    useNotificationPreferencesStore
      .getState()
      .scheduleDeadlineReminder('d1', 'Title', 'COMP2310', new Date(Date.now() + 86400000));
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
  });

  it('scheduleDeadlineReminder schedules a future reminder', () => {
    useNotificationPreferencesStore.setState({
      permissionStatus: 'granted',
      pushEnabled: true,
      deadlinesEnabled: true,
      deadlineReminderTiming: 60, // 1 hour
    });

    const futureDate = new Date(Date.now() + 7200000); // 2 hours from now
    useNotificationPreferencesStore
      .getState()
      .scheduleDeadlineReminder('d1', 'Assignment 1', 'COMP2310', futureDate);

    const s = useNotificationPreferencesStore.getState();
    expect(s.scheduledReminders['d1']).toBeDefined();
    expect(s.pendingReminders['d1']).toBeDefined();
    expect(s.pendingReminders['d1'].type).toBe('deadline');
  });

  // scheduleClassReminder guards
  it('scheduleClassReminder does nothing if push disabled', () => {
    useNotificationPreferencesStore.setState({ pushEnabled: false });
    useNotificationPreferencesStore
      .getState()
      .scheduleClassReminder(
        'COMP2310',
        'Networking',
        'C5C',
        '204',
        new Date(Date.now() + 86400000),
      );
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
  });

  it('scheduleClassReminder does nothing if classes disabled', () => {
    useNotificationPreferencesStore.setState({
      classesEnabled: false,
      permissionStatus: 'granted',
    });
    useNotificationPreferencesStore
      .getState()
      .scheduleClassReminder(
        'COMP2310',
        'Networking',
        'C5C',
        '204',
        new Date(Date.now() + 86400000),
      );
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
  });

  it('scheduleClassReminder schedules a future reminder', () => {
    useNotificationPreferencesStore.setState({
      permissionStatus: 'granted',
      pushEnabled: true,
      classesEnabled: true,
      classReminderTiming: 15,
    });
    const classTime = new Date(Date.now() + 3600000); // 1 hr from now
    useNotificationPreferencesStore
      .getState()
      .scheduleClassReminder('COMP2310', 'Networking', 'C5C', '204', classTime);
    const keys = Object.keys(useNotificationPreferencesStore.getState().scheduledReminders);
    expect(keys.length).toBeGreaterThan(0);
  });

  // scheduleEventReminder guards
  it('scheduleEventReminder does nothing if push disabled', () => {
    useNotificationPreferencesStore.setState({ pushEnabled: false });
    useNotificationPreferencesStore
      .getState()
      .scheduleEventReminder('e1', 'Event', 'Loc', new Date(Date.now() + 86400000));
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
  });

  it('scheduleEventReminder does nothing if events disabled', () => {
    useNotificationPreferencesStore.setState({ eventsEnabled: false, permissionStatus: 'granted' });
    useNotificationPreferencesStore
      .getState()
      .scheduleEventReminder('e1', 'Event', 'Loc', new Date(Date.now() + 86400000));
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
  });

  it('scheduleEventReminder schedules a future reminder', () => {
    useNotificationPreferencesStore.setState({
      permissionStatus: 'granted',
      pushEnabled: true,
      eventsEnabled: true,
      eventReminderTiming: 60,
    });
    const eventTime = new Date(Date.now() + 7200000); // 2 hrs from now
    useNotificationPreferencesStore
      .getState()
      .scheduleEventReminder('e1', 'Open Day', 'C5C', eventTime);
    expect(useNotificationPreferencesStore.getState().scheduledReminders['e1']).toBeDefined();
  });

  it('cancelReminder clears a scheduled reminder', () => {
    useNotificationPreferencesStore.setState({
      scheduledReminders: { r1: 123 },
      pendingReminders: { r1: { type: 'deadline', payload: {}, triggerAt: 0 } },
    });
    useNotificationPreferencesStore.getState().cancelReminder('r1');
    expect(useNotificationPreferencesStore.getState().scheduledReminders['r1']).toBeUndefined();
    expect(useNotificationPreferencesStore.getState().pendingReminders['r1']).toBeUndefined();
  });

  it('cancelReminder does nothing for unknown id', () => {
    useNotificationPreferencesStore.getState().cancelReminder('unknown');
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
  });

  it('clearAllReminders clears everything', () => {
    useNotificationPreferencesStore.setState({
      scheduledReminders: { a: 1, b: 2 },
      pendingReminders: { a: { type: 'deadline', payload: {}, triggerAt: 0 } },
    });
    useNotificationPreferencesStore.getState().clearAllReminders();
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
    expect(useNotificationPreferencesStore.getState().pendingReminders).toEqual({});
  });

  it('reschedulePending does nothing if push disabled', () => {
    useNotificationPreferencesStore.setState({
      pushEnabled: false,
      pendingReminders: { x: { type: 'deadline', payload: {}, triggerAt: Date.now() + 60000 } },
    });
    useNotificationPreferencesStore.getState().reschedulePending();
    // Should not schedule any timeouts
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
  });

  it('reschedulePending does nothing if permission not granted', () => {
    useNotificationPreferencesStore.setState({
      pushEnabled: true,
      permissionStatus: 'denied',
      pendingReminders: { x: { type: 'deadline', payload: {}, triggerAt: Date.now() + 60000 } },
    });
    useNotificationPreferencesStore.getState().reschedulePending();
    expect(useNotificationPreferencesStore.getState().scheduledReminders).toEqual({});
  });

  it('reschedulePending removes expired reminders', () => {
    useNotificationPreferencesStore.setState({
      pushEnabled: true,
      permissionStatus: 'granted',
      pendingReminders: {
        expired: {
          type: 'deadline',
          payload: { title: 'T', unitCode: 'U', dueDate: 0 },
          triggerAt: Date.now() - 1000,
        },
      },
    });
    useNotificationPreferencesStore.getState().reschedulePending();
    expect(useNotificationPreferencesStore.getState().pendingReminders['expired']).toBeUndefined();
  });

  it('reschedulePending reschedules future reminders', () => {
    useNotificationPreferencesStore.setState({
      pushEnabled: true,
      permissionStatus: 'granted',
      pendingReminders: {
        future: {
          type: 'deadline',
          payload: { title: 'T', unitCode: 'U', dueDate: Date.now() + 120000 },
          triggerAt: Date.now() + 60000,
        },
      },
    });
    useNotificationPreferencesStore.getState().reschedulePending();
    expect(useNotificationPreferencesStore.getState().scheduledReminders['future']).toBeDefined();
  });

  it('reset clears all state', () => {
    useNotificationPreferencesStore.setState({
      deadlinesEnabled: false,
      classesEnabled: false,
      eventsEnabled: false,
      pushEnabled: false,
      deadlineReminderTiming: 30,
      classReminderTiming: 5,
      eventReminderTiming: 30,
      scheduledReminders: { a: 1 },
      pendingReminders: { a: { type: 'deadline', payload: {}, triggerAt: 0 } },
    });
    useNotificationPreferencesStore.getState().reset();
    const s = useNotificationPreferencesStore.getState();
    expect(s.deadlinesEnabled).toBe(true);
    expect(s.pushEnabled).toBe(true);
    expect(s.scheduledReminders).toEqual({});
    expect(s.pendingReminders).toEqual({});
  });
});
