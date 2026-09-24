import { io } from 'socket.io-client';

let socket;
export function emergencySocket() {
  if (!socket) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    socket = io(apiUrl.replace(/\/api\/?$/, ''), { withCredentials: true, autoConnect: false });
  }
  return socket;
}

const events = [
  'EMERGENCY_CREATED', 'EMERGENCY_RECEIVED', 'EMERGENCY_ASSIGNED', 'OFFICER_ACCEPTED',
  'FIELD_WORKER_ASSIGNED', 'RESPONDER_LOCATION_UPDATED', 'EMERGENCY_STATUS_CHANGED',
  'EMERGENCY_ESCALATED', 'BACKUP_REQUESTED', 'EMERGENCY_RESOLVED', 'EMERGENCY_ALERT_CREATED'
];

/**
 * Subscribe to all emergency real-time events.
 * onChange(payload) fires on any event; onConnection({ connected }) reports
 * socket connect/disconnect so screens can show a live/reconnecting state.
 */
export function subscribeToEmergencyEvents(onChange, onConnection) {
  const client = emergencySocket();
  for (const event of events) client.on(event, onChange);
  const onConnect = () => onConnection?.({ connected: true });
  const onDisconnect = () => onConnection?.({ connected: false });
  if (onConnection) {
    client.on('connect', onConnect);
    client.on('disconnect', onDisconnect);
  }
  client.connect();
  if (onConnection && client.connected) onConnection({ connected: true });
  return () => {
    for (const event of events) client.off(event, onChange);
    if (onConnection) {
      client.off('connect', onConnect);
      client.off('disconnect', onDisconnect);
    }
  };
}
