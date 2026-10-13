'use client';

import type { User } from '@supabase/supabase-js';
import { createBrowserClient, isSupabaseConfigured } from './client';

export type BrowserAuthSnapshot = {
  session: null;
  user: User | null;
  resolution: 'resolved' | 'unknown';
};

type ConfirmedSnapshotOptions = {
  retries?: number;
  retryDelayMs?: number;
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

/**
 * Returns the current Supabase browser user validated against the server.
 * Uses `getUser()` instead of `getSession()` to avoid stale/expired local tokens.
 */
export async function getBrowserAuthSnapshot(): Promise<BrowserAuthSnapshot> {
  if (!isSupabaseConfigured()) {
    return { session: null, user: null, resolution: 'resolved' };
  }

  const supabase = createBrowserClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    // With no stored access token, auth-js returns AuthSessionMissingError
    // locally without a network call. That is a definitive signed-out state,
    // not an ambiguous one; treating it as 'unknown' meant signed-out visitors
    // were never detected client-side. Same check as auth-js's
    // isAuthSessionMissingError(), kept local to avoid a deep import.
    if (error.name === 'AuthSessionMissingError') {
      return { session: null, user: null, resolution: 'resolved' };
    }
    return { session: null, user: null, resolution: 'unknown' };
  }

  return { session: null, user: data.user ?? null, resolution: 'resolved' };
}

/**
 * Cheap local check for whether any Supabase session is stored in the browser.
 * Reads cookies only (no network). This is NOT an authorization check, since
 * the server still validates every request; it exists so signed-out pages can
 * skip API calls that could only return 401.
 */
export async function hasStoredBrowserSession(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { data } = await createBrowserClient().auth.getSession();
  return Boolean(data.session);
}

/**
 * Confirms an apparently signed-out browser snapshot before callers tear down
 * authenticated UI. This filters transient `getUser()` null reads during token
 * refresh or focus recovery without masking a real sign-out.
 */
export async function getConfirmedBrowserAuthSnapshot(
  options?: ConfirmedSnapshotOptions,
): Promise<BrowserAuthSnapshot> {
  const retries = options?.retries ?? 1;
  const retryDelayMs = options?.retryDelayMs ?? 150;

  let snapshot = await getBrowserAuthSnapshot();
  if (snapshot.resolution !== 'resolved' || snapshot.user || retries <= 0) {
    return snapshot;
  }

  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (retryDelayMs > 0) {
      await wait(retryDelayMs);
    }

    snapshot = await getBrowserAuthSnapshot();
    if (snapshot.resolution !== 'resolved' || snapshot.user) {
      return snapshot;
    }
  }

  return snapshot;
}
