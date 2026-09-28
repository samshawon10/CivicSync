import axios from 'axios';
import { confirmAction, showCriticalError, showError, showSuccess } from '../utils/sweetAlert.js';

const configuredApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
export const API_BASE_URL = `${configuredApiUrl.replace(/(?:\/api)+$/i, '')}/api`;
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/i, '');
const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' }, withCredentials: true });

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // AI requests render their own inline error state, so they opt out of the
    // global blocking modal via `skipGlobalErrorToast`.
    if (!error.config?.skipGlobalErrorToast && (!error.response || error.response.status >= 500)) showCriticalError('CivicSync service unavailable', 'The server could not complete this request. Check your connection or try again shortly.');
    return Promise.reject(error);
  }
);

export function apiMessage(error) { return error.response?.data?.message || 'Something went wrong. Please try again.'; }
export { showSuccess, showError, showCriticalError, confirmAction };
export default api;
