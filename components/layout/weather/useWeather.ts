import { useState, useEffect, useCallback, useRef } from 'react';
import { SydneyRegion, WeatherData } from './types';
import { SYDNEY_REGIONS, determineVibe } from './constants';
import { WeatherResult } from '@/lib/weather/types';

const STORAGE_KEY = 'mq-weather-region';
const LOC_STORAGE_KEY = 'mq-weather-location-cache';
const CACHE_KEY_PREFIX = 'mq-weather-cache-';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type LocationSource = 'gps' | 'saved' | 'approx';

interface LocationCache {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: number;
}

export const useWeather = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<SydneyRegion>(SYDNEY_REGIONS[0]);
  const [useGps, setUseGps] = useState<boolean>(true);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load saved preferences
  useEffect(() => {
    try {
      const savedRegionId = localStorage.getItem(STORAGE_KEY);
      if (savedRegionId) {
        const region = SYDNEY_REGIONS.find((r) => r.id === savedRegionId);
        if (region) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSelectedRegion(region);
          setUseGps(false); // If they manually picked a region, turn off auto-GPS
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const getLocation = useCallback(async (): Promise<{
    lat: number;
    lon: number;
    type: LocationSource;
    name: string;
  }> => {
    if (useGps && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 15 * 60 * 1000, // 15 mins
          });
        });

        // Cache this good location
        const locCache: LocationCache = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now(),
        };
        localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify(locCache));

        return {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          type: 'gps',
          name: 'Current Location',
        };
      } catch {
        // Fallback to cache
      }
    }

    // Tier C: Saved last known good
    if (useGps) {
      try {
        const cached = localStorage.getItem(LOC_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as LocationCache;
          return {
            lat: parsed.lat,
            lon: parsed.lon,
            type: 'saved',
            name: 'Last Known Location',
          };
        }
      } catch {
        // Ignore
      }
    }

    // Tier D: Fallback to selected region
    return {
      lat: selectedRegion.lat,
      lon: selectedRegion.lon,
      type: 'approx',
      name: selectedRegion.name,
    };
  }, [useGps, selectedRegion]);

  const fetchWeather = useCallback(
    async (forceRefresh = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const loc = await getLocation();

        // Check cache
        const roundedLat = Math.round(loc.lat * 10000) / 10000;
        const roundedLon = Math.round(loc.lon * 10000) / 10000;
        const cacheKey = `${CACHE_KEY_PREFIX}${roundedLat},${roundedLon}`;

        if (!forceRefresh) {
          try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              const parsed = JSON.parse(cached) as {
                timestamp: number;
                data: WeatherData;
              };
              // 3.3 Stale detection
              if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
                setWeatherData(parsed.data);
                setLoading(false);
                return;
              }
            }
          } catch {}
        }

        const response = await fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Weather service unreachable');
        }

        const apiResponse = await response.json();
        const rawData = apiResponse?.data as WeatherResult;

        if (!rawData || !rawData.current || typeof rawData.current.temperature !== 'number') {
          throw new Error('Invalid weather data');
        }

        const current = rawData.current;
        const vibe = determineVibe(current.weatherCode, current.isDay);

        const newData: WeatherData = {
          temp: Math.round(current.temperature),
          apparentTemp: Math.round(current.apparentTemperature),
          precipProb: current.precipitationProbability,
          windSpeed: current.windSpeed,
          condition: current.condition,
          location: loc.name,
          locationType: loc.type,
          vibe,
          isDay: current.isDay,
          timestamp: rawData.timestamp || Date.now(),
        };

        setWeatherData(newData);

        try {
          localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: newData }));
        } catch {}
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;

        setError(err instanceof Error ? err.message : 'Weather unavailable');

        // Keep showing old data if it fails but mark it explicitly
      } finally {
        setLoading(false);
      }
    },
    [getLocation],
  );

  useEffect(() => {
    // 3.4 debounce fetch slightly
    const timer = setTimeout(() => {
      fetchWeather();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchWeather]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(
      () => {
        fetchWeather(true);
      },
      10 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const handleRegionChange = useCallback((region: SydneyRegion) => {
    setSelectedRegion(region);
    setUseGps(false);
    try {
      localStorage.setItem(STORAGE_KEY, region.id);
    } catch {}
  }, []);

  const enableGps = useCallback(() => {
    setUseGps(true);
    localStorage.removeItem(STORAGE_KEY);
    fetchWeather(true);
  }, [fetchWeather]);

  return {
    weatherData,
    loading,
    error,
    selectedRegion,
    handleRegionChange,
    useGps,
    enableGps,
    retry: () => fetchWeather(true),
  };
};
