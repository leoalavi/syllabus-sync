import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/utils/chunkErrorRecovery';

describe('chunkErrorRecovery', () => {
  const reload = vi.fn();

  beforeEach(() => {
    window.sessionStorage.clear();
    reload.mockReset();
    vi.stubGlobal('location', { ...window.location, reload });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recognises stale-chunk errors from webpack and native dynamic import', () => {
    expect(isChunkLoadError(Object.assign(new Error('x'), { name: 'ChunkLoadError' }))).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 123 failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading CSS chunk app-map failed'))).toBe(true);
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /a.js')),
    ).toBe(true);
  });

  it('ignores ordinary errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError('Loading chunk 1 failed')).toBe(false);
  });

  it('reloads once for a stale-chunk error', () => {
    expect(reloadOnceForChunkError(new Error('Loading chunk 9 failed'))).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again within the cooldown, so a broken chunk cannot loop', () => {
    reloadOnceForChunkError(new Error('Loading chunk 9 failed'));
    expect(reloadOnceForChunkError(new Error('Loading chunk 9 failed'))).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads for ordinary errors', () => {
    expect(reloadOnceForChunkError(new Error('boom'))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
