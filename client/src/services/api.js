import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', headers: { 'Content-Type': 'application/json' }, withCredentials: true });
export function apiMessage(error) { return error.response?.data?.message || 'Something went wrong. Please try again.'; }
export default api;
