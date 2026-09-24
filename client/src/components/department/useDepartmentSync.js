import { useEffect, useRef, useState } from 'react';
import { subscribeToDepartmentEvents } from '../../services/emergencySocket.js';

/**
 * Subscribes a department Operations screen to live department events and
 * debounces the refresh callback so bursts of events cause one reload.
 * Returns the live/reconnecting socket state for status badges.
 */
export default function useDepartmentSync(onSync, { enabled = true } = {}) {
  const handler = useRef(onSync);
  handler.current = onSync;
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let timer;
    const unsubscribe = subscribeToDepartmentEvents(
      () => {
        clearTimeout(timer);
        timer = setTimeout(() => handler.current?.(), 600);
      },
      ({ connected }) => setLive(connected)
    );
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [enabled]);

  return live;
}
