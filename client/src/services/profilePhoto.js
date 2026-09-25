import api from './api.js';

const API_ORIGIN = api.defaults.baseURL.replace(/\/api\/?$/, '');

export function profilePhotoUrl(photoURL) {
  if (!photoURL) return '';
  if (photoURL.startsWith('http')) return photoURL;
  if (photoURL.startsWith('blob:') || photoURL.startsWith('data:')) return photoURL;
  return `${API_ORIGIN}${photoURL.startsWith('/') ? '' : '/'}${photoURL}`;
}
