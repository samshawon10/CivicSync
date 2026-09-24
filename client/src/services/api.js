import axios from 'axios';
import { confirmAction, showCriticalError, showError, showSuccess } from '../utils/sweetAlert.js';


const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', headers: { 'Content-Type': 'application/json' }, withCredentials: true });

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response || error.response.status >= 500) showCriticalError('CivicSync service unavailable', 'The server could not complete this request. Check your connection or try again shortly.');
    return Promise.reject(error);
  }
);

export function apiMessage(error) { return error.response?.data?.message || 'Something went wrong. Please try again.'; }
export { showSuccess, showError, showCriticalError, confirmAction };
export default api;
