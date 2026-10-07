import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const bearerToken = bearerMatch ? bearerMatch[1].trim() : null;
    const queryToken = req.method === 'GET' && typeof req.query?.token === 'string' ? req.query.token.trim() : null;
    const token = bearerToken || req.cookies?.civicsync_token || queryToken || null;
    if (!token) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Auth diagnostic [requireAuth]: Missing token', {
          authHeaderAttached: Boolean(authHeader),
          authScheme: authHeader ? authHeader.split(/\s+/)[0] : null,
          tokenLength: bearerToken ? bearerToken.length : 0,
          hasCookie: Boolean(req.cookies?.civicsync_token),
          path: req.originalUrl || req.url
        });
      }
      return res.status(401).json({ success: false, message: 'Authentication is required.' });
    }
    if (!bearerToken && req.cookies?.civicsync_token && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
      && req.headers.origin !== (process.env.CLIENT_URL || 'http://localhost:5173')) {
      return res.status(403).json({ success: false, message: 'The request origin is not allowed.' });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(payload.userId);
    if (!user || user.status !== 'active' || (payload.sessionVersion || 0) !== (user.sessionVersion || 0)) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Auth diagnostic [requireAuth]: User unavailable', {
          userFound: Boolean(user),
          userStatus: user?.status || 'not_found'
        });
      }
      return res.status(401).json({ success: false, message: 'User account is unavailable.' });
    }
    req.user = user;
    next();
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError) && !(error instanceof jwt.TokenExpiredError)) return next(error);
    if (process.env.NODE_ENV !== 'test') {
      const isJwtError = error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError;
      console.warn('Auth diagnostic [requireAuth]: Verification failed', {
        diagnosticCode: error.name === 'TokenExpiredError' ? 'JWT_EXPIRED' : (isJwtError ? 'JWT_INVALID' : 'AUTH_INTERNAL_ERROR'),
        errorName: error.name,
        path: req.originalUrl || req.url
      });
    }
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => allowed.includes(req.user?.role) ? next() : res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
}
