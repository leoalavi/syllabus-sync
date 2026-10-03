import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { format } from 'date-fns';
import translations from '../locales/en/translations.json';

// Use vi.hoisted to ensure mock state is available when vi.mock factories run
const { deadlinesState, unitsState, eventsState, todosState } = vi.hoisted(() => ({
  deadlinesState: {
    deadlines: [
      {
        id: 'deadline-1',
        title: 'Assignment 1',
        unitCode: 'COMP2310',
        dueDate: new Date(2026, 0, 15, 14, 30),
        priority: 'High',
        type: 'Assignment',
        completed: false,
        createdAt: new Date(),
      },
    ],
    toggleComplete: vi.fn(),
    getStressLevel: vi.fn(() => 'Low'),
    addDeadline: vi.fn(),
    updateDeadline: vi.fn(),
    removeDeadline: vi.fn(),
    removeDeadlinesByUnit: vi.fn(),
    loadDeadlines: vi.fn(),
    forceRefresh: vi.fn(),
  },
  unitsState: {
    units: [
      {
        id: 'unit-comp2310',
        code: 'COMP2310',
        name: 'Networking',
        color: '#A6192E',
        location: { building: 'C5C', room: '204' },
        schedule: [],
        createdAt: new Date(),
      },
    ],
    loadUnits: vi.fn(),
    removeUnit: vi.fn(),
    forceRefresh: vi.fn(),
  },
  eventsState: {
    events: [],
    loadEvents: vi.fn(),
    removeEvent: vi.fn(),
    forceRefresh: vi.fn(),
  },
  todosState: {
    todos: [],
    loadTodos: vi.fn(),
    addTodo: vi.fn(),
    removeTodo: vi.fn(),
    updateTodo: vi.fn(),
    forceRefresh: vi.fn(),
  },
}));

vi.mock('@/lib/store/deadlinesStore', () => ({
  useDeadlinesStore: (selector?: (state: typeof deadlinesState) => unknown) =>
    selector ? selector(deadlinesState) : deadlinesState,
}));

vi.mock('@/lib/store/unitsStore', () => ({
  useUnitsStore: (selector: (state: typeof unitsState) => unknown) => selector(unitsState),
}));

vi.mock('@/lib/store/eventsStore', () => ({
  useEventsStore: (selector: (state: typeof eventsState) => unknown) => selector(eventsState),
}));

vi.mock('@/lib/store/todosStore', () => ({
  useTodosStore: (selector: (state: typeof todosState) => unknown) => selector(todosState),
}));

vi.mock('@/lib/hooks', () => ({
  useHydration: () => true,
}));

const calendarSearchParams = new URLSearchParams('date=2026-01-15');

vi.mock('next/navigation', () => ({
  useSearchParams: () => calendarSearchParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Import component AFTER mocks are defined
import CalendarPage from '@/app/calendar/page';

describe('CalendarPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    deadlinesState.toggleComplete.mockClear();
    deadlinesState.getStressLevel.mockClear();
  });

  it('renders the calendar page with header', async () => {
    render(<CalendarPage />);

    // Check that the main calendar heading matches the date (January 2026)
    // view defaults to 'week' so it shows "Month Year"
    const expectedDate = format(new Date(2026, 0, 15), 'MMMM yyyy');
    const headings = screen.getAllByRole('heading', { name: expectedDate });
    expect(headings.length).toBeGreaterThan(0);
  });

  it('displays deadline information in the sidebar', async () => {
    render(<CalendarPage />);

    // Deadlines appear in multiple places - verify at least one exists
    const assignmentTitles = screen.getAllByText('Assignment 1');
    expect(assignmentTitles.length).toBeGreaterThan(0);
  });

  it('displays the Assignments section with pending count', async () => {
    render(<CalendarPage />);

    // Check for the Assignments section heading
    const assignmentsHeading = screen.getByRole('heading', {
      name: new RegExp(`${translations.assignments}.*${translations.pending}`, 'i'),
    });
    expect(assignmentsHeading).toBeInTheDocument();
  });

  it('renders navigation controls', async () => {
    render(<CalendarPage />);

    const todayButtons = screen.getAllByRole('button', {
      name: translations.today,
    });
    expect(todayButtons.length).toBeGreaterThan(0);

    // Check that the button is focusable
    todayButtons[0].focus();
    expect(document.activeElement).toBe(todayButtons[0]);
  });

  it('does not introduce a nested main landmark inside the shared app shell', () => {
    render(
      <main role="main">
        <CalendarPage />
      </main>,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});
