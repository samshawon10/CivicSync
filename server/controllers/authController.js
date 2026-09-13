import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const isProduction = process.env.NODE_ENV === 'production';
function cookieOptions() { return { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 2, path: '/' }; }
function tokenFor(user) { return jwt.sign({ userId: user._id, firebaseUid: user.firebaseUid, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' }); }

export async function exchangeFirebaseIdentity(req, res, next) {
  try {
    const identity = req.firebaseUser;
    let user = await User.findOne({ firebaseUid: identity.uid });
    if (!user) {
      user = await User.findOne({ email: identity.email });
      if (user) {
        user.firebaseUid = identity.uid;
        user.name = identity.name || user.name;
        user.photoURL = identity.picture || user.photoURL;
        user.emailVerified = identity.emailVerified;
        await user.save();
        await User.updateOne({ _id: user._id }, { $unset: { password: 1 } });
      } else {
        user = await User.create({ firebaseUid: identity.uid, name: identity.name || identity.email.split('@')[0], email: identity.email, photoURL: identity.picture, emailVerified: identity.emailVerified });
      }
    } else {
      user.name = identity.name || user.name;
      user.photoURL = identity.picture || user.photoURL;
      user.emailVerified = identity.emailVerified;
      await user.save();
    }
    if (['suspended', 'disabled'].includes(user.status)) return res.status(403).json({ success: false, message: 'This CivicSync account is suspended.' });
    return res.cookie('civicsync_token', tokenFor(user), cookieOptions()).json({ success: true, message: 'CivicSync session established.', user: user.toSafeObject() });
  } catch (error) { next(error); }
}

export function me(req, res) {
  return res.json({ success: true, user: req.user.toSafeObject() });
}

export function logout(req, res) {
  return res.clearCookie('civicsync_token', { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' }).json({ success: true, message: 'Logged out successfully.' });
}
