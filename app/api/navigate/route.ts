import { NextRequest } from 'next/server';
import { jsonError, jsonSuccess, ERROR_CODES } from '@/app/api/_lib/response';
import { apiLimiter } from '@/lib/services/rateLimitService';
import { getClientIP } from '@/lib/security/ip';
import { parseJsonBody } from '@/app/api/_lib/middleware';
import { validateOrigin } from '@/lib/security/csrf';
import { createHash } from 'crypto';
import { logger } from '@/lib/logger';
import { GPS_CAMPUS_BOUNDS } from '@/features/map/lib/constants';

// Use server-only env var (no NEXT_PUBLIC_ prefix) for security
// The API key should only be set via ORS_API_KEY on the server
const ORS_API_KEY = process.env.ORS_API_KEY;
const ORS_BASE_URL =
  process.env.ORS_BASE_URL || 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

// ============================================================================
// CAMPUS GEOFENCE - Macquarie University bounds
// ============================================================================
// Prevents abuse by rejecting requests for routes outside campus area
// Only enforced when using real ORS API (to protect API quota)
const CAMPUS_BOUNDS = {
  minLat: GPS_CAMPUS_BOUNDS.south,
  maxLat: GPS_CAMPUS_BOUNDS.north,
  minLng: GPS_CAMPUS_BOUNDS.west,
  maxLng: GPS_CAMPUS_BOUNDS.east,
};

// Very generous buffer (50km) around campus for demo/testing from anywhere in Sydney
// This allows developers and testers to use the app from home while still preventing
// global abuse of the ORS API.
// SECURITY: In production, this is reduced to 5km via environment variable
const GEOFENCE_BUFFER_KM =
  process.env.NODE_ENV === 'production' ? Number(process.env.GEOFENCE_BUFFER_KM || 5) : 50;
const KM_PER_DEGREE_LAT = 111.32;
const KM_PER_DEGREE_LNG = 111.32 * Math.cos((-33.775 * Math.PI) / 180); // ~93km at this latitude

const EXTENDED_BOUNDS = {
  minLat: CAMPUS_BOUNDS.minLat - GEOFENCE_BUFFER_KM / KM_PER_DEGREE_LAT,
  maxLat: CAMPUS_BOUNDS.maxLat + GEOFENCE_BUFFER_KM / KM_PER_DEGREE_LAT,
  minLng: CAMPUS_BOUNDS.minLng - GEOFENCE_BUFFER_KM / KM_PER_DEGREE_LNG,
  maxLng: CAMPUS_BOUNDS.maxLng + GEOFENCE_BUFFER_KM / KM_PER_DEGREE_LNG,
};

// ============================================================================
// ROUTE CACHING - Prevent duplicate ORS API calls
// ============================================================================
// SECURITY: Increased cache size and added per-IP limits to prevent cache exhaustion
interface CachedRoute {
  data: unknown;
  timestamp: number;
  clientIP?: string;
}
const routeCache = new Map<string, CachedRoute>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500; // Increased from 100 to prevent easy exhaustion

// Track cache entries per IP to prevent cache flooding
const ipCacheCount = new Map<string, number>();
const MAX_CACHE_PER_IP = 20;

function getCacheKey(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): string {
  // Round to 5 decimal places (~1m precision) for cache hits
  const coords = `${start.lat.toFixed(5)},${start.lng.toFixed(5)}-${end.lat.toFixed(5)},${end.lng.toFixed(5)}`;
  return createHash('sha256').update(coords).digest('hex').substring(0, 16);
}

function getCachedRoute(key: string): unknown | null {
  const cached = routeCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    routeCache.delete(key);
    if (cached.clientIP) {
      const count = ipCacheCount.get(cached.clientIP) || 0;
      if (count > 1) ipCacheCount.set(cached.clientIP, count - 1);
      else ipCacheCount.delete(cached.clientIP);
    }
    return null;
  }
  return cached.data;
}

function setCachedRoute(key: string, data: unknown, clientIP?: string): void {
  // Check per-IP cache limit to prevent cache flooding attacks
  if (clientIP && clientIP !== 'unknown') {
    const currentCount = ipCacheCount.get(clientIP) || 0;
    if (currentCount >= MAX_CACHE_PER_IP) {
      // Don't cache, but don't fail the request either
      return;
    }
    ipCacheCount.set(clientIP, currentCount + 1);
  }

  // Evict oldest entries if cache is full
  if (routeCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = routeCache.keys().next().value;
    if (oldestKey) {
      const evicted = routeCache.get(oldestKey);
      if (evicted?.clientIP) {
        const count = ipCacheCount.get(evicted.clientIP) || 0;
        if (count > 1) ipCacheCount.set(evicted.clientIP, count - 1);
        else ipCacheCount.delete(evicted.clientIP);
      }
      routeCache.delete(oldestKey);
    }
  }
  routeCache.set(key, { data, timestamp: Date.now(), clientIP });
}

/**
 * Validates that a coordinate object has valid lat/lng values
 */
function isValidCoordinate(coord: unknown): coord is { lat: number; lng: number } {
  if (typeof coord !== 'object' || coord === null) {
    return false;
  }

  const { lat, lng } = coord as { lat?: unknown; lng?: unknown };

  // Check types
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return false;
  }

  // Check for NaN or Infinity
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  // Validate lat/lng ranges
  // Latitude: -90 to 90
  // Longitude: -180 to 180
  if (lat < -90 || lat > 90) {
    return false;
  }
  if (lng < -180 || lng > 180) {
    return false;
  }

  return true;
}

/**
 * Validates that coordinates are within the campus geofence
 */
function isWithinGeofence(coord: { lat: number; lng: number }): boolean {
  return (
    coord.lat >= EXTENDED_BOUNDS.minLat &&
    coord.lat <= EXTENDED_BOUNDS.maxLat &&
    coord.lng >= EXTENDED_BOUNDS.minLng &&
    coord.lng <= EXTENDED_BOUNDS.maxLng
  );
}

/**
 * Generate a simple demo route between two points
 * This is used when ORS_API_KEY is not configured
 */
function generateDemoRoute(start: { lat: number; lng: number }, end: { lat: number; lng: number }) {
  // Calculate straight-line distance (Haversine would be better, but this is demo)
  const latDiff = end.lat - start.lat;
  const lngDiff = end.lng - start.lng;
  const distanceKm = Math.sqrt(
    Math.pow(latDiff * KM_PER_DEGREE_LAT, 2) + Math.pow(lngDiff * KM_PER_DEGREE_LNG, 2),
  );
  const distanceMeters = distanceKm * 1000;

  // Estimate walking time (5 km/h average walking speed)
  const durationSeconds = (distanceKm / 5) * 3600;

  // Generate intermediate points for a simple route line
  const numPoints = Math.max(5, Math.min(20, Math.ceil(distanceMeters / 50)));
  const coordinates: [number, number][] = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    coordinates.push([start.lng + lngDiff * t, start.lat + latDiff * t]);
  }

  // Waypoint indices for steps: start, midpoint, end
  const midWaypoint = Math.floor(numPoints / 2);

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          summary: {
            distance: distanceMeters,
            duration: durationSeconds,
          },
          segments: [
            {
              steps: [
                {
                  type: 11, // ORS type 11 = depart
                  distance: distanceMeters * 0.3,
                  duration: durationSeconds * 0.3,
                  instruction: `Head towards ${end.lat > start.lat ? 'north' : 'south'}`,
                  way_points: [0, midWaypoint],
                  name: '',
                },
                {
                  type: 4, // ORS type 4 = straight
                  distance: distanceMeters * 0.5,
                  duration: durationSeconds * 0.5,
                  instruction: 'Continue on the campus pathway',
                  way_points: [midWaypoint, numPoints - 1],
                  name: '',
                },
                {
                  type: 10, // ORS type 10 = arrive
                  distance: distanceMeters * 0.2,
                  duration: durationSeconds * 0.2,
                  instruction: 'Arrive at your destination',
                  way_points: [numPoints - 1, numPoints],
                  name: '',
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  // SECURITY: Validate origin for CSRF protection on mutation requests
  const originResult = validateOrigin(request);
  if (!originResult.valid) {
    return jsonError('Invalid request origin', 403, ERROR_CODES.FORBIDDEN);
  }

  // SECURITY: Use shared IP extraction utility for consistent, secure IP handling
  const clientIP = getClientIP(request);
  const clientId = `ip:${clientIP}`;

  // Apply rate limiting (works for both authenticated and demo modes)
  const { allowed, remaining, resetIn } = await apiLimiter(clientId);
  if (!allowed) {
    return jsonError(
      'Rate limit exceeded. Please wait before making more navigation requests.',
      429,
      ERROR_CODES.RATE_LIMITED,
      { retryAfter: resetIn },
    );
  }

  try {
    // SECURITY: Parse with size limit protection (small limit for coordinates)
    const bodyResult = await parseJsonBody(request, 10 * 1024); // 10KB limit for navigation requests
    if (!bodyResult.success) {
      return jsonError(bodyResult.error, bodyResult.status, ERROR_CODES.VALIDATION_ERROR);
    }
    const body = bodyResult.data as Record<string, unknown>;

    if (!body || typeof body !== 'object') {
      return jsonError('Invalid request body', 400, ERROR_CODES.BAD_REQUEST);
    }

    const { start, end } = body;

    if (!start || !end) {
      return jsonError('Missing start or end coordinates', 400, ERROR_CODES.BAD_REQUEST);
    }

    if (!isValidCoordinate(start)) {
      return jsonError(
        'Invalid start coordinates. Expected { lat: number, lng: number } with lat in [-90, 90] and lng in [-180, 180]',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    if (!isValidCoordinate(end)) {
      return jsonError(
        'Invalid end coordinates. Expected { lat: number, lng: number } with lat in [-90, 90] and lng in [-180, 180]',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    // SECURITY: Validate coordinates are within campus geofence
    // Only enforce strictly when ORS_API_KEY is configured (to protect API quota)
    // In demo mode, we allow any coordinates since demo routes are free
    if (ORS_API_KEY && (!isWithinGeofence(start) || !isWithinGeofence(end))) {
      return jsonError(
        'Coordinates must be within the Macquarie University campus area',
        400,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    // Check cache first
    const cacheKey = getCacheKey(start, end);
    const cachedData = getCachedRoute(cacheKey);
    if (cachedData) {
      const response = jsonSuccess(cachedData);
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      return response;
    }

    // If no ORS_API_KEY, return demo route
    if (!ORS_API_KEY) {
      logger.warn('ORS_API_KEY not configured - returning demo route');
      const demoData = generateDemoRoute(start, end);
      setCachedRoute(cacheKey, demoData, clientIP);

      const response = jsonSuccess(demoData);
      response.headers.set('X-Cache', 'DEMO');
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      return response;
    }

    const orsResponse = await fetch(ORS_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ORS_API_KEY,
      },
      body: JSON.stringify({
        coordinates: [
          [start.lng, start.lat],
          [end.lng, end.lat],
        ],
        instructions: true,
      }),
      // Add explicit timeout signal to avoid hanging
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!orsResponse.ok) {
      const errText = await orsResponse.text();
      logger.error('ORS Upstream Error:', {
        status: orsResponse.status,
        statusText: orsResponse.statusText,
        body: errText.substring(0, 200), // Log first 200 chars
      });
      return jsonError(
        `Navigation service temporarily unavailable`,
        orsResponse.status >= 500 ? 502 : orsResponse.status,
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      );
    }

    const data = await orsResponse.json();

    // Cache the successful response
    setCachedRoute(cacheKey, data, clientIP);

    const response = jsonSuccess(data);
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Navigate Proxy error:', {
      message: errorMessage,
      stack: errorStack,
      clientIP: clientIP !== 'unknown' ? clientIP : undefined, // Log IP if available for debugging abuse
    });

    // Distinguish timeout vs other errors
    if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
      return jsonError('Navigation request timed out', 504, ERROR_CODES.TIMEOUT);
    }

    return jsonError('Internal Server Error', 500, ERROR_CODES.INTERNAL_ERROR);
  }
}
