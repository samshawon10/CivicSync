import { apiMessage } from '../services/api.js';

const firebaseMessages = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed before completion.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
  'auth/network-request-failed': 'Unable to connect to CivicSync. Please try again.'
};

export function authErrorMessage(error) {
  const responseMessage = error?.response?.data?.message;
  if (responseMessage) return responseMessage;

  const firebaseMessage = firebaseMessages[error?.code];
  if (firebaseMessage) return firebaseMessage;

  if (error?.code?.startsWith('auth/')) {
    return 'We could not complete your authentication. Please try again.';
  }

  if (!error?.response || /network|fetch failed/i.test(error?.message || '')) {
    return 'Unable to connect to CivicSync. Please try again.';
  }

  return apiMessage(error);
}
