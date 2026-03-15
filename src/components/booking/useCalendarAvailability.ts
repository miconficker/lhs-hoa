/**
 * useCalendarAvailability Hook
 *
 * Manages lazy loading of availability data with caching and IntersectionObserver.
 * - Loads data by month as user scrolls
 * - Caches fetched data by month and amenity type
 * - Initial load: current month + next 2 months
 * - Supports both resident and external API endpoints
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  format,
  addMonths,
  startOfMonth,
  endOfMonth,
  differenceInCalendarMonths,
} from "date-fns";
import type { AmenityType, TimeBlockSlot } from "@/types";

interface AvailabilityCache {
  [key: string]: {
    data: Map<string, TimeBlockSlot[]>;
    loading: Set<string>;
  };
}

interface UseCalendarAvailabilityOptions {
  mode: "resident" | "external";
  amenityType: AmenityType;
  bookingHorizonMonths?: number;
  initialLoadMonths?: number;
}

const DEFAULT_HORIZON_MONTHS = 12;
const DEFAULT_INITIAL_LOAD_MONTHS = 3;

export function useCalendarAvailability({
  mode,
  amenityType,
  bookingHorizonMonths = DEFAULT_HORIZON_MONTHS,
  initialLoadMonths = DEFAULT_INITIAL_LOAD_MONTHS,
}: UseCalendarAvailabilityOptions) {
  const [availability, setAvailability] = useState<
    Map<string, TimeBlockSlot[]>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for cache and state management
  const cacheRef = useRef<AvailabilityCache>({});
  const loadingMonthsRef = useRef<Set<string>>(new Set());
  const loadedMonthsRef = useRef<Set<string>>(new Set());

  // Get cache key for amenity type
  const getCacheKey = useCallback(
    (amenity: AmenityType) => {
      return `${mode}-${amenity}`;
    },
    [mode],
  );

  // Get month key for caching
  const getMonthKey = useCallback((date: Date) => {
    return format(date, "yyyy-MM");
  }, []);

  // Initialize cache for amenity if not exists
  const ensureCache = useCallback(
    (amenity: AmenityType) => {
      const cacheKey = getCacheKey(amenity);
      if (!cacheRef.current[cacheKey]) {
        cacheRef.current[cacheKey] = {
          data: new Map(),
          loading: new Set(),
        };
      }
      return cacheRef.current[cacheKey];
    },
    [getCacheKey],
  );

  // Fetch availability for a date range
  const fetchAvailabilityForRange = useCallback(
    async (
      startDate: string,
      endDate: string,
    ): Promise<Map<string, TimeBlockSlot[]>> => {
      const cache = ensureCache(amenityType);
      const result = new Map<string, TimeBlockSlot[]>();

      // Check what dates we need to fetch
      const datesToFetch: string[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = format(d, "yyyy-MM-dd");
        if (!result.has(dateStr) && !cache.data.has(dateStr)) {
          datesToFetch.push(dateStr);
        } else if (cache.data.has(dateStr)) {
          result.set(dateStr, cache.data.get(dateStr)!);
        }
      }

      if (datesToFetch.length === 0) {
        return result;
      }

      try {
        setLoading(true);
        setError(null);

        if (mode === "resident") {
          const token = localStorage.getItem("hoa_token");
          const response = await fetch(
            `/api/bookings/availability/${amenityType}/range?start=${datesToFetch[0]}&end=${datesToFetch[datesToFetch.length - 1]}`,
            {
              headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: `Bearer ${token}` }),
              },
            },
          );

          if (!response.ok) throw new Error("Failed to fetch availability");

          const data = await response.json();

          // NEW FIX: Handle the array whether it's wrapped in 'data.available' or just 'available'
          const availableArray = data.available || data.data?.available;

          if (Array.isArray(availableArray)) {
            for (const item of availableArray) {
              result.set(item.date, item.available_slots);
              cache.data.set(item.date, item.available_slots);
            }
          }

          // NEW FIX: Use functional state update to prevent stale data
          setAvailability((prev) => new Map([...prev, ...result]));
          return result;
        } else {
          // External mode - use range query for efficiency
          const response = await fetch(
            `/api/public/availability/${amenityType}?start=${datesToFetch[0]}&end=${datesToFetch[datesToFetch.length - 1]}`,
            {
              headers: { "Content-Type": "application/json" },
            },
          );

          if (!response.ok) {
            throw new Error("Failed to fetch availability");
          }

          const data = await response.json();

          // Extract array from API response
          const availableArray = data.available || data.data?.available;

          if (Array.isArray(availableArray)) {
            for (const item of availableArray) {
              // Cache all dates from the response
              result.set(item.date, item.available_slots);
              cache.data.set(item.date, item.available_slots);
            }
          }

          // Use functional state update
          setAvailability((prev) => new Map([...prev, ...result]));
          return result;
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to load availability";
        setError(errorMsg);
        console.error("Error fetching availability:", err);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [amenityType, mode, ensureCache],
  );

  // Load month data (for lazy loading)
  const loadMonth = useCallback(
    async (date: Date) => {
      const monthKey = getMonthKey(date);

      if (
        loadedMonthsRef.current.has(monthKey) ||
        loadingMonthsRef.current.has(monthKey)
      ) {
        return;
      }

      loadingMonthsRef.current.add(monthKey);

      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);

      await fetchAvailabilityForRange(
        format(monthStart, "yyyy-MM-dd"),
        format(monthEnd, "yyyy-MM-dd"),
      );

      loadedMonthsRef.current.add(monthKey);
      loadingMonthsRef.current.delete(monthKey);
    },
    [getMonthKey, fetchAvailabilityForRange],
  );

  // Initial load
  useEffect(() => {
    const loadInitialMonths = async () => {
      const now = new Date();
      const monthsToLoad: Date[] = [];

      for (let i = 0; i < initialLoadMonths; i++) {
        const monthDate = addMonths(now, i);
        const monthEnd = endOfMonth(monthDate);
        const today = new Date();

        const monthsFromNow = differenceInCalendarMonths(monthEnd, today);
        if (monthsFromNow < bookingHorizonMonths) {
          monthsToLoad.push(monthDate);
        }
      }

      await Promise.all(monthsToLoad.map((m) => loadMonth(m)));
    };

    loadInitialMonths();
  }, [initialLoadMonths, bookingHorizonMonths, loadMonth]);

  // Reset when amenity changes
  useEffect(() => {
    loadedMonthsRef.current.clear();
    loadingMonthsRef.current.clear();
    // Also clear existing state when switching amenity to avoid ghost data
    setAvailability(new Map());
  }, [amenityType]);

  const getAvailabilityForDate = useCallback(
    (date: Date): TimeBlockSlot[] => {
      const dateStr = format(date, "yyyy-MM-dd");
      return availability.get(dateStr) || [];
    },
    [availability],
  );

  const isSlotAvailable = useCallback(
    (date: Date, slot: TimeBlockSlot): boolean => {
      const available = getAvailabilityForDate(date);
      return available.includes(slot);
    },
    [getAvailabilityForDate],
  );

  return {
    availability,
    loading,
    error,
    loadMonth,
    getAvailabilityForDate,
    isSlotAvailable,
  };
}
