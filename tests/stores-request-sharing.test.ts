/**
 * Home and Calendar mount several components that request the same data in one
 * render pass. Concurrent loads must share a single GET, while forceRefresh()
 * (used after mutations) must always fetch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnitsStore } from '@/lib/store/unitsStore';
import { useDeadlinesStore } from '@/lib/store/deadlinesStore';
import { useEventsStore } from '@/lib/store/eventsStore';
import { useTodosStore } from '@/lib/store/todosStore';
import { apiRequest } from '@/lib/utils/api';

vi.mock('@/lib/utils/api', () => ({ apiRequest: vi.fn() }));

const apiRequestMock = apiRequest as unknown as ReturnType<typeof vi.fn>;

// Resolve on demand so requests stay "in flight" while we fire more calls.
function deferredResponse(value: unknown = []) {
  let resolve!: () => void;
  const promise = new Promise<unknown>((r) => {
    resolve = () => r(value);
  });
  return { promise, resolve };
}

const stores = [
  { name: 'units', store: useUnitsStore, load: () => useUnitsStore.getState().loadUnits() },
  {
    name: 'deadlines',
    store: useDeadlinesStore,
    load: () => useDeadlinesStore.getState().loadDeadlines(),
  },
  { name: 'events', store: useEventsStore, load: () => useEventsStore.getState().loadEvents() },
  { name: 'todos', store: useTodosStore, load: () => useTodosStore.getState().loadTodos() },
] as const;

describe.each(stores)('$name store request sharing', ({ store, load }) => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    // Each store has these two fields; the cast only bridges the union of store types.
    (store.setState as (partial: { hasLoaded: boolean; isLoading: boolean }) => void)({
      hasLoaded: false,
      isLoading: false,
    });
  });

  it('shares one GET between concurrent loads and a page revalidate', async () => {
    const res = deferredResponse();
    apiRequestMock.mockReturnValue(res.promise);

    const calls = [load(), load(), store.getState().revalidate()];
    res.resolve();
    await Promise.all(calls);

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it('starts a new request once the previous one has finished', async () => {
    apiRequestMock.mockResolvedValue([]);

    await store.getState().revalidate();
    await store.getState().revalidate();

    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('forceRefresh always fetches, even while a load is in flight', async () => {
    const res = deferredResponse();
    apiRequestMock.mockReturnValueOnce(res.promise).mockResolvedValue([]);

    const pending = load();
    await store.getState().forceRefresh();
    res.resolve();
    await pending;

    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });
});
