import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = () => void;

function installFakeServiceWorker(waiting: { postMessage: ReturnType<typeof vi.fn> } | null) {
  const listeners = new Set<Listener>();
  const registration = { waiting, installing: null, addEventListener: vi.fn() };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: null,
      ready: Promise.resolve(registration),
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    },
  });
  return { fireControllerChange: () => listeners.forEach((l) => l()) };
}

describe('useSWUpdate', () => {
  const reload = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    vi.resetModules();
    reload.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('does not reload when a service worker takes control on its own (first visit or deploy)', async () => {
    const sw = installFakeServiceWorker(null);
    const { useSWUpdate } = await import('@/lib/hooks/useSWUpdate');
    renderHook(() => useSWUpdate());
    act(() => sw.fireControllerChange());
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once after the student applies a waiting update', async () => {
    const waiting = { postMessage: vi.fn() };
    const sw = installFakeServiceWorker(waiting);
    const { useSWUpdate } = await import('@/lib/hooks/useSWUpdate');
    const { result } = renderHook(() => useSWUpdate());
    await act(async () => {});
    act(() => result.current.applyUpdate());
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    act(() => sw.fireControllerChange());
    act(() => sw.fireControllerChange());
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
