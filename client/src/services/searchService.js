import api from './api.js';

/**
 * Global CivicSearch API surface.
 *
 * One endpoint serves every role: the backend returns only the categories the
 * authenticated role is authorized to search (server/services/civicSearchScope.js).
 * The Super Admin command palette uses the same data through /admin/search,
 * which delegates to the same search service.
 */
export const searchApi = {
  global: (q, params = {}, config = {}) => api.get('/search', { params: { q, ...params }, ...config }),
  suggest: (q, config = {}) => api.get('/search/suggest', { params: { q }, ...config }),
  categories: (config = {}) => api.get('/search/categories', config)
};

export default searchApi;
