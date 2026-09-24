import api from './api.js';

export const adminApi = {
  dashboard: (params) => api.get('/admin/dashboard', { params }), analytics: (params) => api.get('/admin/analytics', { params }),
  users: (params) => api.get('/admin/users', { params }), user: (id) => api.get(`/admin/users/${id}`), selectUsers: (q) => api.get('/admin/users/select', { params: { q } }), updateUserRole: (id, payload) => api.patch(`/admin/users/${id}/role`, payload), updateUserStatus: (id, status) => api.patch(`/admin/users/${id}/status`, { status }), deleteUser: (id) => api.delete(`/admin/users/${id}`),
  departments: (params) => api.get('/admin/departments', { params }), department: (id) => api.get(`/admin/departments/${id}`), createDepartment: (payload) => api.post('/admin/departments', payload), updateDepartment: (id, payload) => api.patch(`/admin/departments/${id}`, payload), assignHead: (id, userId) => api.post(`/admin/departments/${id}/head`, { userId }), deleteDepartment: (id) => api.delete(`/admin/departments/${id}`),
  citizenDepartments: () => api.get('/admin/departments/citizen-list'),
  complaints: (params) => api.get('/admin/complaints', { params }), complaint: (id) => api.get(`/admin/complaints/${id}`), updateComplaint: (id, payload) => api.patch(`/admin/complaints/${id}`, payload), deleteComplaint: (id) => api.delete(`/admin/complaints/${id}`),
  emergencies: (params) => api.get('/admin/emergencies', { params }), updateEmergency: (id, payload) => api.patch(`/admin/emergencies/${id}`, payload), logs: (params) => api.get('/admin/activity-logs', { params }), settings: () => api.get('/admin/settings'), updateSettings: (payload) => api.patch('/admin/settings', payload), exportUrl: (type) => `${api.defaults.baseURL}/admin/reports/export?type=${type}`
};
