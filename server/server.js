import dotenv from 'dotenv';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { connectDatabase } from './config/database.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import userRoutes from './routes/userRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import adminReportRoutes from './routes/adminReportRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import emergencyRoutes, { contactRouter } from './routes/emergencyRoutes.js';
import emergencyServiceRoutes from './routes/emergencyServiceRoutes.js';
import responseTeamRoutes from './routes/responseTeamRoutes.js';
import { initializeRealtime } from './realtime/emergencyRealtime.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(serverDir, '.env') });

const app = express();
const httpServer = http.createServer(app);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(serverDir, 'uploads')));
app.get('/api/health', (req, res) => res.json({ success: true, message: 'CivicSync API is running' }));
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/emergencies', emergencyRoutes);
app.use('/api/emergency-contacts', contactRouter);
app.use('/api/emergency-services', emergencyServiceRoutes);
app.use('/api/response-teams', responseTeamRoutes);
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;
connectDatabase()
  .then(() => { initializeRealtime(httpServer); httpServer.listen(port, () => console.log(`CivicSync API listening on port ${port}`)); })
  .catch((error) => { console.error(`Database connection failed: ${error.message}`); process.exit(1); });
