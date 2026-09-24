import { Router } from 'express';
import { addReportNote, analytics, assignReport, dashboard, departmentActivity, getReport, listReports, listStaff, reviewCompletion, submitCompletion, updatePriority, updateStatus } from '../controllers/departmentController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth, requireRole('department_head', 'department_officer', 'officer', 'field_worker'));
router.get('/dashboard', dashboard);
router.get('/analytics', analytics);
router.get('/activity', departmentActivity);
router.get('/staff', listStaff);
router.get('/reports', listReports);
router.get('/reports/:id', getReport);
router.post('/reports/:id/notes', addReportNote);
router.patch('/reports/:id/priority', updatePriority);
router.patch('/reports/:id/assign', assignReport);
router.patch('/reports/:id/status', updateStatus);
router.post('/reports/:id/completion-report', submitCompletion);
router.patch('/reports/:id/completion-review', reviewCompletion);

export default router;
