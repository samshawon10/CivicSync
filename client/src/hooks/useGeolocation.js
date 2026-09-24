import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Geolocation hook with honest state handling:
 *  - `location` is null until a real fix is obtained,
 *  - `error` explains exactly why capture failed (unsupported / denied / timeout),
 *  - `watch` streams updates for live responder tracking.
 */
export default function useGeolocation({ auto = false, timeout = 10000 } = {}) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const watchId = useRef(null);

  const supported = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

  const capture = useCallback(() => new Promise((resolve) => {
    if (!supported) {
      const message = 'Location services are unavailable in this browser. Enter the location manually.';
      setError(message);
      resolve({ ok: false, error: message, location: null });
      return;
    }
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          timestamp: position.timestamp || Date.now()
        };
        setLocation(next);
        setAccuracy(position.coords.accuracy ?? null);
        setLoading(false);
        resolve({ ok: true, location: next });
      },
      (err) => {
        const message = err.code === err.PERMISSION_DENIED
          ? 'Location permission was denied. Enter the location manually.'
          : err.code === err.TIMEOUT
            ? 'Location request timed out. Enter the location manually.'
            : 'Could not determine your location. Enter the location manually.';
        setError(message);
        setLoading(false);
        resolve({ ok: false, error: message, location: null });
      },
      { enableHighAccuracy: true, timeout, maximumAge: 30000 }
    );
  }), [supported, timeout]);

  const startWatch = useCallback((onUpdate) => {
    if (!supported) return false;
    if (watchId.current !== null) return true;
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          timestamp: position.timestamp || Date.now()
        };
        setLocation(next);
        setAccuracy(position.coords.accuracy ?? null);
        if (onUpdate) onUpdate(next);
      },
      () => setError('Live location updates are unavailable. Check device location settings.'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return true;
  }, [supported]);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== 'undefined') navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  useEffect(() => {
    if (auto) capture();
    return stopWatch;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return { location, accuracy, error, loading, supported, capture, startWatch, stopWatch };
}