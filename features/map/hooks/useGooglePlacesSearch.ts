'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface GooglePlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  distanceMeters?: number;
}

interface UseGooglePlacesSearchOptions {
  /** Only search when campus results have no strong match */
  enabled: boolean;
  /** Minimum query length to trigger search (default: 3) */
  minLength?: number;
  /** Debounce delay in ms (default: 400) */
  debounceMs?: number;
}

interface UseGooglePlacesSearchResult {
  suggestions: GooglePlaceSuggestion[];
  isLoading: boolean;
  error: string | null;
}

interface PlaceSearchApiResponse {
  success: boolean;
  data?: GooglePlaceSuggestion[];
  error?: { message: string };
}

export function useGooglePlacesSearch(
  query: string,
  languageCode: string,
  options: UseGooglePlacesSearchOptions,
): UseGooglePlacesSearchResult {
  const { enabled, minLength = 3, debounceMs = 400 } = options;
  const [suggestions, setSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionTokenRef = useRef<string>(generateSessionToken());
  const lastQueryRef = useRef<string>('');

  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      // Cancel any in-flight request
      abortControllerRef.current?.abort();

      const trimmed = searchQuery.trim();
      if (trimmed.length < minLength) {
        setSuggestions([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      // Skip if same query
      if (lastQueryRef.current === trimmed) return;
      lastQueryRef.current = trimmed;

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/maps/place-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: trimmed,
            sessionToken: sessionTokenRef.current,
            languageCode,
          }),
          signal: controller.signal,
        });

        const json = (await response.json()) as PlaceSearchApiResponse;

        if (controller.signal.aborted) return;

        if (!response.ok || !json.success || !json.data) {
          setError(json.error?.message ?? 'Search failed');
          setSuggestions([]);
          return;
        }

        setSuggestions(json.data);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('Search failed');
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [languageCode, minLength],
  );

  // Debounced search effect
  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      lastQueryRef.current = '';
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < minLength) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      lastQueryRef.current = '';
      return;
    }

    const timer = setTimeout(() => {
      void fetchSuggestions(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, enabled, minLength, debounceMs, fetchSuggestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Rotate session token when query is cleared (new search session)
  useEffect(() => {
    if (!query.trim()) {
      sessionTokenRef.current = generateSessionToken();
    }
  }, [query]);

  useEffect(() => {
    lastQueryRef.current = '';
  }, [languageCode]);

  return { suggestions, isLoading, error };
}

function generateSessionToken(): string {
  return `ss_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
