import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import User from '../models/User.js';

let io;

export function initializeRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true } });
  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie || '';
      const token = socket.handshake.auth?.token || cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('civicsync_token='))?.split('=')[1];
      if (!token) return next(new Error('Authentication is required.'));
      const payload = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET);
      const user = await User.findById(payload.userId).select('_id role status departmentName');
      if (!user || user.status !== 'active') return next(new Error('Account is unavailable.'));
      socket.user = user;
      return next();
    } catch { return next(new Error('Invalid authentication.')); }
  });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.user._id}`);
    socket.join(`role:${socket.user.role}`);
    if (socket.user.departmentName) {
      socket.join(`dept:${socket.user.departmentName}`);
    }
  });
  return io;
}

export function emitEmergencyEvent(event, payload, { userIds = [], roles = [] } = {}) {
  if (!io) return;
  const normalizeId = (value) => value?._id || value;
  for (const userId of userIds.map(normalizeId).filter(Boolean)) io.to(`user:${userId}`).emit(event, payload);
  for (const role of roles.filter(Boolean)) io.to(`role:${role}`).emit(event, payload);
}

export function emitDepartmentEvent(event, payload, { userIds = [], roles = [], department = '' } = {}) {
  if (!io) return;
  const normalizeId = (value) => value?._id || value;
  for (const userId of userIds.map(normalizeId).filter(Boolean)) io.to(`user:${userId}`).emit(event, payload);
  for (const role of roles.filter(Boolean)) io.to(`role:${role}`).emit(event, payload);
  if (department) io.to(`dept:${department}`).emit(event, payload);
}

/**
 * Real Socket.IO status for the Super Admin system-health card.
 * Reports only what the server can actually observe — never a fabricated
 * "connected" state.
 */
export function realtimeStatus() {
  if (!io) return { initialized: false, connections: null, rooms: null };
  const sockets = io.sockets?.sockets;
  return {
    initialized: true,
    connections: sockets?.size ?? 0,
    rooms: io.sockets?.adapter?.rooms?.size ?? null
  };
}

