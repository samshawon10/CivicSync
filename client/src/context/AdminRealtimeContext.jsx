import { createContext, useContext, useEffect, useState } from 'react';
import { subscribeToEmergencyEvents } from '../services/emergencySocket.js';

const AdminRealtimeContext = createContext({ live: false, refreshKey: 0 });

/**
 * One Socket.IO subscription for the whole Super Admin shell.
 * Pages consume the shared refresh signal instead of opening their own
 * listeners, which keeps the realtime channel free of duplicate handlers.
 */
export function AdminRealtimeProvider({ children }) {
  const [live, setLive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToEmergencyEvents(
      () => setRefreshKey((value) => value + 1),
      ({ connected }) => setLive(connected)
    );
    return unsubscribe;
  }, []);

  return <AdminRealtimeContext.Provider value={{ live, refreshKey }}>{children}</AdminRealtimeContext.Provider>;
}

export const useAdminRealtime = () => useContext(AdminRealtimeContext);
