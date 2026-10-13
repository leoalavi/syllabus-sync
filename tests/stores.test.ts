// tests/stores.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUnitsStore } from '@/lib/store/unitsStore';
import { useDeadlinesStore } from '@/lib/store/deadlinesStore';
import { useNotificationsStore } from '@/lib/store/notificationsStore';
import { useEventsStore } from '@/lib/store/eventsStore';
import { Unit, Deadline, Notification, Event } from '@/lib/types';
import { apiRequest } from '@/lib/utils/api';

vi.mock('@/lib/utils/api', () => ({
  apiRequest: vi.fn(),
}));

// These tests model a signed-in browser; only the stored-session gate is
// overridden so the stores' other auth helpers keep their real behaviour.
const hasStoredBrowserSessionMock = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/supabase/browserSession', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/browserSession')>()),
  hasStoredBrowserSession: () => hasStoredBrowserSessionMock(),
}));

const apiRequestMock = apiRequest as unknown as ReturnType<typeof vi.fn>;

describe('unitsStore', () => {
  const mockUnit: Unit = {
    id: 'test-unit-1',
    code: 'COMP2310',
    name: 'Networking',
    color: '#A6192E',
    location: { building: 'C5C', room: '204' },
    schedule: [{ id: 'schedule-1', day: 'Monday', startTime: '09:00', endTime: '11:00' }],
    createdAt: new Date(),
  };

  beforeEach(() => {
    // Reset store state before each test
    useUnitsStore.setState({ units: [], isLoading: false, hasLoaded: false });
    apiRequestMock.mockReset();
    const unitState: Unit[] = [];
    apiRequestMock.mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/units') && method === 'GET') {
        return unitState;
      }
      if (url.endsWith('/api/units') && method === 'POST') {
        const created = JSON.parse(String(init?.body));
        unitState.push(created);
        return created;
      }
      // Handle Atomic Sync Endpoint
      if (url.endsWith('/api/units/sync') && method === 'POST') {
        const payload = JSON.parse(String(init?.body));
        const index = unitState.findIndex((unit) => unit.id === payload.id);
        if (index >= 0) {
          unitState[index] = { ...unitState[index], ...payload };
          return unitState[index];
        }
        unitState.push(payload);
        return payload;
      }
      if (url.includes('/api/units/') && method === 'PUT') {
        const id = url.split('/').pop() as string;
        const updates = JSON.parse(String(init?.body));
        const index = unitState.findIndex((unit) => unit.id === id);
        if (index >= 0) {
          unitState[index] = { ...unitState[index], ...updates };
          return unitState[index];
        }
        return { id, ...updates };
      }
      if (url.includes('/api/units/') && method === 'DELETE') {
        const id = url.split('/').pop() as string;
        return { id };
      }
      throw new Error('Unhandled apiRequest call');
    });
  });

  it('should add a unit', async () => {
    const { addUnit } = useUnitsStore.getState();
    await addUnit(mockUnit);

    const { units } = useUnitsStore.getState();
    expect(units).toHaveLength(1);
    expect(units[0].code).toBe('COMP2310');
  });

  it('should remove a unit', async () => {
    useUnitsStore.setState({ units: [mockUnit] });

    const { removeUnit } = useUnitsStore.getState();
    await removeUnit('test-unit-1');

    const { units } = useUnitsStore.getState();
    expect(units).toHaveLength(0);
  });

  it('should update a unit', async () => {
    useUnitsStore.setState({ units: [mockUnit] });

    const { updateUnit } = useUnitsStore.getState();
    await updateUnit('test-unit-1', { name: 'Updated Name' });

    const { units } = useUnitsStore.getState();
    expect(units[0].name).toBe('Updated Name');
  });

  it('should get unit by code', () => {
    useUnitsStore.setState({ units: [mockUnit] });

    const { getUnitByCode } = useUnitsStore.getState();
    const unit = getUnitByCode('COMP2310');

    expect(unit).toBeDefined();
    expect(unit?.name).toBe('Networking');
  });

  it('should return undefined for non-existent unit code', () => {
    useUnitsStore.setState({ units: [mockUnit] });

    const { getUnitByCode } = useUnitsStore.getState();
    const unit = getUnitByCode('NONEXISTENT');

    expect(unit).toBeUndefined();
  });

  it('should cascade-delete deadlines when removing a unit', async () => {
    // Set up unit with two related deadlines
    useUnitsStore.setState({ units: [mockUnit] });
    useDeadlinesStore.setState({
      deadlines: [
        {
          id: 'deadline-1',
          title: 'Assignment 1',
          unitId: 'test-unit-1',
          unitCode: 'COMP2310',
          dueDate: new Date(),
          priority: 'High' as const,
          type: 'Assignment' as const,
          completed: false,
          createdAt: new Date(),
        },
        {
          id: 'deadline-2',
          title: 'Exam 1',
          unitId: 'test-unit-1',
          unitCode: 'COMP2310',
          dueDate: new Date(),
          priority: 'Medium' as const,
          type: 'Exam' as const,
          completed: false,
          createdAt: new Date(),
        },
      ],
      isLoading: false,
      hasLoaded: true,
    });

    // Mock DELETE to return cascadeDeleted: true
    apiRequestMock.mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';
      if (url.includes('/api/units/') && method === 'DELETE') {
        return { id: 'test-unit-1', code: 'COMP2310', cascadeDeleted: true };
      }
      throw new Error('Unhandled apiRequest call');
    });

    await useUnitsStore.getState().removeUnit('test-unit-1');

    expect(useUnitsStore.getState().units).toHaveLength(0);
    expect(useDeadlinesStore.getState().deadlines).toHaveLength(0);
  });
});

describe('deadlinesStore', () => {
  const mockDeadline: Deadline = {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Assignment 1',
    unitCode: 'COMP2310',
    dueDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
    priority: 'High',
    type: 'Assignment',
    completed: false,
    createdAt: new Date(),
  };

  beforeEach(() => {
    // Reset store state before each test
    useDeadlinesStore.setState({
      deadlines: [],
      isLoading: false,
      hasLoaded: false,
    });
    apiRequestMock.mockReset();
    const deadlineState: Deadline[] = [];
    apiRequestMock.mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';
      if (url.endsWith('/api/deadlines') && method === 'GET') {
        return deadlineState;
      }
      if (url.endsWith('/api/deadlines') && method === 'POST') {
        const created = JSON.parse(String(init?.body));
        deadlineState.push(created);
        return created;
      }
      if (url.includes('/api/deadlines/') && method === 'PUT') {
        const id = url.split('/').pop() as string;
        const updates = JSON.parse(String(init?.body));
        const index = deadlineState.findIndex((deadline) => deadline.id === id);
        if (index >= 0) {
          deadlineState[index] = { ...deadlineState[index], ...updates };
          return deadlineState[index];
        }
        return { id, ...updates };
      }
      if (url.includes('/api/deadlines/') && method === 'DELETE') {
        const id = url.split('/').pop() as string;
        return { id };
      }
      if (url.includes('/api/notifications/') && method === 'DELETE') {
        const id = url.split('/').pop() as string;
        return { id };
      }
      throw new Error('Unhandled apiRequest call');
    });
  });

  it('should add a deadline', async () => {
    const { addDeadline } = useDeadlinesStore.getState();
    await addDeadline(mockDeadline);

    const { deadlines } = useDeadlinesStore.getState();
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].title).toBe('Assignment 1');
  });

  it('should remove a deadline', async () => {
    useDeadlinesStore.setState({ deadlines: [mockDeadline] });

    const { removeDeadline } = useDeadlinesStore.getState();
    await removeDeadline('11111111-1111-1111-1111-111111111111');

    const { deadlines } = useDeadlinesStore.getState();
    expect(deadlines).toHaveLength(0);
  });

  it('should update a deadline', async () => {
    useDeadlinesStore.setState({ deadlines: [mockDeadline] });

    const { updateDeadline } = useDeadlinesStore.getState();
    await updateDeadline('11111111-1111-1111-1111-111111111111', {
      title: 'Updated Title',
    });

    const { deadlines } = useDeadlinesStore.getState();
    expect(deadlines[0].title).toBe('Updated Title');
  });

  it('should toggle deadline completion', async () => {
    useDeadlinesStore.setState({ deadlines: [mockDeadline] });

    const { toggleComplete } = useDeadlinesStore.getState();
    await toggleComplete('11111111-1111-1111-1111-111111111111');

    const { deadlines } = useDeadlinesStore.getState();
    expect(deadlines[0].completed).toBe(true);
  });

  it('should get upcoming deadlines sorted by due date', () => {
    const deadline1 = {
      ...mockDeadline,
      id: '22222222-2222-2222-2222-222222222222',
      dueDate: new Date(Date.now() + 86400000 * 5),
    };
    const deadline2 = {
      ...mockDeadline,
      id: '33333333-3333-3333-3333-333333333333',
      dueDate: new Date(Date.now() + 86400000),
    };
    const deadline3 = {
      ...mockDeadline,
      id: '44444444-4444-4444-4444-444444444444',
      dueDate: new Date(Date.now() + 86400000 * 3),
      completed: true,
    };

    useDeadlinesStore.setState({
      deadlines: [deadline1, deadline2, deadline3],
    });

    const { getUpcoming } = useDeadlinesStore.getState();
    const upcoming = getUpcoming(3);

    expect(upcoming).toHaveLength(2); // Excludes completed
    expect(upcoming[0].id).toBe('33333333-3333-3333-3333-333333333333'); // Closest due date first
    expect(upcoming[1].id).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('should calculate stress level correctly', () => {
    // Low stress - no deadlines
    useDeadlinesStore.setState({ deadlines: [] });
    let { getStressLevel } = useDeadlinesStore.getState();
    expect(getStressLevel()).toBe('Low');

    // High stress - multiple urgent deadlines soon
    const urgentDeadlines = [
      {
        ...mockDeadline,
        id: '55555555-5555-5555-5555-555555555555',
        priority: 'Urgent' as const,
        dueDate: new Date(Date.now() + 86400000),
      },
      {
        ...mockDeadline,
        id: '66666666-6666-6666-6666-666666666666',
        priority: 'Urgent' as const,
        dueDate: new Date(Date.now() + 86400000),
      },
      {
        ...mockDeadline,
        id: '77777777-7777-7777-7777-777777777777',
        priority: 'High' as const,
        dueDate: new Date(Date.now() + 86400000 * 2),
      },
      {
        ...mockDeadline,
        id: '88888888-8888-8888-8888-888888888888',
        priority: 'High' as const,
        dueDate: new Date(Date.now() + 86400000 * 2),
      },
    ];
    useDeadlinesStore.setState({ deadlines: urgentDeadlines });
    ({ getStressLevel } = useDeadlinesStore.getState());
    expect(getStressLevel()).toBe('High');
  });

  it('should clean up notifications when deleting a deadline', async () => {
    const deadlineId = '11111111-1111-1111-1111-111111111111';
    useDeadlinesStore.setState({ deadlines: [mockDeadline] });
    useNotificationsStore.setState({
      notifications: [
        {
          id: 'aaaa1111-1111-1111-1111-111111111111',
          title: 'Deadline Reminder',
          message: 'Due soon',
          type: 'deadline',
          read: false,
          createdAt: new Date(),
          relatedId: deadlineId,
        },
        {
          id: 'bbbb2222-2222-2222-2222-222222222222',
          title: 'Other',
          message: 'Unrelated',
          type: 'system',
          read: false,
          createdAt: new Date(),
        },
      ],
    });

    await useDeadlinesStore.getState().removeDeadline(deadlineId);

    expect(useDeadlinesStore.getState().deadlines).toHaveLength(0);
    const notifs = useNotificationsStore.getState().notifications;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].id).toBe('bbbb2222-2222-2222-2222-222222222222');
  });
});

describe('notificationsStore', () => {
  const mockNotification: Notification = {
    id: 'notif-1',
    title: 'Welcome',
    message: 'Test notification',
    type: 'system',
    read: false,
    createdAt: new Date(),
    link: '/home',
  };

  beforeEach(() => {
    useNotificationsStore.setState({
      notifications: [],
      isLoading: false,
      hasLoaded: false,
    });
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (input: RequestInfo) => {
      const url = input.toString();
      if (url.endsWith('/api/notifications')) {
        return [];
      }
      throw new Error('Unhandled apiRequest call');
    });
  });

  it('should add a notification', () => {
    const { addNotification } = useNotificationsStore.getState();
    addNotification(mockNotification);

    const { notifications } = useNotificationsStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('Welcome');
  });

  it('should strip relatedId from system notifications before POST to avoid 409 conflicts', async () => {
    const relatedId = '11111111-1111-1111-1111-111111111111';
    apiRequestMock.mockImplementationOnce(async (_input: RequestInfo, _init?: RequestInit) => {
      return {
        id: '22222222-2222-2222-2222-222222222222',
        title: 'Reminder set',
        message: 'Body',
        type: 'system',
        read: false,
        createdAt: new Date().toISOString(),
        link: 'http://localhost/calendar',
        relatedId: undefined,
      };
    });

    await useNotificationsStore.getState().addNotification({
      title: 'Reminder set',
      message: 'Body',
      type: 'system',
      read: false,
      link: '/calendar',
      relatedId,
    });

    const [, requestInit] = apiRequestMock.mock.calls[0];
    const body = JSON.parse(String((requestInit as RequestInit).body));
    expect(body.relatedId).toBeUndefined();
  });

  it('should mark a notification as read', () => {
    useNotificationsStore.setState({ notifications: [mockNotification] });

    const { markAsRead } = useNotificationsStore.getState();
    markAsRead('notif-1');

    const { notifications } = useNotificationsStore.getState();
    expect(notifications[0].read).toBe(true);
  });

  it('should mark all notifications as read', () => {
    const notification2 = { ...mockNotification, id: 'notif-2', read: false };
    useNotificationsStore.setState({
      notifications: [mockNotification, notification2],
    });

    const { markAllAsRead } = useNotificationsStore.getState();
    markAllAsRead();

    const { notifications } = useNotificationsStore.getState();
    expect(notifications.every((n) => n.read)).toBe(true);
  });

  it('should remove a notification', () => {
    useNotificationsStore.setState({ notifications: [mockNotification] });

    const { removeNotification } = useNotificationsStore.getState();
    removeNotification('notif-1');

    const { notifications } = useNotificationsStore.getState();
    expect(notifications).toHaveLength(0);
  });

  it('should remove temp-ID notification locally without API call', async () => {
    const tempNotification: Notification = {
      id: 'temp-1234567890-abcdef',
      title: 'Temp',
      message: 'Optimistic notification',
      type: 'system',
      read: false,
      createdAt: new Date(),
    };
    useNotificationsStore.setState({ notifications: [tempNotification] });

    apiRequestMock.mockReset();

    await useNotificationsStore.getState().removeNotification('temp-1234567890-abcdef');

    expect(useNotificationsStore.getState().notifications).toHaveLength(0);
    // No API call should have been made for a temp ID
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it('should restore original order on delete API failure', async () => {
    const n1: Notification = {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'First',
      message: 'First',
      type: 'system',
      read: false,
      createdAt: new Date(),
    };
    const n2: Notification = {
      id: '22222222-2222-2222-2222-222222222222',
      title: 'Second',
      message: 'Second',
      type: 'system',
      read: false,
      createdAt: new Date(),
    };
    useNotificationsStore.setState({ notifications: [n1, n2] });

    apiRequestMock.mockRejectedValueOnce(new Error('500 Internal Server Error'));

    await useNotificationsStore.getState().removeNotification(n1.id);

    // Should be restored to original order, not appended
    const { notifications } = useNotificationsStore.getState();
    expect(notifications).toHaveLength(2);
    expect(notifications[0].id).toBe(n1.id);
    expect(notifications[1].id).toBe(n2.id);
  });

  it('should preserve existing notifications when loadNotifications hits auth errors', async () => {
    useNotificationsStore.setState({
      notifications: [mockNotification],
      isLoading: false,
      hasLoaded: false,
      lastLoadedAt: null,
    });

    apiRequestMock.mockRejectedValueOnce(new Error('401: Valid authentication token required'));

    await useNotificationsStore.getState().loadNotifications({ force: true });

    const { notifications, hasLoaded } = useNotificationsStore.getState();
    expect(hasLoaded).toBe(true);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBe(mockNotification.id);
  });

  it('skips the request entirely when no session is stored (signed-out visitor)', async () => {
    useNotificationsStore.setState({
      notifications: [],
      isLoading: false,
      hasLoaded: false,
      lastLoadedAt: null,
    });
    apiRequestMock.mockClear();
    hasStoredBrowserSessionMock.mockResolvedValueOnce(false);

    await useNotificationsStore.getState().loadNotifications({ force: true });

    expect(apiRequestMock).not.toHaveBeenCalled();
    expect(useNotificationsStore.getState().isLoading).toBe(false);
  });

  it('should get unread count', () => {
    const notification2 = { ...mockNotification, id: 'notif-2', read: true };
    useNotificationsStore.setState({
      notifications: [mockNotification, notification2],
    });

    const { getUnreadCount } = useNotificationsStore.getState();
    expect(getUnreadCount()).toBe(1);
  });
});

describe('eventsStore — notification cleanup on delete', () => {
  const mockEvent: Event = {
    id: 'eeee1111-1111-1111-1111-111111111111',
    title: 'Campus Tour',
    description: 'A campus tour',
    category: 'Academic',
    allDay: false,
    startAt: new Date('2026-03-20T10:00:00'),
    date: new Date('2026-03-20T10:00:00'),
    time: '10:00 AM',
  };

  beforeEach(() => {
    useEventsStore.setState({ events: [], isLoading: false, hasLoaded: false });
    useNotificationsStore.setState({
      notifications: [],
      isLoading: false,
      hasLoaded: false,
      lastLoadedAt: null,
    });
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? 'GET';
      if (url.includes('/api/events/') && method === 'DELETE') {
        return { id: url.split('/').pop() };
      }
      if (url.includes('/api/notifications/') && method === 'DELETE') {
        return { id: url.split('/').pop() };
      }
      throw new Error('Unhandled apiRequest call');
    });
  });

  it('should clean up notifications when deleting an event', async () => {
    useEventsStore.setState({ events: [mockEvent] });
    useNotificationsStore.setState({
      notifications: [
        {
          id: 'cccc1111-1111-1111-1111-111111111111',
          title: 'Event Reminder',
          message: 'Campus Tour soon',
          type: 'event',
          read: false,
          createdAt: new Date(),
          relatedId: mockEvent.id,
        },
        {
          id: 'dddd2222-2222-2222-2222-222222222222',
          title: 'Other',
          message: 'Unrelated',
          type: 'system',
          read: false,
          createdAt: new Date(),
        },
      ],
    });

    await useEventsStore.getState().removeEvent(mockEvent.id);

    expect(useEventsStore.getState().events).toHaveLength(0);
    const notifs = useNotificationsStore.getState().notifications;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].id).toBe('dddd2222-2222-2222-2222-222222222222');
  });
});
