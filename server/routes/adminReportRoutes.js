import { Router } from 'express';
import { listAllReports, updateReportStatus } from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));
router.get('/', listAllReports);
router.patch('/:id/status', updateReportStatus);
export default router;

