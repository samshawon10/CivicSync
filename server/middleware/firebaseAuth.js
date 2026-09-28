import { FirebaseAdminConfigurationError, getFirebaseAdminAuth } from '../config/firebaseAdmin.js';

function safeFirebaseErrorCode(error) {
  const code = typeof error?.code === 'string' ? error.code : error?.name || 'unknown';
  return /^[a-z0-9/_-]+$/i.test(code) ? code : 'unknown';
}

function logDiagnostic(diagnosticCode, firebaseErrorCode = 'unavailable') {
  console.warn('Firebase auth diagnostic.', { diagnosticCode, firebaseErrorCode });
}

function verificationFailure(error) {
  const firebaseErrorCode = safeFirebaseErrorCode(error);
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';

  if (firebaseErrorCode === 'auth/id-token-expired') {
    return { diagnosticCode: 'FIREBASE_TOKEN_EXPIRED', firebaseErrorCode };
  }
  if (/audience|["']aud["']/.test(message)) {
    return {
      diagnosticCode: 'FIREBASE_PROJECT_MISMATCH',
      verificationCode: 'FIREBASE_TOKEN_AUDIENCE_MISMATCH',
      firebaseErrorCode
    };
  }
  if (/issuer|["']iss["']/.test(message)) {
    return {
      diagnosticCode: 'FIREBASE_PROJECT_MISMATCH',
      verificationCode: 'FIREBASE_TOKEN_ISSUER_MISMATCH',
      firebaseErrorCode
    };
  }
  if (/credential|private key|service account|permission denied|insufficient permission/.test(message)
    || /credential|permission/.test(firebaseErrorCode)
    || firebaseErrorCode.startsWith('app/')) {
    return { diagnosticCode: 'FIREBASE_CREDENTIAL_ERROR', firebaseErrorCode };
  }
  return { diagnosticCode: 'FIREBASE_TOKEN_INVALID', firebaseErrorCode };
}

export async function requireFirebaseAuth(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    logDiagnostic('MISSING_AUTH_HEADER');
    return res.status(401).json({ success: false, message: 'Firebase authentication failed.' });
  }

  const match = authorization.match(/^Bearer(?:\s+(.*))?$/i);
  if (!match) {
    logDiagnostic('INVALID_AUTH_HEADER');
    return res.status(401).json({ success: false, message: 'Firebase authentication failed.' });
  }
  if (!match[1]) {
    logDiagnostic('MISSING_FIREBASE_TOKEN');
    return res.status(401).json({ success: false, message: 'Firebase authentication failed.' });
  }

  let firebaseAuth;
  try {
    firebaseAuth = getFirebaseAdminAuth();
  } catch (error) {
    if (!(error instanceof FirebaseAdminConfigurationError)) throw error;
    logDiagnostic(error.diagnosticCode, error.firebaseErrorCode);
    return res.status(503).json({ success: false, message: 'Firebase authentication is temporarily unavailable.' });
  }

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(match[1]);
  } catch (error) {
    const failure = verificationFailure(error);
    logDiagnostic(failure.diagnosticCode, failure.firebaseErrorCode);
    if (failure.verificationCode) logDiagnostic(failure.verificationCode, failure.firebaseErrorCode);
    if (failure.diagnosticCode === 'FIREBASE_CREDENTIAL_ERROR') {
      return res.status(503).json({ success: false, message: 'Firebase authentication is temporarily unavailable.' });
    }
    return res.status(401).json({ success: false, message: 'Firebase authentication failed.' });
  }

  if (!decoded.email) {
    logDiagnostic('FIREBASE_TOKEN_INVALID', 'verified-email-missing');
    return res.status(401).json({ success: false, message: 'Firebase authentication failed.' });
  }
  req.firebaseUser = { uid: decoded.uid, email: decoded.email.toLowerCase(), name: decoded.name || '', picture: decoded.picture || '', emailVerified: Boolean(decoded.email_verified) };
  return next();
}
