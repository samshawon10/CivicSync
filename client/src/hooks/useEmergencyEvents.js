import { useEffect, useState } from 'react';
import { subscribeToEmergencyEvents } from '../services/emergencySocket.js';

/**
 * Subscribes to emergency socket events and browser connectivity.
 * Returns { online, live, refreshKey } — refreshKey changes whenever an
 * emergency event arrives so callers can reload their data.
 */
export default function useEmergencyEvents(onEvent) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [live, setLive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const unsubscribe = subscribeToEmergencyEvents(
      (payload) => { setRefreshKey((value) => value + 1); if (onEvent) onEvent(payload); },
      ({ connected }) => setLive(connected)
    );
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { online, live, refreshKey };
}