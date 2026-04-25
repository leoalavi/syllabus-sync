import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Badge } from '@/components/ui/mq/badge';
import { cn } from '@/lib/utils';
import {
  Building,
  BUILDING_CATEGORY_LABELS,
  getBuildingCrsCoords,
  buildings,
  MAP_CONFIG,
  BUILDING_PIXEL_OFFSET_X,
} from '@/features/map/lib/buildings';
import { createMarkerIcon, createUserLocationIcon } from '@/features/map/lib/mapUtils';
import { NavigationStateManager } from '@/features/map/lib/realtimeNavigation';
import { setHapticEnabledGetter } from '@/lib/utils/haptics';
import { useSafeTranslation } from '@/lib/hooks/useSafeTranslation';
import { useLeafletLoader } from '@/features/map/hooks/useLeafletLoader';
import { devLog } from '@/lib/utils/devLog';
import type { MapOverlayId } from '@/features/map/lib/mapOverlays';
import { useMapStore } from '@/lib/store/mapStore';
import { CAMPUS_CENTER_PIXEL, PIXEL_BOUNDS, CAMPUS_IMAGE_URL } from '@/features/map/lib/constants';
import { useMapLocation } from '../hooks/useMapLocation';
import { MapOverlays } from './MapOverlays';
import { MapController } from './MapController';

// Map-specific logger
const mapLog = devLog.map;

/** Location tracking status */
export type LocationStatus = 'idle' | 'searching' | 'found' | 'denied' | 'error';

export interface CampusMapRef {
  startNavigation: () => void;
  stopNavigation: () => void;
  isNavigating: boolean;
}

interface CampusMapProps {
  selectedBuilding?: Building;
  activeOverlays?: MapOverlayId[];
  /** Callback when location status changes */
  onLocationStatusChange?: (status: LocationStatus) => void;
  /** Callback when navigation state changes (for RouteAnnouncer) */
  onNavStateChange?: (state: {
    isNavigating: boolean;
    remainingDistance?: number;
    status?: 'idle' | 'navigating' | 'arrived' | 'off-route' | 'recalculating' | 'error';
  }) => void;
  /** Callback when map is fully ready (for smooth loading transitions) */
  onMapReady?: () => void;
  // --- Dev-only props (tree-shaken in production) ---
  /** Building id whose marker should be draggable (dev mode only) */
  devBuildingId?: string;
  /** Fires when the dev marker is dragged; receives new [x, y] pixel coords */
  onDevPinMove?: (buildingId: string, position: [number, number]) => void;
}

const CampusMap = forwardRef<CampusMapRef, CampusMapProps>(
  (
    {
      selectedBuilding,
      activeOverlays = [],
      onLocationStatusChange,
      onNavStateChange: _onNavStateChange,
      onMapReady,
      devBuildingId,
      onDevPinMove,
    },
    ref,
  ) => {
    const { t } = useSafeTranslation();

    const { hapticFeedbackEnabled } = useMapStore();

    // Sync haptic state with store
    useEffect(() => {
      setHapticEnabledGetter(() => hapticFeedbackEnabled);
    }, [hapticFeedbackEnabled]);

    // ============================================
    // LEAFLET MODULE - Loaded dynamically
    // ============================================
    const { leafletModule, reactLeafletModule, isClientReady, mapKey, isMountedRef } =
      useLeafletLoader();

    // ============================================
    // COMPONENT STATE
    // ============================================
    const [mapInstance, setMapInstance] = useState<import('leaflet').Map | null>(null);
    const [overlaysReady, setOverlaysReady] = useState(false);
    const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
    const [showOffCampusWarning, setShowOffCampusWarning] = useState(false);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const navManagerRef = useRef<NavigationStateManager | null>(null);
    const hasNotifiedReadyRef = useRef(false);
    const wasOffCampusRef = useRef(false);
    const offCampusWarningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Initialize Navigation Manager
    useEffect(() => {
      navManagerRef.current = new NavigationStateManager();
      return () => {
        if (navManagerRef.current) {
          navManagerRef.current.stopNavigation();
          navManagerRef.current = null;
        }
      };
    }, []);

    // Create marker icon using centralized utility
    const getMarkerIcon = useCallback(
      (isSelected: boolean) => {
        if (!leafletModule) return undefined;
        return createMarkerIcon(leafletModule, isSelected, 'animate-marker-drop-in');
      },
      [leafletModule],
    );

    // Create user location icon using centralized utility
    const userIcon = useMemo(() => {
      if (!leafletModule) return null;
      return createUserLocationIcon(leafletModule) || null;
    }, [leafletModule]);

    const selectedIcon = useMemo(() => getMarkerIcon(true), [getMarkerIcon]);
    const selectedIndicatorIcon = useMemo(() => {
      if (!leafletModule) return null;
      return leafletModule.divIcon({
        className: 'selected-building-indicator-wrapper',
        html: '<span class="selected-building-indicator"></span>',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
    }, [leafletModule]);

    const isMapReady = useCallback(
      (map: import('leaflet').Map | null | undefined): map is import('leaflet').Map => {
        if (!map) return false;
        try {
          const container = map.getContainer();
          if (!container || !container.parentNode) return false;
          if (!map.getCenter || !map.getZoom) return false;
          return true;
        } catch {
          return false;
        }
      },
      [],
    );

    // Get building coordinates helper (uses GCP-calibrated offset)
    const getBuildingLatLng = useCallback((building: Building): { lat: number; lng: number } => {
      return getBuildingCrsCoords(building);
    }, []);

    // ============================================
    // HOOKS (Logic Extraction)
    // ============================================

    // 1. Location Logic
    const { locationStatus, isOffCampus, centerOnUser } = useMapLocation({
      mapInstance,
      leafletModule,
      isMapReady,
      userIcon,
      navManagerRef,
    });

    // Campus map is view-only — no navigation logic.
    // Expose no-op navigation control to parent for interface compatibility.
    useImperativeHandle(ref, () => ({
      startNavigation: () => {},
      stopNavigation: () => {},
      isNavigating: false,
    }));

    // Notify parent of location status
    useEffect(() => {
      onLocationStatusChange?.(locationStatus);
    }, [locationStatus, onLocationStatusChange]);

    // ============================================
    // OVERLAYS READY EFFECT
    // ============================================
    const mapValid = !!mapInstance && isMapReady(mapInstance);

    useEffect(() => {
      if (!mapValid || !mapInstance) {
        return;
      }
      if (!hasNotifiedReadyRef.current) {
        hasNotifiedReadyRef.current = true;
        onMapReady?.();
      }
      const timer = setTimeout(() => {
        if (isMountedRef.current && isMapReady(mapInstance)) {
          mapLog.log('Map stable, enabling overlays');
          setOverlaysReady(true);
        }
      }, 100);
      return () => {
        clearTimeout(timer);
        setOverlaysReady(false);
      };
    }, [mapValid, mapInstance, isMapReady, isMountedRef, onMapReady]);

    /* Synchronizing isOffCampus (derived from geolocation, an external system)
       into local warning display state. The setTimeout auto-dismiss must use
       setState to clear the banner after 3 seconds. */
    useEffect(() => {
      const wasOffCampus = wasOffCampusRef.current;
      wasOffCampusRef.current = isOffCampus;

      if (isOffCampus && !wasOffCampus) {
        // Entered off-campus: show warning for 3 seconds
        setShowOffCampusWarning(true);
        if (offCampusWarningTimeoutRef.current) {
          clearTimeout(offCampusWarningTimeoutRef.current);
        }
        offCampusWarningTimeoutRef.current = setTimeout(() => {
          setShowOffCampusWarning(false);
          offCampusWarningTimeoutRef.current = null;
        }, 3000);
      } else if (!isOffCampus) {
        // Returned on-campus: clear immediately
        setShowOffCampusWarning(false);
        if (offCampusWarningTimeoutRef.current) {
          clearTimeout(offCampusWarningTimeoutRef.current);
          offCampusWarningTimeoutRef.current = null;
        }
      }

      return () => {
        if (offCampusWarningTimeoutRef.current) {
          clearTimeout(offCampusWarningTimeoutRef.current);
        }
      };
    }, [isOffCampus]);

    // ============================================
    // RENDER
    // ============================================
    useEffect(() => {
      let revokedUrl: string | null = null;
      let active = true;

      const fetchImage = async () => {
        try {
          const response = await fetch(CAMPUS_IMAGE_URL, { cache: 'no-store' });
          if (!active) return;
          if (!response.ok) return;
          const blob = await response.blob();
          if (!active) return;

          const objectUrl = URL.createObjectURL(blob);
          revokedUrl = objectUrl;

          // Preload the image to ensure it's fully decoded before passing to Leaflet
          await new Promise<void>((resolve, reject) => {
            const img = new globalThis.Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Image preload failed'));
            img.src = objectUrl;
          });

          if (!active) return;
          setOverlayUrl(objectUrl);
        } catch (error) {
          if (!active) return;
          mapLog.log('Campus image fetch failed:', error);
        }
      };

      fetchImage();

      return () => {
        active = false;
        if (revokedUrl) {
          URL.revokeObjectURL(revokedUrl);
        }
      };
    }, []);

    return (
      <div
        ref={mapContainerRef}
        className="relative w-full h-full"
        role="region"
        aria-label={t('interactiveCampusMap')}
      >
        {/* Screen Reader Announcements */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {selectedBuilding && <span>{t(selectedBuilding.translationKey)}</span>}
          {isOffCampus && <span>{t('locationOutsideCampusTitle')}</span>}
        </div>

        {showOffCampusWarning && (
          <div className="absolute bottom-3 left-3 right-3 md:right-auto z-[1000] rounded-mq-lg bg-mq-warning px-4 py-3 text-sm text-white shadow flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
            <span className="font-semibold">{t('locationOutsideCampusTitle')}</span>
            <span className="text-white/90">{t('locationOutsideCampusMessage')}</span>
          </div>
        )}

        {/* Map Container */}
        {isClientReady && reactLeafletModule && leafletModule ? (
          <reactLeafletModule.MapContainer
            key={`map-${mapKey}`}
            crs={leafletModule.CRS.Simple}
            center={CAMPUS_CENTER_PIXEL}
            zoom={0}
            zoomControl
            scrollWheelZoom
            doubleClickZoom="center"
            touchZoom
            dragging
            zoomSnap={0.5}
            zoomDelta={0.5}
            inertia
            inertiaDeceleration={3000}
            maxBoundsViscosity={1.0}
            style={{ height: '100%', width: '100%' }}
          >
            <MapController
              selectedBuilding={selectedBuilding}
              setMapInstance={setMapInstance}
              reactLeafletModule={reactLeafletModule}
              leafletModule={leafletModule}
            />

            {/* Base Campus Layer */}
            {overlayUrl && (
              <reactLeafletModule.ImageOverlay
                key={overlayUrl}
                url={overlayUrl}
                bounds={PIXEL_BOUNDS}
                opacity={1}
                eventHandlers={{
                  load: () => {
                    mapLog.log('Campus map image loaded successfully');
                  },
                  error: () => {
                    mapLog.error('Campus map image failed to load:', CAMPUS_IMAGE_URL);
                  },
                }}
              />
            )}

            {/* Overlays */}
            <MapOverlays
              reactLeafletModule={reactLeafletModule}
              activeOverlays={activeOverlays}
              overlaysReady={overlaysReady}
            />

            {/* Building Markers — only show marker for selected building */}
            {overlaysReady && selectedBuilding && selectedIcon && (
              <reactLeafletModule.Marker
                key={selectedBuilding.id}
                position={getBuildingLatLng(selectedBuilding)}
                icon={selectedIcon}
                riseOnHover
                riseOffset={420}
                zIndexOffset={1000}
              >
                <reactLeafletModule.Popup>
                  <div className="p-3 w-[min(320px,calc(100vw-5rem))]">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-base leading-tight text-mq-content flex-1">
                        {t(selectedBuilding.translationKey)}
                      </h3>
                      {selectedBuilding.category && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] shrink-0 border border-mq-primary/30 text-mq-primary bg-mq-primary/10"
                        >
                          {t(BUILDING_CATEGORY_LABELS[selectedBuilding.category])}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs font-mono">
                        {selectedBuilding.id}
                      </Badge>
                      {selectedBuilding.gridRef && (
                        <span className="text-xs text-mq-content-tertiary font-mono">
                          {t('gridRef')}: {selectedBuilding.gridRef}
                        </span>
                      )}
                    </div>
                    {selectedBuilding.address && (
                      <div className="flex items-center gap-1.5 text-xs text-mq-content-secondary mb-2">
                        <svg
                          className="w-3.5 h-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="line-clamp-2">{selectedBuilding.address}</span>
                      </div>
                    )}
                  </div>
                </reactLeafletModule.Popup>
              </reactLeafletModule.Marker>
            )}

            {/* Selected building location indicator */}
            {overlaysReady && selectedBuilding && selectedIndicatorIcon && (
              <reactLeafletModule.Marker
                position={getBuildingLatLng(selectedBuilding)}
                icon={selectedIndicatorIcon}
                interactive={false}
                keyboard={false}
                zIndexOffset={900}
              />
            )}

            {/* DEV: Draggable reposition marker */}
            {process.env.NODE_ENV === 'development' &&
              overlaysReady &&
              devBuildingId &&
              (() => {
                const devBuilding = buildings.find((b) => b.id === devBuildingId);
                if (!devBuilding || !leafletModule) return null;
                // Orange pin to distinguish from regular markers
                const devIcon = leafletModule.divIcon({
                  className: '',
                  html: '<div style="width:22px;height:22px;border-radius:50%;background:#f97316;border:3px solid #fff;box-shadow:0 0 0 2px #f97316,0 2px 8px rgba(0,0,0,0.4);cursor:grab"></div>',
                  iconSize: [22, 22],
                  iconAnchor: [11, 11],
                });
                return (
                  <reactLeafletModule.Marker
                    key={`dev-drag-${devBuilding.id}`}
                    position={getBuildingLatLng(devBuilding)}
                    icon={devIcon}
                    draggable
                    zIndexOffset={2000}
                    eventHandlers={{
                      dragend: (e) => {
                        const { lat, lng } = (
                          e.target as { getLatLng: () => { lat: number; lng: number } }
                        ).getLatLng();
                        const px = Math.round(lng - BUILDING_PIXEL_OFFSET_X);
                        const py = Math.round(MAP_CONFIG.height - lat);
                        onDevPinMove?.(devBuilding.id, [px, py]);
                      },
                    }}
                  />
                );
              })()}
          </reactLeafletModule.MapContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-mq-background-secondary">
            <span className="animate-pulse text-mq-content-secondary">{t('loadingMap')}</span>
          </div>
        )}

        {/* Locate Me button — left side to avoid Leaflet zoom controls on right */}
        <button
          onClick={centerOnUser}
          className={cn(
            'absolute left-3 z-[1000] flex h-10 w-10 items-center justify-center rounded bg-white dark:bg-mq-card-background shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-[bottom] duration-200 hover:bg-gray-100 dark:hover:bg-mq-hover-background active:bg-gray-200 dark:active:bg-mq-background-secondary focus:outline-none',
            selectedBuilding ? 'bottom-[220px] sm:bottom-12' : 'bottom-12',
          )}
          aria-label={t('centerOnLocation')}
          title={t('centerOnLocation')}
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-mq-content-secondary"
            fill="none"
            viewBox="0 0 24 24"
          >
            {locationStatus === 'searching' ? (
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="60"
                strokeDashoffset="20"
                className="animate-spin origin-center"
              />
            ) : (
              <>
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
                <circle
                  cx="12"
                  cy="12"
                  r="2"
                  fill={locationStatus === 'found' ? 'var(--mq-primary)' : 'currentColor'}
                  stroke="none"
                />
                <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" />
                <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="2" />
                <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" />
              </>
            )}
          </svg>
        </button>
      </div>
    );
  },
);

CampusMap.displayName = 'CampusMap';

export default CampusMap;
