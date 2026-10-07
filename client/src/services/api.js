import axios from 'axios';
import { confirmAction, showCriticalError, showError, showSuccess } from '../utils/sweetAlert.js';

const configuredApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
export const API_BASE_URL = `${configuredApiUrl.replace(/(?:\/api)+$/i, '')}/api`;
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/i, '');
const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' }, withCredentials: true });
let sessionRefresher = null;
let refreshPromise = null;
export function setSessionRefresher(refresher) { sessionRefresher = refresher; }

export const TOKEN_STORAGE_KEY = 'civicsync_token';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage exceptions
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage exceptions
  }
}

api.interceptors.request.use((config) => {
  const hasAuth = Boolean(
    config.headers?.Authorization
    || config.headers?.authorization
    || (typeof config.headers?.get === 'function' && config.headers.get('Authorization'))
  );

  if (!hasAuth) {
    const token = getAuthToken();
    if (token) {
      if (typeof config.headers?.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }

    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401 && config && !config._sessionRetried && !config.url?.startsWith('/auth/') && sessionRefresher) {
      config._sessionRetried = true;
      try {
        if (!refreshPromise) refreshPromise = Promise.resolve().then(sessionRefresher).finally(() => { refreshPromise = null; });
        await refreshPromise;
        const token = getAuthToken();
        if (!token) throw new Error('Sign in again.');
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      } catch (refreshError) { return Promise.reject(refreshError); }
    }
    // AI requests render their own inline error state, so they opt out of the
    // global blocking modal via `skipGlobalErrorToast`.
    if (!error.config?.skipGlobalErrorToast && (!error.response || error.response.status >= 500)) showCriticalError('CivicSync service unavailable', 'The server could not complete this request. Check your connection or try again shortly.');
    return Promise.reject(error);
  }
);

export function apiMessage(error) { return error.response?.data?.message || 'Something went wrong. Please try again.'; }
export { showSuccess, showError, showCriticalError, confirmAction };
export default api;
