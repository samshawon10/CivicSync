import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const explicitCredentialNames = ['FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];

export class FirebaseAdminConfigurationError extends Error {
  constructor(diagnosticCode, firebaseErrorCode) {
    super('Firebase Admin could not be initialized.');
    this.name = 'FirebaseAdminConfigurationError';
    this.diagnosticCode = diagnosticCode;
    this.firebaseErrorCode = firebaseErrorCode;
  }
}

function configured(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim().length > 0;
}

function selectedCredentialSource() {
  const hasExplicitCredentials = explicitCredentialNames.every(configured);
  const hasPartialExplicitCredentials = explicitCredentialNames.some(configured);
  if (hasExplicitCredentials || hasPartialExplicitCredentials) return 'explicit-env';
  if (configured('GOOGLE_APPLICATION_CREDENTIALS')) return 'ADC';
  return 'unconfigured';
}

function configurationError(diagnosticCode, firebaseErrorCode) {
  throw new FirebaseAdminConfigurationError(diagnosticCode, firebaseErrorCode);
}

export function getFirebaseAdminAuth() {
  try {
    let app = getApps()[0];
    const projectId = configured('FIREBASE_PROJECT_ID') ? process.env.FIREBASE_PROJECT_ID.trim() : '';
    if (!projectId) configurationError('FIREBASE_ADMIN_NOT_INITIALIZED', 'missing-project-id');

    if (app?.options.projectId && app.options.projectId !== projectId) {
      configurationError('FIREBASE_PROJECT_MISMATCH', 'configured-project-mismatch');
    }

    if (!app) {
      let credential;
      if (explicitCredentialNames.every(configured)) {
        credential = cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        });
      } else if (explicitCredentialNames.some(configured)) {
        configurationError('FIREBASE_CREDENTIAL_ERROR', 'incomplete-explicit-credentials');
      } else if (selectedCredentialSource() === 'ADC') {
        credential = applicationDefault();
      } else {
        configurationError('FIREBASE_ADMIN_NOT_INITIALIZED', 'missing-admin-credentials');
      }

      app = initializeApp({ credential, projectId });
    }
    return getAuth(app);
  } catch (error) {
    if (error instanceof FirebaseAdminConfigurationError) throw error;
    const firebaseErrorCode = typeof error?.code === 'string' ? error.code : error?.name || 'configuration-error';
    throw new FirebaseAdminConfigurationError('FIREBASE_CREDENTIAL_ERROR', firebaseErrorCode);
  }
}

export function logFirebaseAdminStatus() {
  let initialized = false;
  let diagnosticCode;
  let firebaseErrorCode;
  try {
    getFirebaseAdminAuth();
    initialized = true;
  } catch (error) {
    diagnosticCode = error.diagnosticCode || 'FIREBASE_ADMIN_NOT_INITIALIZED';
    firebaseErrorCode = error.firebaseErrorCode || error.name || 'unknown';
  }

  console.info(`Firebase Admin initialized: ${initialized}`);
  console.info(`Firebase project configured: ${configured('FIREBASE_PROJECT_ID')}`);
  console.info(`Firebase client email configured: ${configured('FIREBASE_CLIENT_EMAIL')}`);
  console.info(`Firebase private key configured: ${configured('FIREBASE_PRIVATE_KEY')}`);
  console.info(`Firebase credential source: ${selectedCredentialSource()}`);
  if (!initialized) console.error('Firebase auth diagnostic.', { diagnosticCode, firebaseErrorCode });
}
