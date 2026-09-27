import api from './api.js';

export const adminApi = {
  // Overview, governance and intelligence
  dashboard: (params) => api.get('/admin/dashboard', { params }),
  analytics: (params) => api.get('/admin/analytics', { params }),
  governance: (params) => api.get('/admin/governance', { params }),
  operationsAnalytics: (params) => api.get('/admin/analytics/operations', { params }),
  systemHealth: (refreshMap = false) => api.get('/admin/system-health', { params: refreshMap ? { refresh: 'true' } : undefined }),
  mapTileHealth: (refresh = false) => api.get('/admin/system-health/map-tiles', { params: refresh ? { refresh: 'true' } : undefined }),
  permissions: () => api.get('/admin/permissions'),
  search: (q, config) => api.get('/admin/search', { params: { q }, ...config }),
  categoryGovernance: () => api.get('/admin/governance/categories'),

  // Users
  profile: () => api.get('/users/me'),
  updateProfile: (payload) => api.patch('/users/me', payload),
  uploadProfilePhoto: (file, onProgress) => { const form = new FormData(); form.append('photo', file); return api.post('/users/me/photo', form, { headers: { 'Content-Type': 'multipart/form-data' }, onUploadProgress: (event) => { if (onProgress && event.total) onProgress(Math.round((event.loaded * 100) / event.total)); } }); },
  removeProfilePhoto: () => api.patch('/users/me', { photoURL: '' }),
  users: (params) => api.get('/admin/users', { params }),
  user: (id) => api.get(`/admin/users/${id}`),
  selectUsers: (q) => api.get('/admin/users/select', { params: { q } }),
  updateUserRole: (id, payload) => api.patch(`/admin/users/${id}/role`, payload),
  updateUserStatus: (id, status) => api.patch(`/admin/users/${id}/status`, { status }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),

  // Departments
  departments: (params) => api.get('/admin/departments', { params }),
  department: (id) => api.get(`/admin/departments/${id}`),
  createDepartment: (payload) => api.post('/admin/departments', payload),
  updateDepartment: (id, payload) => api.patch(`/admin/departments/${id}`, payload),
  toggleDepartmentStatus: (id, status) => api.patch(`/admin/departments/${id}/status`, { status }),
  assignHead: (id, userId) => api.post(`/admin/departments/${id}/head`, { userId }),
  assignEmergencyHead: (id, userId) => api.post(`/admin/departments/${id}/emergency-head`, { userId }),
  // Clearing a leadership slot reuses the assign endpoints with a null userId.
  removeHead: (id) => api.post(`/admin/departments/${id}/head`, { userId: null }),
  removeEmergencyHead: (id) => api.post(`/admin/departments/${id}/emergency-head`, { userId: null }),
  updateEmergencyRouting: (id, payload) => api.patch(`/admin/departments/${id}/emergency-routing`, payload),
  deleteDepartment: (id, force = false) => api.delete(`/admin/departments/${id}${force ? '?force=true' : ''}`),
  citizenDepartments: () => api.get('/admin/departments/citizen-list'),
  assignableRoles: () => api.get('/admin/departments/assignable-roles'),

  // Report categories (the citizen-facing complaint catalogue)
  reportCategories: () => api.get('/admin/report-categories'),
  createReportCategory: (payload) => api.post('/admin/report-categories', payload),
  updateReportCategory: (id, payload) => api.patch(`/admin/report-categories/${id}`, payload),
  deleteReportCategory: (id) => api.delete(`/admin/report-categories/${id}`),
  restoreReportCategories: () => api.post('/admin/report-categories/restore-defaults'),

  // Complaints
  complaints: (params) => api.get('/admin/complaints', { params }),
  complaint: (id) => api.get(`/admin/complaints/${id}`),
  updateComplaint: (id, payload) => api.patch(`/admin/complaints/${id}`, payload),
  deleteComplaint: (id) => api.delete(`/admin/complaints/${id}`),

  // Emergency oversight
  emergencies: (params) => api.get('/admin/emergencies', { params }),
  emergency: (id) => api.get(`/admin/emergencies/${id}`),
  updateEmergency: (id, payload) => api.patch(`/admin/emergencies/${id}`, payload),

  // Audit trail, export and configuration
  logs: (params) => api.get('/admin/activity-logs', { params }),
  settings: () => api.get('/admin/settings'),
  updateSettings: (payload) => api.patch('/admin/settings', payload),
  exportUrl: (type) => `${api.defaults.baseURL}/admin/reports/export?type=${type}`
};

export default adminApi;
