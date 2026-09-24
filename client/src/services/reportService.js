import api from './api.js';

function toReportFormData(payload) {
  const formData = new FormData();
  const { media = [], ...fields } = payload;
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  media.forEach((file) => formData.append('media', file));
  return formData;
}

const multipartConfig = {
  transformRequest: [(data, headers) => {
    headers?.delete?.('Content-Type');
    if (headers) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }
    return data;
  }]
};

export const reportsApi = {
  departments: () => api.get('/reports/departments'),
  create: (payload) => api.post('/reports', toReportFormData(payload), multipartConfig),
  mine: (params) => api.get('/reports/my', { params }),
  stats: () => api.get('/reports/my/stats'),
  get: (id) => api.get(`/reports/${id}`),
  update: (id, payload) => api.put(`/reports/${id}`, toReportFormData(payload), multipartConfig),
  remove: (id) => api.delete(`/reports/${id}`)
};

export function mediaUrl(attachment) {
  if (!attachment?.url) return '';
  if (attachment.url.startsWith('http')) return attachment.url;
  return `${api.defaults.baseURL.replace(/\/api\/?$/, '')}${attachment.url}`;
}
