import { useEffect, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';

import type { CategoryId } from '@/constants/categories';
import {
  MAX_MARKER_LON_DELTA,
  queryMarkers,
  type Bounds,
} from '@/data/repository';
import type { MapMarker } from '@/data/types';

/** Debounce window for panning, so a drag issues one query rather than dozens. */
const QUERY_DEBOUNCE_MS = 120;

/** Stable empty array, so zoomed-out renders don't churn marker identity. */
const NO_MARKERS: MapMarker[] = [];

export function regionToBounds(region: Region): Bounds {
  return {
    minLat: region.latitude - region.latitudeDelta / 2,
    maxLat: region.latitude + region.latitudeDelta / 2,
    minLon: region.longitude - region.longitudeDelta / 2,
    maxLon: region.longitude + region.longitudeDelta / 2,
  };
}

/**
 * Keeps the visible marker set in sync with the viewport and active filters.
 *
 * Queries are debounced and serialised: a request that resolves after a newer
 * one has already been issued is discarded, so fast panning can't leave stale
 * markers on screen.
 */
export function useMapMarkers(
  region: Region | null,
  categories: readonly CategoryId[],
  enabled: boolean,
): { markers: MapMarker[]; loading: boolean; tooFarOut: boolean } {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  // Derived during render rather than stored: no query is issued at all above
  // the zoom floor, so there is nothing to keep in state.
  const tooFarOut =
    region != null && region.longitudeDelta > MAX_MARKER_LON_DELTA;

  useEffect(() => {
    if (!region || !enabled) return;

    // Past the zoom floor, issue no query at all. The stale marker set is
    // simply not returned (see below), so there is no state to clear.
    if (region.longitudeDelta > MAX_MARKER_LON_DELTA) return;

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      setLoading(true);
      void queryMarkers(regionToBounds(region), categories)
        .then((next) => {
          if (requestId === requestIdRef.current) setMarkers(next);
        })
        .catch(() => {
          if (requestId === requestIdRef.current) setMarkers([]);
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false);
        });
    }, QUERY_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `categories` is a stable array from the filter state; joining it keeps the
    // dependency comparison value-based rather than identity-based.
  }, [region, categories, enabled]);

  return { markers: tooFarOut ? NO_MARKERS : markers, loading, tooFarOut };
}
