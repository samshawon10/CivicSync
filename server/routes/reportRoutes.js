import { Router } from 'express';
import { createReport, deleteReport, getReport, listDepartments, listMyReports, reportStats, updateReport } from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { uploadReportMedia } from '../middleware/uploadMiddleware.js';

const router = Router();
router.use(requireAuth, requireRole('citizen'));
router.get('/departments', listDepartments);
router.post('/', uploadReportMedia, createReport);
router.get('/my/stats', reportStats);
router.get('/my', listMyReports);
router.get('/:id', getReport);
router.put('/:id', uploadReportMedia, updateReport);
router.delete('/:id', deleteReport);
export default router;
