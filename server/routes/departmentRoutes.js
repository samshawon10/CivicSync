import { Router } from 'express';
import {
  addCaseMessage,
  addReportNote,
  analytics,
  assignReport,
  completeTask,
  createResource,
  createTeam,
  dashboard,
  departmentActivity,
  escalateCase,
  getReport,
  getTask,
  handoverCase,
  listReports,
  listResources,
  listStaff,
  listTasks,
  listTeams,
  recommendTeams,
  requestResource,
  resolveEscalation,
  reviewCompletion,
  reviewResourceRequest,
  submitCompletion,
  updatePriority,
  updateStatus,
  updateTaskStatus,
  updateTeam
} from '../controllers/departmentController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth, requireRole('department_head', 'department_officer', 'officer', 'field_worker'));

// Core Department Dashboard & Governance
router.get('/dashboard', dashboard);
router.get('/analytics', analytics);
router.get('/activity', departmentActivity);
router.get('/staff', listStaff);

// Case Operations
router.get('/reports', listReports);
router.get('/reports/:id', getReport);
router.post('/reports/:id/notes', addReportNote);
router.post('/reports/:id/messages', addCaseMessage);
router.patch('/reports/:id/priority', updatePriority);
router.patch('/reports/:id/assign', assignReport);
router.patch('/reports/:id/status', updateStatus);
router.post('/reports/:id/completion-report', submitCompletion);
router.patch('/reports/:id/completion-review', reviewCompletion);
router.get('/reports/:id/team-recommendations', recommendTeams);
router.post('/reports/:id/escalate', escalateCase);
router.post('/reports/:id/resolve-escalation', resolveEscalation);
router.post('/reports/:id/handover', handoverCase);

// Teams
router.get('/teams', listTeams);
router.post('/teams', createTeam);
router.patch('/teams/:id', updateTeam);

// Tasks (Field Execution)
router.get('/tasks', listTasks);
router.get('/tasks/:id', getTask);
router.patch('/tasks/:id/status', updateTaskStatus);
router.post('/tasks/:id/complete', completeTask);

// Resources
router.get('/resources', listResources);
router.post('/resources', createResource);
router.post('/resources/:id/request', requestResource);
router.patch('/resources/:id/review', reviewResourceRequest);

export default router;
