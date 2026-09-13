import api from './api.js';

export const departmentApi = {
  dashboard: () => api.get('/departments/dashboard'),
  reports: (params) => api.get('/departments/reports', { params }),
  report: (id) => api.get(`/departments/reports/${id}`),
  staff: () => api.get('/departments/staff'),
  analytics: () => api.get('/departments/analytics'),
  priority: (id, priority, note = '') => api.patch(`/departments/reports/${id}/priority`, { priority, note }),
  assign: (id, payload) => api.patch(`/departments/reports/${id}/assign`, payload),
  status: (id, status, note = '') => api.patch(`/departments/reports/${id}/status`, { status, note }),
  complete: (id, payload) => api.post(`/departments/reports/${id}/completion-report`, payload),
  reviewCompletion: (id, payload) => api.patch(`/departments/reports/${id}/completion-review`, payload)
};
