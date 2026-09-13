import api from './api.js';
export const notificationsApi = { list: () => api.get('/notifications'), read: (id) => api.patch(`/notifications/${id}/read`), readAll: () => api.patch('/notifications/read-all') };
