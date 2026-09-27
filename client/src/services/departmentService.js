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
  createTask: (payload) => api.post('/departments/tasks', payload),
  updateTaskStatus: (id, payload) => api.patch(`/departments/tasks/${id}/status`, payload),
  completeTask: (id, payload) => api.post(`/departments/tasks/${id}/complete`, payload),

  // Operational assignment — Officer only. The server rejects these for every
  // other role, so the UI simply does not offer them above the Officer.
  assignWorker: (taskId, workerId) => api.patch(`/departments/tasks/${taskId}/assign-worker`, { workerId }),
  removeWorker: (taskId, workerId) => api.delete(`/departments/tasks/${taskId}/workers/${workerId}`),
  attachTeam: (taskId, teamId) => api.post(`/departments/tasks/${taskId}/team`, { teamId }),
  detachTeam: (taskId) => api.post(`/departments/tasks/${taskId}/team/detach`),
  transitionTask: (taskId, payload) => api.patch(`/departments/tasks/${taskId}/transition`, payload),
  taskProgress: (taskId, payload) => api.post(`/departments/tasks/${taskId}/progress`, payload),
  taskUpdates: (taskId) => api.get(`/departments/tasks/${taskId}/updates`),

  // Workload & availability
  availableWorkers: (params) => api.get('/departments/workers/available', { params }),
  workerAssignments: (workerId) => api.get(`/departments/workers/${workerId}/assignments`),
  setWorkerAvailability: (workerId, availability) => api.patch(`/departments/workers/${workerId}/availability`, { availability }),
  officerWorkload: () => api.get('/departments/officers/available'),
  departmentWorkload: () => api.get('/departments/department/workload'),

  // Resources
  resources: () => api.get('/departments/resources'),
  createResource: (payload) => api.post('/departments/resources', payload),
  requestResource: (id, payload) => api.post(`/departments/resources/${id}/request`, payload),
  reviewResource: (id, payload) => api.patch(`/departments/resources/${id}/review`, payload)
};

