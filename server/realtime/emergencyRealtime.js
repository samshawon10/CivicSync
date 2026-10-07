import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import User from '../models/User.js';

let io;

export function initializeRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true } });
  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie || '';
      const authHeader = socket.handshake.headers?.authorization || '';
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      const rawToken = socket.handshake.auth?.token
        || (bearerMatch ? bearerMatch[1].trim() : null)
        || cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('civicsync_token='))?.split('=')[1];
      if (!rawToken) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('Realtime auth diagnostic: Missing token', {
            hasAuthToken: Boolean(socket.handshake.auth?.token),
            hasAuthHeader: Boolean(authHeader),
            hasCookie: Boolean(cookie)
          });
        }
        return next(new Error('Authentication is required.'));
      }
      if (!socket.handshake.auth?.token && !bearerMatch && socket.handshake.headers.origin !== (process.env.CLIENT_URL || 'http://localhost:5173')) return next(new Error('The request origin is not allowed.'));
      const token = typeof rawToken === 'string' ? decodeURIComponent(rawToken.trim().replace(/^["']|["']$/g, '')) : '';
      const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const user = await User.findById(payload.userId).select('_id role status departmentName sessionVersion');
      if (!user || user.status !== 'active' || (payload.sessionVersion || 0) !== (user.sessionVersion || 0)) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('Realtime auth diagnostic: User unavailable', { userFound: Boolean(user), status: user?.status });
        }
        return next(new Error('Account is unavailable.'));
      }
      socket.user = user;
      socket.tokenExpiresAt = payload.exp * 1000;
      return next();
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Realtime auth diagnostic: Verification failed', { errorName: err?.name });
      }
      return next(new Error('Invalid authentication.'));
    }
  });
  io.on('connection', (socket) => {
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, socket.tokenExpiresAt - Date.now()));
    expiry.unref?.();
    socket.once('disconnect', () => clearTimeout(expiry));
    socket.join(`user:${socket.user._id}`);
    socket.join(`role:${socket.user.role}`);
    if (socket.user.departmentName && ['department_head', 'department_officer', 'officer', 'field_worker'].includes(socket.user.role)) {
      socket.join(`dept:${socket.user.departmentName}`);
    }
  });
  return io;
}

export function invalidateUserSockets(userId) {
  if (!io || !userId) return;
  const room = `user:${userId}`;
  io.to(room).emit('SESSION_INVALIDATED');
  io.in(room).disconnectSockets(true);
}

export function emitEmergencyEvent(event, payload, { userIds = [], roles = [] } = {}) {
  if (!io) return;
  const normalizeId = (value) => value?._id || value;
  const rooms = [...userIds.map(normalizeId).filter(Boolean).map((id) => `user:${id}`), ...roles.filter(Boolean).map((role) => `role:${role}`)];
  if (rooms.length) io.to([...new Set(rooms)]).emit(event, payload);
}

export function emitDepartmentEvent(event, payload, { userIds = [], roles = [], department = '' } = {}) {
  if (!io) return;
  const normalizeId = (value) => value?._id || value;
  const rooms = [...userIds.map(normalizeId).filter(Boolean).map((id) => `user:${id}`), ...roles.filter(Boolean).map((role) => `role:${role}`), ...(department ? [`dept:${department}`] : [])];
  if (rooms.length) io.to([...new Set(rooms)]).emit(event, payload);
}

export function realtimeStatus() {
  if (!io) return { initialized: false, connections: null, rooms: null };
  const sockets = io.sockets?.sockets;
  return {
    initialized: true,
    connections: sockets?.size ?? 0,
    rooms: io.sockets?.adapter?.rooms?.size ?? null
  };
}

