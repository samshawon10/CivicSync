import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const [scheme, bearerToken] = (req.headers.authorization || '').split(' ');
    const token = req.cookies?.civicsync_token || (scheme === 'Bearer' ? bearerToken : null);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication is required.' });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user || ['suspended', 'disabled'].includes(user.status)) return res.status(401).json({ success: false, message: 'User account is unavailable.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
}
