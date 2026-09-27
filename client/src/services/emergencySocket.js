import { io } from 'socket.io-client';

let socket;
export function emergencySocket() {
  if (!socket) {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    socket = io(apiUrl.replace(/\/api\/?$/, ''), { withCredentials: true, autoConnect: false });
  }
  return socket;
}

/** Department Operations lifecycle events (unified case → team → task workflow). */
export const departmentEvents = [
  'CASE_ASSIGNED', 'CASE_ESCALATED', 'CASE_MESSAGE_ADDED', 'TASK_STATUS_CHANGED',
  'TASK_COMPLETED', 'TEAM_ASSIGNMENT_CREATED', 'RESOURCE_REQUESTED', 'RESOURCE_APPROVED'
];

export const departmentCatalogueEvents = [
  'DEPARTMENT_CREATED',
  'DEPARTMENT_UPDATED',
  'DEPARTMENT_STATUS_CHANGED',
  'DEPARTMENT_DELETED'
];

export const reportCategoryEvents = [
  'REPORT_CATEGORY_CREATED',
  'REPORT_CATEGORY_UPDATED',
  'REPORT_CATEGORY_DELETED',
  'REPORT_CATEGORY_RESTORED'
];

const events = [
  'EMERGENCY_CREATED', 'EMERGENCY_RECEIVED', 'EMERGENCY_ASSIGNED', 'OFFICER_ACCEPTED',
  'FIELD_WORKER_ASSIGNED', 'RESPONDER_LOCATION_UPDATED', 'EMERGENCY_STATUS_CHANGED',
  'EMERGENCY_ESCALATED', 'BACKUP_REQUESTED', 'EMERGENCY_RESOLVED', 'EMERGENCY_ALERT_CREATED',
  'COMMUNITY_POST_CREATED', 'COMMUNITY_POST_UPDATED', 'COMMUNITY_POST_DELETED',
  'COMMUNITY_COMMENT_CREATED', 'COMMUNITY_COMMENT_UPDATED', 'COMMUNITY_COMMENT_DELETED',
  'COMMUNITY_REACTION_UPDATED', 'COMMUNITY_NOTIFICATION_CREATED', 'COMMUNITY_MODERATION_UPDATED',
  // Department Operations events
  ...departmentEvents,
  // Department catalogue events
  ...departmentCatalogueEvents,
  // Report category catalogue events
  ...reportCategoryEvents,
  'emergencyCreated', 'emergencyAssigned', 'emergencyPriorityChanged', 'emergencyEscalated',
  'emergencyOfficerAssigned', 'emergencyTeamCreated', 'emergencyWorkerAssigned',
  'emergencyStarted', 'emergencyProgressUpdated', 'emergencyBlocked',
  'emergencyResponseCompleted', 'emergencyClosed', 'emergencyWorkerReleased',
  'emergencyNotificationCreated', 'EMERGENCY_OPS_UPDATED'
];

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

export function subscribeToDepartmentEvents(onEvent, onConnection) {
  const client = emergencySocket();
  const handlers = departmentEvents.map((event) => {
    const handler = (payload) => onEvent?.(event, payload);
    client.on(event, handler);
    return [event, handler];
  });
  const onConnect = () => onConnection?.({ connected: true });
  const onDisconnect = () => onConnection?.({ connected: false });
  if (onConnection) {
    client.on('connect', onConnect);
    client.on('disconnect', onDisconnect);
  }
  client.connect();
  if (onConnection && client.connected) onConnection({ connected: true });
  return () => {
    for (const [event, handler] of handlers) client.off(event, handler);
    if (onConnection) {
      client.off('connect', onConnect);
      client.off('disconnect', onDisconnect);
    }
  };
}

export function subscribeToDepartmentCatalogue(onCatalogueChange, onConnection) {
  const client = emergencySocket();
  const handler = () => onCatalogueChange?.();
  for (const event of departmentCatalogueEvents) client.on(event, handler);
  const onConnect = () => onConnection?.({ connected: true });
  const onDisconnect = () => onConnection?.({ connected: false });
  if (onConnection) {
    client.on('connect', onConnect);
    client.on('disconnect', onDisconnect);
  }
  client.connect();
  if (onConnection && client.connected) onConnection({ connected: true });
  return () => {
    for (const event of departmentCatalogueEvents) client.off(event, handler);
    if (onConnection) {
      client.off('connect', onConnect);
      client.off('disconnect', onDisconnect);
    }
  };
}

export function subscribeToReportCategories(onCatalogueChange, onConnection) {
  const client = emergencySocket();
  const handlers = reportCategoryEvents.map((event) => {
    const handler = () => onCatalogueChange?.(event);
    client.on(event, handler);
    return [event, handler];
  });
  const onConnect = () => onConnection?.({ connected: true });
  const onDisconnect = () => onConnection?.({ connected: false });
  if (onConnection) {
    client.on('connect', onConnect);
    client.on('disconnect', onDisconnect);
  }
  client.connect();
  if (onConnection && client.connected) onConnection({ connected: true });
  return () => {
    for (const [event, handler] of handlers) client.off(event, handler);
    if (onConnection) {
      client.off('connect', onConnect);
      client.off('disconnect', onDisconnect);
    }
  };
}
