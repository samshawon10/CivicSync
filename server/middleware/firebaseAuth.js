import { getFirebaseAdminAuth } from '../config/firebaseAdmin.js';

export async function requireFirebaseAuth(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ success: false, message: 'Firebase authentication is required.' });
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    if (!decoded.email) return res.status(401).json({ success: false, message: 'A verified Firebase email address is required.' });
    req.firebaseUser = { uid: decoded.uid, email: decoded.email.toLowerCase(), name: decoded.name || '', picture: decoded.picture || '', emailVerified: Boolean(decoded.email_verified) };
    next();
  } catch (error) {
    if (error.message?.includes('not configured')) return res.status(503).json({ success: false, message: 'Firebase authentication is not configured on the server.' });
    return res.status(401).json({ success: false, message: 'Invalid or expired Firebase token.' });
  }
}

