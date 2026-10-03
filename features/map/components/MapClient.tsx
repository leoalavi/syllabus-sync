'use client';

import { Suspense, useEffect, useCallback, useRef, useState, startTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import ReactDOM from 'react-dom';
import { LazyMotion, domAnimation, m, AnimatePresence, useReducedMotion } from 'framer-motion';
import '@/app/styles/leaflet.css';
import {
  X,
  CheckCircle2,
  Accessibility,
  Layers,
  Car,
  Droplets,
  BadgeCheck,
  Download,
  Link as LinkIcon,
  Info,
  Github,
  ExternalLink,
  MapPin,
} from 'lucide-react';
import { TranslatedMapErrorBoundary } from './MapErrorBoundary';
import { MapLoadingSkeleton } from './MapSkeleton';
import CampusMapHUD from './CampusMapHUD';
import { RouteAnnouncer } from './RouteAnnouncer';
import { Badge } from '@/components/ui/mq/badge';
import { Button } from '@/components/ui/mq/button';
import { UNIVERSITY_CONFIG } from '@/lib/config';
import { buildings, getBuildingById } from '@/features/map/lib/buildings';
import { mapOverlays, type MapOverlayId } from '@/features/map/lib/mapOverlays';
import { useMapStore, parseOverlaysFromURL, overlaysToURLParam } from '@/lib/store/mapStore';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
import { MagicCard } from '@/components/ui/MagicCard';
import { toastUtils } from '@/lib/utils/toast';
import { CAMPUS_IMAGE_URL } from '@/features/map/lib/constants';
import { MapViewToggle, type MapView } from './MapViewToggle';
import GoogleMapController from './GoogleMapController';
import type { ExternalDestination } from '@/lib/maps/google/types';
import { useCampusBuildingSearch } from '@/features/map/hooks/useCampusBuildingSearch';
import {
  useGooglePlacesSearch,
  type GooglePlaceSuggestion,
} from '@/features/map/hooks/useGooglePlacesSearch';
import { getLocaleString } from '@/lib/utils/locale';

import { triggerHaptic } from '@/lib/utils/haptics';

// Map overlay icons
const OVERLAY_ICONS: Record<MapOverlayId, React.ComponentType<{ className?: string }>> = {
  parking: Car,
  drinking_water: Droplets,
  accessibility: Accessibility,
  special_permits: BadgeCheck,
};

// Dynamic import for the heavy map lib with Suspense
const CampusMap = dynamic(() => import('./CampusMap'), {
  ssr: false,
  loading: () => <MapLoadingSkeleton />,
});

// Import LocationStatus type
import type { LocationStatus, CampusMapRef } from './CampusMap';

import DevPinPanel from './DevPinPanel';

export default function MapClient() {
  const { t, language } = useTypedTranslation();
  const prefersReducedMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const campusMapRef = useRef<CampusMapRef>(null);
  const overlayToggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOverlayOpenRef = useRef(false);
  const mapView: MapView = searchParams.get('view') === 'google' ? 'google' : 'campus';

  // Preload critical map image for better LCP (Largest Contentful Paint).
  // Keep this in an effect to avoid side effects during render.
  const hasPreloadedCampusImageRef = useRef(false);
  useEffect(() => {
    if (mapView !== 'campus' || hasPreloadedCampusImageRef.current) return;
    hasPreloadedCampusImageRef.current = true;
    try {
      ReactDOM.preload(CAMPUS_IMAGE_URL, { as: 'image' });
    } catch {
      // Ignore: preload is a progressive enhancement.
    }
  }, [mapView]);

  // Location status from CampusMap
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');

  // Street View state (Google Maps mode only)
  const [isStreetViewActive, setIsStreetViewActive] = useState(false);

  // Navigation state for RouteAnnouncer
  const [navState, setNavState] = useState<{
    isNavigating: boolean;
    remainingDistance?: number;
    etaSeconds?: number;
    status?: 'idle' | 'navigating' | 'arrived' | 'off-route' | 'recalculating' | 'error';
  } | null>(null);

  // Smooth loading transition state
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapLoadTimedOut, setMapLoadTimedOut] = useState(false);
  const mapReadyTimeoutRef = useRef<number | null>(null);

  // Buildings sidebar state
  const [buildingSearch, setBuildingSearch] = useState('');
  const [externalDestination, setExternalDestination] = useState<ExternalDestination | null>(null);

  // Dev Pin Editor state (dev-only — tree-shaken in production)
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [devBuildingId, setDevBuildingId] = useState<string | null>(null);
  const [devPendingPos, setDevPendingPos] = useState<[number, number] | null>(null);
  const [devIsSaving, setDevIsSaving] = useState(false);
  const [devSaved, setDevSaved] = useState(false);
  const hasAutoNavigatedRef = useRef(false);

  const handleCampusMapReady = useCallback(() => {
    setMapLoadTimedOut(false);
    setIsMapReady(true);
  }, []);

  // Use map store for overlay persistence
  const {
    activeOverlays,
    showOverlayPanel,
    toggleOverlay,
    setOverlays,
    clearOverlays,
    setShowOverlayPanel,
  } = useMapStore();

  const overlaysContainerRef = useRef<HTMLDivElement>(null);

  // Focus management for overlay panel
  useEffect(() => {
    if (showOverlayPanel && overlaysContainerRef.current) {
      // Small timeout to allow animation/rendering to start
      const timer = setTimeout(() => {
        const firstButton = overlaysContainerRef.current?.querySelector('button');
        if (firstButton) {
          (firstButton as HTMLElement).focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showOverlayPanel]);

  useEffect(() => {
    if (wasOverlayOpenRef.current && !showOverlayPanel) {
      overlayToggleButtonRef.current?.focus();
    }
    wasOverlayOpenRef.current = showOverlayPanel;
  }, [showOverlayPanel]);

  const handleOverlayPanelKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowOverlayPanel(false);
        overlayToggleButtonRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = overlaysContainerRef.current?.querySelectorAll('button');
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [setShowOverlayPanel],
  );

  const selectedBuildingId = searchParams.get('building');
  const selectedBuilding = selectedBuildingId ? getBuildingById(selectedBuildingId) : undefined;
  const autoNavigate = searchParams.get('autonav') === 'true';
  // Focused mode: hide places panel, show only destination (used when navigating from calendar)
  const isFocusedMode = searchParams.get('focused') === 'true';

  // Ref-based lock to prevent URL↔store feedback loops.
  // 'url' = URL just wrote to store (suppress store→URL echo)
  // 'store' = store just wrote to URL (suppress URL→store echo)
  const syncLockRef = useRef<'url' | 'store' | null>(null);

  // URL → store: only fires when searchParams change (back/forward or initial load)
  useEffect(() => {
    if (syncLockRef.current === 'store') return;
    const layersParam = searchParams.get('layers') || '';
    if (!layersParam) return;

    const urlOverlays = parseOverlaysFromURL(searchParams);
    syncLockRef.current = 'url';
    setOverlays(urlOverlays);
    queueMicrotask(() => {
      syncLockRef.current = null;
    });
  }, [searchParams, setOverlays]);

  // Store → URL: fires when activeOverlays change (user toggle)
  useEffect(() => {
    if (syncLockRef.current === 'url') return;

    const nextParam = overlaysToURLParam(activeOverlays);
    const currentParam = searchParams.get('layers') || '';

    if (nextParam === currentParam) return;

    const params = new URLSearchParams(searchParams.toString());
    if (nextParam) {
      params.set('layers', nextParam);
    } else {
      params.delete('layers');
    }

    syncLockRef.current = 'store';
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', newUrl);
    queueMicrotask(() => {
      syncLockRef.current = null;
    });
  }, [activeOverlays, searchParams]);

  // Auto-scroll and notify when arriving with a building + autonav flag
  useEffect(() => {
    if (!autoNavigate || !selectedBuilding || hasAutoNavigatedRef.current) return;
    hasAutoNavigatedRef.current = true;
    if (mapContainerRef.current) {
      mapContainerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
    toastUtils.success(t('routeReady'), t('selectBuildingToNavigate'));
  }, [autoNavigate, selectedBuilding, t]);

  // PERF: Prefetch overlay images when user opens the overlay panel
  // This improves perceived performance when toggling layers
  useEffect(() => {
    if (!showOverlayPanel) return;

    // Prefetch all overlay images in the background
    mapOverlays.forEach((overlay) => {
      const img = new Image();
      img.src = overlay.url;
    });
  }, [showOverlayPanel]);

  // Copy shareable URL
  const copyShareableURL = useCallback(async () => {
    const url = new URL(window.location.href);
    if (activeOverlays.length > 0) {
      url.searchParams.set('layers', overlaysToURLParam(activeOverlays));
    }
    if (selectedBuildingId) {
      url.searchParams.set('building', selectedBuildingId);
    }

    try {
      await navigator.clipboard.writeText(url.toString());
      const urlStr = url.toString();
      const preview = urlStr.length > 50 ? `${urlStr.substring(0, 50)}...` : urlStr;
      toastUtils.success(t('copied'), preview);
    } catch {
      toastUtils.error(t('error'), t('tryAgain'));
    }
  }, [activeOverlays, selectedBuildingId, t]);

  const handleMapViewChange = useCallback(
    (nextView: MapView) => {
      setExternalDestination(null);
      const params = new URLSearchParams(searchParams.toString());
      if (nextView === 'google') {
        params.set('view', 'google');
      } else {
        params.delete('view');
      }
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', newUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    [searchParams],
  );

  const handleExport = useCallback(() => {
    try {
      const link = document.createElement('a');
      link.href = CAMPUS_IMAGE_URL;
      link.download = 'campus-map.png';
      link.rel = 'noopener';
      link.click();
      toastUtils.success(t('export'), t('downloadStarted'));
    } catch {
      toastUtils.error(t('error'), t('tryAgain'));
    }
  }, [t]);

  // Dev Pin Editor callbacks (dev-only)
  const handleDevPinMove = useCallback((buildingId: string, position: [number, number]) => {
    setDevPendingPos(position);
    setDevSaved(false);
    void buildingId; // used via devBuildingId state
  }, []);

  const handleDevSave = useCallback(async () => {
    if (!devBuildingId || !devPendingPos) return;
    setDevIsSaving(true);
    try {
      const res = await fetch('/api/maps/dev-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId: devBuildingId, position: devPendingPos }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toastUtils.error(json.error ?? 'Save failed');
        return;
      }
      setDevSaved(true);
      toastUtils.success(
        'buildings.ts updated',
        `${devBuildingId} → [${devPendingPos.join(', ')}]`,
      );
      setTimeout(() => setDevSaved(false), 4000);
    } catch {
      toastUtils.error('Save failed', 'Check the dev server console.');
    } finally {
      setDevIsSaving(false);
    }
  }, [devBuildingId, devPendingPos]);

  // Buildings sidebar - filtered and searched with campus-first ranking
  const getTranslatedName = useCallback(
    (building: { translationKey: Parameters<typeof t>[0] }) => t(building.translationKey),
    [t],
  );
  const { results: sidebarBuildings, hasStrongMatch } = useCampusBuildingSearch(
    buildings,
    buildingSearch,
    getTranslatedName,
  );

  // Secondary Google Places search (only when Google mode + no strong campus match)
  const { suggestions: placeSuggestions, isLoading: isLoadingPlaces } = useGooglePlacesSearch(
    buildingSearch,
    getLocaleString(language),
    {
      enabled: mapView === 'google' && !hasStrongMatch && buildingSearch.trim().length >= 3,
    },
  );

  // Handle external place selection via Place Details API
  const handleSelectPlace = useCallback(
    async (place: GooglePlaceSuggestion) => {
      try {
        const response = await fetch('/api/maps/place-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            placeId: place.placeId,
            languageCode: getLocaleString(language),
          }),
        });
        const json = (await response.json()) as {
          success: boolean;
          data?: {
            placeId: string;
            displayName: string;
            lat: number;
            lng: number;
          };
          error?: { message: string };
        };
        if (!json.success || !json.data) {
          toastUtils.error(t('error'), t('tryAgain'));
          return;
        }

        // Clear any selected building and set external destination
        const params = new URLSearchParams(searchParams.toString());
        params.delete('building');
        params.set('view', 'google');
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
        window.dispatchEvent(new PopStateEvent('popstate'));

        setExternalDestination({
          placeId: json.data.placeId,
          label: json.data.displayName,
          lat: json.data.lat,
          lng: json.data.lng,
        });
      } catch {
        toastUtils.error(t('error'), t('tryAgain'));
      }
    },
    [language, searchParams, t],
  );

  // Memoized CampusMapHUD callbacks — prevents child re-renders on every MapClient render
  const handleStartNavigation = useCallback(() => campusMapRef.current?.startNavigation(), []);
  const handleStopNavigation = useCallback(() => campusMapRef.current?.stopNavigation(), []);
  const handleClearExternalPlace = useCallback(() => setExternalDestination(null), []);

  useEffect(() => {
    if (mapView !== 'campus') {
      if (mapReadyTimeoutRef.current) {
        window.clearTimeout(mapReadyTimeoutRef.current);
        mapReadyTimeoutRef.current = null;
      }
      return;
    }

    if (!isMapReady) {
      if (mapReadyTimeoutRef.current) {
        window.clearTimeout(mapReadyTimeoutRef.current);
      }
      mapReadyTimeoutRef.current = window.setTimeout(() => {
        if (!isMapReady) {
          setMapLoadTimedOut(true);
          setIsMapReady(true);
        }
      }, 5000);
    }

    return () => {
      if (mapReadyTimeoutRef.current) {
        window.clearTimeout(mapReadyTimeoutRef.current);
        mapReadyTimeoutRef.current = null;
      }
    };
  }, [isMapReady, mapView]);

  useEffect(() => {
    if (mapView !== 'campus') {
      campusMapRef.current?.stopNavigation();
      startTransition(() => {
        setNavState(null);
      });
      return;
    }

    startTransition(() => {
      setIsMapReady(false);
      setMapLoadTimedOut(false);
      setNavState(null);
    });
  }, [mapView]);

  // NOTE: No IntersectionObserver - map loads immediately for better LCP
  // The map component is loaded with Suspense for progressive enhancement

  return (
    <LazyMotion features={domAnimation}>
      <section
        className="container mx-auto max-w-7xl map-page relative px-3 py-4 sm:p-4"
        aria-label={t('campusMapLabel')}
      >
        {/* Skip Link - Keyboard Accessibility (only visible when focused) */}
        <a
          href="#map-container"
          className="absolute -top-[9999px] -left-[9999px] focus:top-2 focus:left-2 focus:z-[2000] px-4 py-2 bg-mq-primary text-white font-bold rounded-mq-lg shadow-lg transition-all focus:outline-none"
        >
          {t('skipToMainContent')}
        </a>

        {/* Route Announcer for Screen Readers */}
        <RouteAnnouncer
          navState={navState}
          locationStatus={locationStatus}
          selectedBuildingName={selectedBuilding?.name}
        />

        {/* Header */}
        <header className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-mq-2xl font-bold text-mq-content sm:text-mq-3xl">{t('campus')}</h1>
          </div>
          <p className="text-mq-content-secondary">
            {t('campusSupportSubtitle', { uniName: UNIVERSITY_CONFIG.name })}
          </p>

          {/* Positioning note: advanced wayfinding lives in the separate MQ Navigation app */}
          <div
            className="mt-3 flex items-start gap-2.5 rounded-mq-lg border border-mq-border bg-mq-background-secondary px-3 py-2.5 text-mq-xs text-mq-content-secondary"
            role="note"
          >
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-mq-info" aria-hidden="true" />
            <p>{t('campusSupportNotice')}</p>
          </div>
        </header>

        {mapView === 'campus' && (
          <>
            {/* Map Overlay Layers */}
            <div className="mb-4">
              <MagicCard isLiquidEnhanced>
                <div className="mq-magic-card-content p-4 bg-mq-card-background border border-mq-border">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <Layers className="h-5 w-5" />
                      <div className="min-w-0">
                        <p className="text-mq-sm font-medium text-mq-content">{t('mapLayers')}</p>
                        <p className="text-mq-xs text-mq-content-secondary">{t('mapLayersDesc')}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {activeOverlays.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {activeOverlays.length} {t('active')}
                        </Badge>
                      )}
                      <Button
                        variant={showOverlayPanel ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setShowOverlayPanel(!showOverlayPanel)}
                        ref={overlayToggleButtonRef}
                        aria-expanded={showOverlayPanel}
                        aria-controls="map-overlays-panel"
                        className="gap-2 whitespace-nowrap"
                      >
                        <Layers className="h-4 w-4" />
                        {showOverlayPanel ? t('hideLayers') : t('showLayers')}
                      </Button>
                    </div>
                  </div>

                  {/* Overlay Toggle Buttons */}
                  {showOverlayPanel && (
                    <div
                      id="map-overlays-panel"
                      ref={overlaysContainerRef}
                      onKeyDown={handleOverlayPanelKeyDown}
                      role="group"
                      aria-label={t('mapLayers')}
                      tabIndex={-1}
                      className="space-y-3 pt-3 border-t border-mq-border"
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {mapOverlays.map((overlay) => {
                          const Icon = OVERLAY_ICONS[overlay.id];
                          const isActive = activeOverlays.includes(overlay.id);
                          return (
                            <m.button
                              key={overlay.id}
                              onClick={() => {
                                toggleOverlay(overlay.id);
                                triggerHaptic('tap', 'light');
                              }}
                              aria-pressed={isActive}
                              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                              className={`w-full flex items-center gap-2 p-3 rounded-mq-lg border transition-colors duration-200 text-left relative overflow-hidden ${
                                isActive
                                  ? 'bg-mq-primary/10 border-mq-primary text-mq-primary'
                                  : 'bg-mq-background-secondary border-transparent hover:border-mq-border hover:bg-mq-hover-background text-mq-content'
                              }`}
                            >
                              {/* Ripple Effect */}
                              {isActive && !prefersReducedMotion && (
                                <m.div
                                  className="absolute inset-0 bg-mq-primary/5 rounded-mq-lg pointer-events-none"
                                  initial={{ scale: 0, opacity: 0.5 }}
                                  animate={{ scale: 1.5, opacity: 0 }}
                                  transition={{ duration: 0.5 }}
                                />
                              )}

                              <m.div
                                animate={
                                  isActive && !prefersReducedMotion
                                    ? {
                                        scale: [1, 1.2, 1],
                                        rotate: [0, 5, -5, 0],
                                      }
                                    : undefined
                                }
                                transition={prefersReducedMotion ? undefined : { duration: 0.4 }}
                              >
                                <Icon className={`h-5 w-5 flex-shrink-0 ${overlay.color}`} />
                              </m.div>
                              <div className="min-w-0 flex-1">
                                <p className="text-mq-sm font-medium truncate">
                                  {t(overlay.labelKey)}
                                </p>
                                <p className="text-mq-xs text-mq-content-secondary truncate">
                                  {t(overlay.descKey)}
                                </p>
                              </div>
                              <AnimatePresence>
                                {isActive && (
                                  <m.div
                                    initial={{ x: 10, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: 10, opacity: 0 }}
                                  >
                                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                                  </m.div>
                                )}
                              </AnimatePresence>
                            </m.button>
                          );
                        })}
                      </div>
                      {activeOverlays.length > 0 && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={copyShareableURL}
                            className="gap-1 text-mq-info"
                            title={t('copyShareableURL')}
                          >
                            <LinkIcon className="h-4 w-4" />
                            {t('copyLink')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearOverlays}
                            className="gap-1"
                          >
                            <X className="h-4 w-4" />
                            {t('clearAll')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </MagicCard>
            </div>
          </>
        )}

        {/* Combined Map Wrapper */}
        <div className="mb-6 w-full max-w-none">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3 px-1">
            <div className="w-full sm:w-auto">
              <MapViewToggle activeView={mapView} onViewChange={handleMapViewChange} />
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-mq-content-tertiary hidden md:block">
                {t('mapPanZoomHint')}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-8 border border-mq-border text-mq-content-secondary hover:text-mq-content hover:bg-mq-hover-background"
                  onClick={copyShareableURL}
                  aria-label={t('share')}
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">{t('share')}</span>
                </Button>
                {mapView === 'campus' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-8 border border-mq-border text-mq-content-secondary hover:text-mq-content hover:bg-mq-hover-background"
                    onClick={handleExport}
                    aria-label={t('export')}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-xs">{t('export')}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div
            id="map-container"
            ref={mapContainerRef}
            className="relative h-[65svh] min-h-[400px] sm:h-[75svh] md:h-[clamp(500px,70vh,800px)] lg:h-[clamp(600px,80vh,900px)] landscape:h-[75svh] landscape:min-h-[350px] w-full bg-mq-background-secondary overflow-hidden"
          >
            {mapView === 'campus' ? (
              <>
                {/* Real Map (with smooth fade-in when ready) */}
                <div
                  className={`absolute inset-0 transition-opacity duration-500 ${isMapReady ? 'opacity-100' : 'opacity-0'}`}
                >
                  <TranslatedMapErrorBoundary>
                    <Suspense fallback={null}>
                      <CampusMap
                        ref={campusMapRef}
                        selectedBuilding={selectedBuilding}
                        activeOverlays={activeOverlays}
                        onLocationStatusChange={setLocationStatus}
                        onNavStateChange={setNavState}
                        onMapReady={handleCampusMapReady}
                        devBuildingId={devBuildingId ?? undefined}
                        onDevPinMove={handleDevPinMove}
                      />
                    </Suspense>
                  </TranslatedMapErrorBoundary>
                </div>

                {/* Skeleton Overlay (fades out when map is ready) */}
                <AnimatePresence>
                  {!isMapReady && (
                    <m.div
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 z-10"
                    >
                      <MapLoadingSkeleton />
                    </m.div>
                  )}
                </AnimatePresence>

                {mapLoadTimedOut && (
                  <div className="absolute bottom-3 left-3 right-3 z-20 text-center">
                    <p className="text-xs text-mq-content-tertiary bg-mq-card-background/80 rounded-mq px-3 py-1.5 inline-block">
                      {t('mapLoadSlow')}
                    </p>
                  </div>
                )}

                {/* Dev Pin Editor toggle + panel (dev builds only) */}
                {process.env.NODE_ENV === 'development' && (
                  <>
                    {!devPanelOpen && (
                      <button
                        onClick={() => setDevPanelOpen(true)}
                        className="absolute right-3 top-3 z-[2000] flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white shadow-lg transition-colors hover:bg-orange-600"
                        title="Open Dev Pin Editor"
                        aria-label="Open Dev Pin Editor"
                      >
                        🔧
                      </button>
                    )}
                    {devPanelOpen && (
                      <DevPinPanel
                        devBuildingId={devBuildingId}
                        devPendingPos={devPendingPos}
                        isSaving={devIsSaving}
                        saved={devSaved}
                        onBuildingSelect={(id) => {
                          setDevBuildingId(id);
                          setDevPendingPos(null);
                          setDevSaved(false);
                        }}
                        onSave={() => void handleDevSave()}
                        onClose={() => {
                          setDevPanelOpen(false);
                          setDevBuildingId(null);
                          setDevPendingPos(null);
                        }}
                      />
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="absolute inset-0 z-10">
                <TranslatedMapErrorBoundary>
                  <GoogleMapController
                    selectedBuilding={selectedBuilding}
                    externalDestination={externalDestination}
                    onStreetViewChange={setIsStreetViewActive}
                    onDismissRoute={() => {
                      // Clear building selection from URL
                      const params = new URLSearchParams(searchParams.toString());
                      params.delete('building');
                      params.set('view', 'google');
                      const newUrl = `${window.location.pathname}?${params.toString()}`;
                      window.history.replaceState({}, '', newUrl);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                      // Clear external destination
                      setExternalDestination(null);
                    }}
                  />
                </TranslatedMapErrorBoundary>
              </div>
            )}

            {(mapView === 'campus' || mapView === 'google') && (
              <CampusMapHUD
                selectedBuilding={selectedBuilding}
                buildings={sidebarBuildings}
                buildingSearch={buildingSearch}
                setBuildingSearch={setBuildingSearch}
                onStartNavigation={handleStartNavigation}
                onStopNavigation={handleStopNavigation}
                isNavigating={navState?.isNavigating || false}
                isGoogleMode={mapView === 'google'}
                placeSuggestions={mapView === 'google' ? placeSuggestions : undefined}
                isLoadingPlaces={mapView === 'google' ? isLoadingPlaces : undefined}
                onSelectPlace={mapView === 'google' ? handleSelectPlace : undefined}
                onClearExternalPlace={handleClearExternalPlace}
                selectedPlaceLabel={externalDestination?.label}
                isFocusedMode={isFocusedMode}
                isStreetViewActive={mapView === 'google' ? isStreetViewActive : false}
              />
            )}
          </div>
        </div>

        {/* MQ Navigation companion app card — positions advanced wayfinding as a
            separate mobile-first companion, keeping Syllabus Sync's scope honest. */}
        <div className="mb-2">
          <MagicCard isLiquidEnhanced>
            <div className="mq-magic-card-content flex flex-col gap-4 border border-mq-border bg-mq-card-background p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-mq-lg bg-mq-primary/10 text-mq-primary">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-mq-base font-semibold text-mq-content">
                      {t('mqNavCompanionTitle')}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {t('mqNavCompanionStatus')}
                    </Badge>
                  </div>
                  <p className="mt-1.5 max-w-2xl text-mq-sm text-mq-content-secondary">
                    {t('mqNavCompanionDesc')}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <a
                  href="https://github.com/mrpouyaalavi/MQ_Navigation"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('mqNavCompanionCtaAria')}
                  className="inline-flex items-center gap-2 rounded-mq-lg border border-mq-border bg-mq-background px-4 py-2 text-mq-sm font-medium text-mq-content transition-colors hover:bg-mq-hover-background"
                >
                  <Github className="h-4 w-4" aria-hidden="true" />
                  {t('mqNavCompanionCta')}
                  <ExternalLink className="h-3.5 w-3.5 text-mq-content-tertiary" aria-hidden="true" />
                </a>
              </div>
            </div>
          </MagicCard>
        </div>
      </section>
    </LazyMotion>
  );
}
