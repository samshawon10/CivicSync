import api from './api.js';

export const searchApi = {
  global: (q, params = {}, config = {}) => api.get('/search', { params: { q, ...params }, ...config }),
  suggest: (q, config = {}) => api.get('/search/suggest', { params: { q }, ...config }),
  categories: (config = {}) => api.get('/search/categories', config)
};

export default searchApi;
