import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const explicitCredentialNames = ['FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
let initializationLogged = false;

export class FirebaseAdminConfigurationError extends Error {
  constructor(code) {
    super('Firebase Admin could not be initialized.');
    this.name = 'FirebaseAdminConfigurationError';
    this.code = code;
  }
}

function configurationError(code) {
  const error = new Error('Firebase Admin configuration is incomplete.');
  error.code = code;
  throw error;
}

export function getFirebaseAdminAuth() {
  try {
    let app = getApps()[0];
    if (!app) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      if (!projectId) configurationError('missing-project-id');

      const explicitValues = explicitCredentialNames.map((name) => process.env[name]);
      const hasSomeExplicitCredentials = explicitValues.some(Boolean);
      let credential;
      if (explicitValues.every(Boolean)) {
        credential = cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        });
      } else if (hasSomeExplicitCredentials) {
        configurationError('incomplete-explicit-credentials');
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        credential = applicationDefault();
      } else {
        configurationError('missing-admin-credentials');
      }

      app = initializeApp({ credential, projectId });
    }

    if (!initializationLogged) {
      console.info('Firebase Admin initialized.', {
        initialized: true,
        projectId: app.options.projectId || process.env.FIREBASE_PROJECT_ID || 'unknown'
      });
      initializationLogged = true;
    }
    return getAuth(app);
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : error?.name || 'configuration-error';
    if (!(error instanceof FirebaseAdminConfigurationError)) {
      console.error('Firebase Admin initialization failed.', {
        code,
        projectId: process.env.FIREBASE_PROJECT_ID || 'not-configured'
      });
    }
    if (error instanceof FirebaseAdminConfigurationError) throw error;
    throw new FirebaseAdminConfigurationError(code);
  }
}
