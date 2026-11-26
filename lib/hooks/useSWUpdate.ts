// lib/hooks/useSWUpdate.ts
// ============================================================================
// SERVICE WORKER UPDATE HOOK
// ============================================================================
// Detects when a new service worker version is available and provides
// a function to activate it (skip waiting + reload).

'use client';

import { useState, useEffect, useCallback } from 'react';

// Set by applyUpdate(): the student asked for the new version, so the
// controllerchange that follows should reload the page.
let reloadRequested = false;

export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Listen for new service worker installations
    // Reload only when the student asked for the update. public/sw.js calls
    // skipWaiting() + clients.claim(), so controllerchange also fires on a
    // first visit (the worker takes control of an uncontrolled page) and after
    // every deploy. Reloading then wiped whatever was being typed, e.g. the
    // login form, a few seconds after the page opened. Version changes during
    // normal use are handled by Next.js deployment-ID checks on navigation.
    const handleControllerChange = () => {
      if (!reloadRequested) return;
      reloadRequested = false;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check existing registration for waiting workers
    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);

      // If there's already a waiting worker
      if (reg.waiting) {
        setUpdateAvailable(true);
      }

      // Listen for future updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version is installed and waiting to activate
            setUpdateAvailable(true);
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!registration?.waiting) return;

    // Tell the waiting SW to skip waiting and activate
    reloadRequested = true;
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    // controllerchange event handler will reload the page
  }, [registration]);

  return {
    /** Whether a new SW version is waiting to activate */
    updateAvailable,
    /** Activate the waiting SW and reload */
    applyUpdate,
  };
}
