import { FirebaseAdminConfigurationError, getFirebaseAdminAuth } from '../config/firebaseAdmin.js';

function safeFirebaseErrorCode(error) {
  return typeof error?.code === 'string' ? error.code : error?.name || 'unknown';
}

export async function requireFirebaseAuth(req, res, next) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) return res.status(401).json({ success: false, message: 'A Firebase bearer token is required.' });

  let firebaseAuth;
  try {
    firebaseAuth = getFirebaseAdminAuth();
  } catch (error) {
    if (!(error instanceof FirebaseAdminConfigurationError)) throw error;
    return res.status(503).json({ success: false, message: 'Firebase authentication is not configured on the server.' });
  }

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(match[1]);
  } catch (error) {
    const expired = error?.code === 'auth/id-token-expired';
    console.warn('Firebase token verification failed.', {
      reason: expired ? 'expired' : 'invalid',
      code: safeFirebaseErrorCode(error),
      projectId: process.env.FIREBASE_PROJECT_ID || 'not-configured'
    });
    return res.status(401).json({
      success: false,
      message: expired ? 'Firebase token has expired. Please sign in again.' : 'Firebase token is invalid.'
    });
  }

  if (!decoded.email) return res.status(401).json({ success: false, message: 'A verified Firebase email address is required.' });
  req.firebaseUser = { uid: decoded.uid, email: decoded.email.toLowerCase(), name: decoded.name || '', picture: decoded.picture || '', emailVerified: Boolean(decoded.email_verified) };
  return next();
}
