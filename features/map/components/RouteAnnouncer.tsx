'use client';

import { useEffect, useState, useRef } from 'react';
import { useSafeTranslation } from '@/lib/hooks/useSafeTranslation';

interface NavState {
  isNavigating: boolean;
  distance?: number;
  remainingDistance?: number;
  eta?: Date;
  instructions?: Array<{ text: string }>;
  currentInstructionIndex?: number;
  status?: 'idle' | 'navigating' | 'arrived' | 'off-route' | 'recalculating' | 'error';
}

interface RouteAnnouncerProps {
  navState: NavState | null;
  locationStatus: 'idle' | 'searching' | 'found' | 'denied' | 'error';
  selectedBuildingName?: string;
}

/**
 * RouteAnnouncer - Accessibility component for screen reader announcements
 *
 * Announces navigation updates to screen readers via ARIA live regions.
 * Throttles updates to avoid overwhelming users with too many announcements.
 *
 * @example
 * <RouteAnnouncer
 *   navState={navState}
 *   locationStatus={locationStatus}
 *   selectedBuildingName="Central Courtyard"
 * />
 */
export function RouteAnnouncer({
  navState,
  locationStatus,
  selectedBuildingName,
}: RouteAnnouncerProps) {
  const { t } = useSafeTranslation();
  const [announcement, setAnnouncement] = useState('');
  const lastAnnouncementTime = useRef<number>(0);
  const lastDistance = useRef<number | undefined>(undefined);

  // Throttle interval: minimum 8 seconds between announcements
  const THROTTLE_INTERVAL = 8000;
  // Significant distance change threshold: 50 meters
  const DISTANCE_THRESHOLD = 50;

  /* This effect intentionally uses setState to throttle announcements to screen readers.
     The throttling prevents overwhelming users with too many updates. */
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastAnnouncement = now - lastAnnouncementTime.current;

    let newAnnouncement = '';
    let shouldAnnounce = false;

    // Priority 1: Arrived at destination
    if (navState?.status === 'arrived') {
      newAnnouncement = t('navigationArrived');
      shouldAnnounce = true;
    }
    // Priority 2: Navigation updates (throttled)
    else if (navState?.isNavigating && navState.remainingDistance !== undefined) {
      const currentDistance = Math.round(navState.remainingDistance);
      const distanceChanged =
        lastDistance.current === undefined ||
        Math.abs(lastDistance.current - currentDistance) >= DISTANCE_THRESHOLD;

      // Announce if: first update OR significant distance change OR enough time passed
      if (distanceChanged || timeSinceLastAnnouncement >= THROTTLE_INTERVAL) {
        const distanceText =
          currentDistance < 1000
            ? `${currentDistance} ${t('meters')}`
            : `${(currentDistance / 1000).toFixed(1)} ${t('kilometers')}`;

        newAnnouncement = t('navigationUpdate', { distance: distanceText });

        lastDistance.current = currentDistance;
        shouldAnnounce = true;
      }
    }
    // Priority 3: Navigation started
    else if (
      navState?.isNavigating &&
      selectedBuildingName &&
      timeSinceLastAnnouncement >= THROTTLE_INTERVAL
    ) {
      newAnnouncement = `${t('navigatingTo')} ${selectedBuildingName}`;
      shouldAnnounce = true;
    }

    if (shouldAnnounce && newAnnouncement) {
      setAnnouncement(newAnnouncement);
      lastAnnouncementTime.current = now;
    }
  }, [navState, locationStatus, selectedBuildingName, t]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}
