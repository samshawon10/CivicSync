import { Router } from 'express';
import { createReport, deleteReport, getReport, listMyReports, updateReport } from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { uploadReportMedia } from '../middleware/uploadMiddleware.js';

const router = Router();
router.use(requireAuth, requireRole('citizen'));
router.post('/', uploadReportMedia, createReport);
router.get('/my', listMyReports);
router.get('/:id', getReport);
router.put('/:id', uploadReportMedia, updateReport);
router.delete('/:id', deleteReport);
export default router;
