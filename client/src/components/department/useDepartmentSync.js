import { useEffect, useRef, useState } from 'react';
import { subscribeToDepartmentEvents } from '../../services/emergencySocket.js';

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
