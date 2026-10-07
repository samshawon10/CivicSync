import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { invalidateUserSockets } from '../realtime/emergencyRealtime.js';

function cookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: isProduction, sameSite: isProduction ? 'none' : 'lax', maxAge: 1000 * 60 * 60 * 2, path: '/' };
}
function tokenFor(user) { return jwt.sign({ userId: user._id, firebaseUid: user.firebaseUid, email: user.email, role: user.role, sessionVersion: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '2h' }); }

export async function exchangeFirebaseIdentity(req, res, next) {
  try {
    const identity = req.firebaseUser;
    let user = await User.findOne({ firebaseUid: identity.uid });
    if (!user) {
      user = await User.findOne({ email: identity.email });
      if (user) {
        if (!identity.emailVerified || (user.firebaseUid && user.firebaseUid !== identity.uid)) {
          return res.status(409).json({ success: false, message: 'This email belongs to an existing account. Sign in with its linked provider or verify the email before linking.' });
        }
        user = await User.findOneAndUpdate(
          { _id: user._id, $or: [{ firebaseUid: identity.uid }, { firebaseUid: null }, { firebaseUid: '' }] },
          { $set: { firebaseUid: identity.uid, photoURL: user.photoURL || identity.picture, emailVerified: true }, $unset: { password: 1 } },
          { new: true, runValidators: true }
        );
        if (!user) return res.status(409).json({ success: false, message: 'The account provider changed. Sign in again with its linked provider.' });
      } else {
        user = await User.findOneAndUpdate(
          { firebaseUid: identity.uid },
          { $setOnInsert: { firebaseUid: identity.uid, name: (identity.name || identity.email.split('@')[0]).trim().slice(0, 80), email: identity.email, photoURL: identity.picture, emailVerified: identity.emailVerified, role: 'citizen' } },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );
      }
    } else {
      user.photoURL = user.photoURL || identity.picture;
      user.emailVerified = identity.emailVerified;
      await user.save();
    }
    if (['suspended', 'disabled'].includes(user.status)) return res.status(403).json({ success: false, message: 'This CivicSync account is suspended.' });
    const token = tokenFor(user);
    return res.cookie('civicsync_token', token, cookieOptions()).json({ success: true, message: 'CivicSync session established.', token, user: user.toSafeObject() });
  } catch (error) {
    const code = typeof error?.code === 'string' || typeof error?.code === 'number' ? String(error.code) : error?.name || 'unknown';
    console.error('Firebase auth diagnostic.', { diagnosticCode: 'FIREBASE_USER_SYNC_ERROR', firebaseErrorCode: /^[a-z0-9/_-]+$/i.test(code) ? code : 'unknown' });
    next(error);
  }
}

export function me(req, res) {
  return res.json({ success: true, user: req.user.toSafeObject() });
}

export async function logout(req, res, next) {
  const { httpOnly, secure, sameSite, path } = cookieOptions();
  res.clearCookie('civicsync_token', { httpOnly, secure, sameSite, path });
  try {
    const bearer = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer && req.cookies?.civicsync_token && req.headers.origin !== (process.env.CLIENT_URL || 'http://localhost:5173')) return res.status(403).json({ success: false, message: 'The request origin is not allowed.' });
    const token = bearer || req.cookies?.civicsync_token;
    let payload;
    try { if (token) payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); } catch { /* Logout is idempotent for expired sessions. */ }
    if (payload?.userId) {
      await User.updateOne({ _id: payload.userId, $or: [{ sessionVersion: payload.sessionVersion || 0 }, ...(payload.sessionVersion ? [] : [{ sessionVersion: { $exists: false } }])] }, { $inc: { sessionVersion: 1 } });
      invalidateUserSockets(payload.userId);
    }
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) { next(error); }
}
