import api from './api.js';

export const emergencyApi = {
  types: () => api.get('/emergencies/types'),
  dashboard: () => api.get('/emergencies/dashboard'),
  list: (params) => api.get('/emergencies', { params }),
  get: (id) => api.get(`/emergencies/${id}`),
  similar: (id) => api.get(`/emergencies/${id}/similar`),
  merge: (id, emergencyIds) => api.post(`/emergencies/${id}/merge`, { emergencyIds }),
  create: (payload) => api.post('/emergencies', payload),
  classify: (payload) => api.post('/emergencies/classify', payload),
  assignableResponders: () => api.get('/emergencies/assignable-responders'),
  update: (id, payload) => api.patch(`/emergencies/${id}`, payload),
  uploadEvidence: (id, files, onProgress) => {
    const form = new FormData();
    [...files].forEach((file) => form.append('evidence', file));
    return api.post(`/emergencies/${id}/evidence`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => { if (onProgress && event.total) onProgress(Math.round((event.loaded * 100) / event.total)); }
    });
  },
  updateResponderLocation: (id, location) => api.patch(`/emergencies/${id}/responder-location`, location),
  responderPositions: (id) => api.get(`/emergencies/${id}/responder-positions`),
  responderLocations: () => api.get('/emergencies/responder-locations'),
  nearbyResponders: (id) => api.get(`/emergencies/${id}/responders`),
  assign: (id, payload) => api.post(`/emergencies/${id}/assign`, payload),
  assignmentStatus: (id, assignmentId, payload) => api.patch(`/emergencies/${id}/assignments/${assignmentId}/status`, payload),
  addWorkers: (id, assignmentId, fieldWorkerIds) => api.post(`/emergencies/${id}/assignments/${assignmentId}/workers`, { fieldWorkerIds }),
  verify: (id, payload) => api.post(`/emergencies/${id}/verify`, payload),
  status: (id, status, note = '') => api.patch(`/emergencies/${id}/status`, { status, note }),
  escalate: (id, reason) => api.post(`/emergencies/${id}/escalate`, { reason }),
  backup: (id, reason) => api.post(`/emergencies/${id}/backup`, { reason }),
  map: (params) => api.get('/emergencies/map', { params }),
  hotspots: (params) => api.get('/emergencies/hotspots', { params }),
  safetyIntelligence: (params) => api.get('/emergencies/safety-intelligence', { params }),
  analytics: () => api.get('/emergencies/analytics'),
  alerts: (params) => api.get('/emergencies/alerts', { params }),
  createAlert: (payload) => api.post('/emergencies/alerts', payload),
  updateAlert: (id, payload) => api.patch(`/emergencies/alerts/${id}`, payload),
  deleteAlert: (id) => api.delete(`/emergencies/alerts/${id}`),
  manageTypes: () => api.get('/emergencies/categories/manage'),
  createType: (payload) => api.post('/emergencies/categories', payload),
  deleteType: (id) => api.delete(`/emergencies/categories/${id}`),
  updateType: (id, payload) => api.patch(`/emergencies/categories/${id}`, payload),
  contacts: () => api.get('/emergency-contacts'),
  createContact: (payload) => api.post('/emergency-contacts', payload),
  updateContact: (id, payload) => api.patch(`/emergency-contacts/${id}`, payload),
  deleteContact: (id) => api.delete(`/emergency-contacts/${id}`)
};

export const facilityGroups = [
  { key: 'emergency', label: 'Emergency', types: ['emergency_center', 'ambulance', 'fire_station'] },
  { key: 'safety', label: 'Safety', types: ['police', 'safe_point', 'shelter', 'flood_shelter', 'hazard', 'road_blockage'] },
  { key: 'healthcare', label: 'Healthcare', types: ['hospital', 'pharmacy', 'clinic', 'first_aid_center'] },
  { key: 'community', label: 'Civic / Community', types: ['mosque', 'school', 'government_office', 'help_center', 'safe_water_point', 'public_toilet'] }
];

export const facilityTypeLabels = {
  emergency_center: 'Emergency Center', ambulance: 'Ambulance', fire_station: 'Fire Station', police: 'Police Station', safe_point: 'Safe Point', shelter: 'Emergency Shelter', flood_shelter: 'Flood Shelter', hazard: 'Hazard / Dangerous Area', road_blockage: 'Road Blockage', hospital: 'Hospital', pharmacy: 'Pharmacy', clinic: 'Clinic', first_aid_center: 'First Aid Center', mosque: 'Mosque', school: 'School', government_office: 'Government Office', help_center: 'Help Center', safe_water_point: 'Safe Water Point', public_toilet: 'Public Toilet'
};

export const facilityTypes = Object.keys(facilityTypeLabels);
export const nearestHelpTypes = ['police', 'ambulance', 'hospital', 'fire_station', 'safe_point', 'shelter', 'pharmacy'];

export const facilitiesApi = {
  catalog: () => api.get('/emergency-services/catalog'),
  list: (params) => api.get('/emergency-services', { params }),
  nearby: (params) => api.get('/emergency-services/nearby', { params: { ...params, ...(Array.isArray(params?.types) ? { types: params.types.join(',') } : {}) } }),
  create: (payload) => api.post('/emergency-services', payload),
  update: (id, payload) => api.patch(`/emergency-services/${id}`, payload),
  remove: (id) => api.delete(`/emergency-services/${id}`)
};

export const responseTeamsApi = {
  list: (params) => api.get('/response-teams', { params }),
  create: (payload) => api.post('/response-teams', payload),
  update: (id, payload) => api.patch(`/response-teams/${id}`, payload),
  remove: (id) => api.delete(`/response-teams/${id}`)
};

export function directionsUrl(destination, origin) {
  if (!destination || !Number.isFinite(Number(destination.latitude)) || !Number.isFinite(Number(destination.longitude))) return '';
  const to = `${Number(destination.latitude).toFixed(6)},${Number(destination.longitude).toFixed(6)}`;
  const params = new URLSearchParams({ engine: 'fossgis_osrm_car', to });
  if (origin && Number.isFinite(Number(origin.latitude)) && Number.isFinite(Number(origin.longitude))) {
    params.set('from', `${Number(origin.latitude).toFixed(6)},${Number(origin.longitude).toFixed(6)}`);
  }
  return `https://www.openstreetmap.org/directions?${params.toString()}`;
}

export const label = (value = '') => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function mediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${api.defaults.baseURL.replace(/\/api\/?$/, '')}${url}`;
}

/** Haversine distance in km (client-side display only). */
export function distanceKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(Number(value)))) return null;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
