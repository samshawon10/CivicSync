import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function getFirebaseAdminAuth() {
  if (!getApps().length) {
    const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? applicationDefault()
      : cert({
          projectId: required('FIREBASE_PROJECT_ID'),
          clientEmail: required('FIREBASE_CLIENT_EMAIL'),
          privateKey: required('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n')
        });
    initializeApp({
      credential
    });
  }
  return getAuth();
}
