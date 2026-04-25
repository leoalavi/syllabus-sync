'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ChevronUp } from 'lucide-react';
import type { Building } from '@/features/map/lib/buildings';
import { getBuildingGps } from '@/features/map/lib/buildings';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
import { toastUtils } from '@/lib/utils/toast';
import { getLocaleString } from '@/lib/utils/locale';
import type {
  GoogleComputedRoute,
  GoogleTravelMode,
  MapLatLng,
  ExternalDestination,
} from '@/lib/maps/google/types';
import GoogleRoutePanel from './GoogleRoutePanel';

const GoogleMapCanvas = dynamic(() => import('./GoogleMapCanvas'), { ssr: false });

interface RouteApiResponse {
  success: boolean;
  data?: GoogleComputedRoute;
  error?: { code?: string; message: string };
}

/** Haversine distance in metres */
function haversineMetres(a: MapLatLng, b: MapLatLng): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Minimum distance from polyline to consider off-route (metres) */
const OFF_ROUTE_THRESHOLD = 50;
/** Minimum user movement before route recalculation during navigation (metres) */
const NAV_RECALC_THRESHOLD = 80;
/** Arrival detection threshold (metres) */
const ARRIVAL_THRESHOLD = 30;
/** GPS jitter threshold — skip updates smaller than this (~5.5 m) */
const GPS_MIN_DELTA = 0.00005;
/** localStorage key for travel mode persistence */
const TRAVEL_MODE_KEY = 'google-map-travel-mode';

interface Props {
  selectedBuilding?: Building;
  externalDestination: ExternalDestination | null;
  onDismissRoute?: () => void;
  /** Notifies parent when Google Street View is entered or exited */
  onStreetViewChange?: (active: boolean) => void;
}

export default function GoogleMapController({
  selectedBuilding,
  externalDestination,
  onDismissRoute,
  onStreetViewChange,
}: Props) {
  const { t, language } = useTypedTranslation();
  const [isStreetViewActive, setIsStreetViewActive] = useState(false);
  const [userLocation, setUserLocation] = useState<MapLatLng | null>(null);
  const [route, setRoute] = useState<GoogleComputedRoute | null>(null);
  const [travelMode, setTravelMode] = useState<GoogleTravelMode>(() => {
    if (typeof window === 'undefined') return 'WALK';
    const stored = localStorage.getItem(TRAVEL_MODE_KEY);
    if (stored === 'DRIVE' || stored === 'BICYCLE' || stored === 'TRANSIT') return stored;
    return 'WALK';
  });
  const [isNavigating, setIsNavigating] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [hasArrived, setHasArrived] = useState(false);

  const watchRef = useRef<number | null>(null);
  const lastKeyRef = useRef('');
  const lastGpsRef = useRef<MapLatLng | null>(null);
  const lastNavFetchPosRef = useRef<MapLatLng | null>(null);
  const routeRef = useRef<GoogleComputedRoute | null>(null);

  // Keep routeRef in sync
  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  // Persist travel mode
  const handleTravelModeChange = useCallback((m: GoogleTravelMode) => {
    setTravelMode(m);
    lastKeyRef.current = '';
    try {
      localStorage.setItem(TRAVEL_MODE_KEY, m);
    } catch {
      // ignore
    }
  }, []);

  // GPS watch — accuracy-aware with adaptive thresholds
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const next: MapLatLng = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        };
        const prev = lastGpsRef.current;
        if (
          prev &&
          Math.abs(next.lat - prev.lat) < GPS_MIN_DELTA &&
          Math.abs(next.lng - prev.lng) < GPS_MIN_DELTA
        ) {
          return; // skip trivial jitter
        }
        lastGpsRef.current = next;
        setUserLocation(next);
      },
      null,
      { enableHighAccuracy: true, maximumAge: 1500 },
    );
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  // Destination resolution
  const destination = useMemo<MapLatLng | null>(() => {
    if (externalDestination) {
      return { lat: externalDestination.lat, lng: externalDestination.lng };
    }
    if (selectedBuilding) {
      const gps = selectedBuilding.entranceLocation ?? selectedBuilding.location;
      return gps ? { lat: gps.lat, lng: gps.lng } : getBuildingGps(selectedBuilding);
    }
    return null;
  }, [externalDestination, selectedBuilding]);

  const destName = externalDestination?.label ?? selectedBuilding?.name ?? '';

  const getRouteErrorMessage = useCallback(
    (code?: string): string => {
      if (code === 'NOT_FOUND') {
        return t('noRouteAvailable');
      }

      return t('routeUnavailable');
    },
    [t],
  );

  // Route fetch
  const fetchRoute = useCallback(
    async (origin: MapLatLng, dest: MapLatLng, mode: GoogleTravelMode) => {
      const key = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}>${dest.lat.toFixed(5)},${dest.lng.toFixed(5)}|${mode}|${language}`;
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;

      setIsLoadingRoute(true);
      setRouteError(null);
      try {
        const res = await fetch('/api/maps/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin,
            destination: dest,
            travelMode: mode,
            languageCode: getLocaleString(language),
          }),
        });
        const json = (await res.json()) as RouteApiResponse;
        if (!res.ok || !json.success || !json.data) {
          setRouteError(getRouteErrorMessage(json.error?.code));
          setRoute(null);
          lastKeyRef.current = '';
          return;
        }
        setRoute(json.data);
        lastNavFetchPosRef.current = origin;
      } catch (e) {
        void e;
        setRouteError(t('routeUnavailable'));
        setRoute(null);
        lastKeyRef.current = '';
      } finally {
        setIsLoadingRoute(false);
      }
    },
    [getRouteErrorMessage, language, t],
  );

  // Initial route fetch when destination or user location changes
  useEffect(() => {
    if (!destination || !userLocation) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRoute(userLocation, destination, travelMode);
  }, [destination, userLocation, travelMode, fetchRoute]);

  // During navigation: recalculate if user moves significantly or is off-route
  useEffect(() => {
    if (!isNavigating || !userLocation || !destination) return;

    const lastFetchPos = lastNavFetchPosRef.current;
    if (!lastFetchPos) return;

    const distMoved = haversineMetres(userLocation, lastFetchPos);

    // Check off-route: approximate by comparing distance to destination vs route distance
    // A more precise check would sample the polyline, but this is a lightweight heuristic
    const currentRoute = routeRef.current;
    let isOffRoute = false;
    if (currentRoute && distMoved > OFF_ROUTE_THRESHOLD) {
      const directDist = haversineMetres(userLocation, destination);
      // If user is farther from destination than the remaining route suggests, likely off-route
      if (directDist > currentRoute.distanceMeters * 1.5 && distMoved > OFF_ROUTE_THRESHOLD) {
        isOffRoute = true;
      }
    }

    if (distMoved > NAV_RECALC_THRESHOLD || isOffRoute) {
      lastKeyRef.current = '';
      void fetchRoute(userLocation, destination, travelMode);
    }
  }, [isNavigating, userLocation, destination, travelMode, fetchRoute]);

  // Arrival detection
  useEffect(() => {
    if (!isNavigating || !userLocation || !destination || hasArrived) return;
    const dist = haversineMetres(userLocation, destination);
    if (dist <= ARRIVAL_THRESHOLD) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasArrived(true);
      setIsNavigating(false);
      setIsPanelOpen(true);
    }
  }, [isNavigating, userLocation, destination, hasArrived]);

  // Reset on destination change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoute(null);
    setIsNavigating(false);
    setHasArrived(false);
    setIsPanelOpen(true);
    lastKeyRef.current = '';
    lastNavFetchPosRef.current = null;
  }, [selectedBuilding?.id, externalDestination?.placeId]);

  return (
    <div className="relative h-full w-full">
      <GoogleMapCanvas
        selectedBuilding={selectedBuilding}
        externalDestination={externalDestination}
        userLocation={userLocation}
        route={route}
        isNavigating={isNavigating}
        panelVisible={!!destination && isPanelOpen}
        travelMode={travelMode}
        onStreetViewChange={(active) => {
          setIsStreetViewActive(active);
          onStreetViewChange?.(active);
        }}
      />

      {destination && isPanelOpen && !isStreetViewActive && (
        <GoogleRoutePanel
          destinationName={destName}
          route={route}
          travelMode={travelMode}
          isNavigating={isNavigating}
          isLoadingRoute={isLoadingRoute}
          routeError={routeError}
          userLocation={userLocation}
          destination={destination}
          hasArrived={hasArrived}
          originLabel={userLocation ? t('yourLocation') : undefined}
          onTravelModeChange={handleTravelModeChange}
          onStartNavigation={() => {
            setHasArrived(false);
            setIsNavigating(true);
          }}
          onStopNavigation={() => {
            setIsNavigating(false);
            setIsPanelOpen(true);
            toastUtils.info(t('navigationReset'));
          }}
          onDismissArrival={() => setHasArrived(false)}
          onDismissRoute={() => {
            setRoute(null);
            setIsNavigating(false);
            setHasArrived(false);
            lastKeyRef.current = '';
            onDismissRoute?.();
          }}
        />
      )}

      {/* Compact navigation bar — shown when navigating with panel collapsed */}
      {isNavigating && !isPanelOpen && !isStreetViewActive && (
        <div className="absolute bottom-4 left-1/2 z-[1000] flex w-auto max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-mq-border bg-mq-card-background/95 px-4 py-3 shadow-xl backdrop-blur">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-mq-content">
            {destName}
          </p>
          <button
            onClick={() => setIsPanelOpen(true)}
            className="shrink-0 rounded-full p-1 text-mq-content-secondary transition-colors hover:bg-mq-hover-background hover:text-mq-content"
            aria-label={t('expandNavigationPanel')}
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={() => {
              setIsNavigating(false);
              setIsPanelOpen(true);
              toastUtils.info(t('navigationReset'));
            }}
            className="shrink-0 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white dark:bg-red-500"
          >
            {t('stop')}
          </button>
        </div>
      )}
    </div>
  );
}
