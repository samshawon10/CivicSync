import { Router } from 'express';
import { listNotifications, markAllRead, markRead } from '../controllers/notificationController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
const router = Router();
router.use(requireAuth, requireRole('citizen', 'department_head', 'department_officer', 'field_worker', 'admin'));
router.get('/', listNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
export default router;
