import api from './api.js';

export const departmentApi = {
  // Overview & Analytics
  dashboard: () => api.get('/departments/dashboard'),
  reports: (params) => api.get('/departments/reports', { params }),
  report: (id) => api.get(`/departments/reports/${id}`),
  staff: () => api.get('/departments/staff'),
  analytics: () => api.get('/departments/analytics'),
  activity: () => api.get('/departments/activity'),

  // Case Actions
  priority: (id, priority, note = '') => api.patch(`/departments/reports/${id}/priority`, { priority, note }),
  assign: (id, payload) => api.patch(`/departments/reports/${id}/assign`, payload),
  status: (id, status, note = '') => api.patch(`/departments/reports/${id}/status`, { status, note }),
  note: (id, note) => api.post(`/departments/reports/${id}/notes`, { note }),
  message: (id, text, isInternal = true) => api.post(`/departments/reports/${id}/messages`, { text, isInternal }),
  complete: (id, payload) => api.post(`/departments/reports/${id}/completion-report`, payload),
  reviewCompletion: (id, payload) => api.patch(`/departments/reports/${id}/completion-review`, payload),
  teamRecommendations: (id) => api.get(`/departments/reports/${id}/team-recommendations`),
  escalate: (id, reason) => api.post(`/departments/reports/${id}/escalate`, { reason }),
  resolveEscalation: (id, resolutionNote) => api.post(`/departments/reports/${id}/resolve-escalation`, { resolutionNote }),
  handover: (id, payload) => api.post(`/departments/reports/${id}/handover`, payload),

  // Teams
  teams: () => api.get('/departments/teams'),
  createTeam: (payload) => api.post('/departments/teams', payload),
  updateTeam: (id, payload) => api.patch(`/departments/teams/${id}`, payload),

  // Tasks (Field execution)
  tasks: (params) => api.get('/departments/tasks', { params }),
  task: (id) => api.get(`/departments/tasks/${id}`),
  updateTaskStatus: (id, payload) => api.patch(`/departments/tasks/${id}/status`, payload),
  completeTask: (id, payload) => api.post(`/departments/tasks/${id}/complete`, payload),

  // Resources
  resources: () => api.get('/departments/resources'),
  createResource: (payload) => api.post('/departments/resources', payload),
  requestResource: (id, payload) => api.post(`/departments/resources/${id}/request`, payload),
  reviewResource: (id, payload) => api.patch(`/departments/resources/${id}/review`, payload)
};

