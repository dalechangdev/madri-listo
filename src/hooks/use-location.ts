import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export type Coordinates = { latitude: number; longitude: number };

export type LocationStatus = {
  coords: Coordinates | null;
  /** null until the permission has been checked. */
  granted: boolean | null;
  loading: boolean;
  error: string | null;
  request: () => Promise<void>;
};

/**
 * Foreground location, requested lazily. The app is fully usable without it —
 * permission is only needed for "near me" ordering and the locate button — so
 * nothing here throws or blocks rendering.
 */
export function useLocation(autoRequest = false): LocationStatus {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const isGranted = status === Location.PermissionStatus.GRANTED;
      setGranted(isGranted);
      if (!isGranted) return;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      const isGranted = status === Location.PermissionStatus.GRANTED;
      setGranted(isGranted);
      // Already granted, or the caller wants the prompt up front.
      if (isGranted || autoRequest) void request();
    })();
    return () => {
      cancelled = true;
    };
  }, [autoRequest, request]);

  return { coords, granted, loading, error, request };
}
