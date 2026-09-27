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
import {
  assignTeamToTask,
  assignWorkerToTask,
  availableWorkers,
  createTask,
  departmentWorkload,
  detachTeamFromTask,
  listTaskUpdates,
  officerWorkload,
  removeWorkerFromTask,
  setWorkerAvailability,
  submitTaskProgress,
  transitionTask,
  workerAssignments
} from '../controllers/operationsController.js';

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
router.post('/tasks', createTask);
router.get('/tasks/:id', getTask);
router.patch('/tasks/:id/status', updateTaskStatus);
router.post('/tasks/:id/complete', completeTask);

// Operational assignment (Officer owns the task; only they may staff it)
router.patch('/tasks/:id/assign-worker', assignWorkerToTask);
router.delete('/tasks/:id/workers/:workerId', removeWorkerFromTask);
router.post('/tasks/:id/team', assignTeamToTask);
router.post('/tasks/:id/team/detach', detachTeamFromTask);
router.patch('/tasks/:id/transition', transitionTask);

// Field progress, blockers and evidence
router.post('/tasks/:id/progress', submitTaskProgress);
router.get('/tasks/:id/updates', listTaskUpdates);

// Workload and availability — always scoped to the caller's own department.
// Declared BEFORE '/workers/:id/…' and '/tasks/:id/…' so the literal
// segments can never be swallowed by a parameter route.
router.get('/workers/available', availableWorkers);
router.get('/officers/available', officerWorkload);
router.get('/department/workload', departmentWorkload);
router.get('/workers/:id/assignments', workerAssignments);
router.patch('/workers/:id/availability', setWorkerAvailability);

// Resources
router.get('/resources', listResources);
router.post('/resources', createResource);
router.post('/resources/:id/request', requestResource);
router.patch('/resources/:id/review', reviewResourceRequest);

export default router;
