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
  reviewDuplicateCase,
  reviewResourceRequest,
  startReview,
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
const departmentStaff = requireRole('department_head', 'department_officer', 'officer');
const teamLeader = requireRole('officer');

// Core Department Dashboard & Governance
router.get('/dashboard', departmentStaff, dashboard);
router.get('/analytics', departmentStaff, analytics);
router.get('/activity', departmentStaff, departmentActivity);
router.get('/staff', departmentStaff, listStaff);

// Case Operations
router.get('/reports', departmentStaff, listReports);
router.get('/reports/:id', departmentStaff, getReport);
router.patch('/reports/:id/duplicate-review', departmentStaff, reviewDuplicateCase);
router.post('/reports/:id/notes', departmentStaff, addReportNote);
router.post('/reports/:id/messages', departmentStaff, addCaseMessage);
router.patch('/reports/:id/priority', departmentStaff, updatePriority);
router.patch('/reports/:id/assign', departmentStaff, assignReport);
router.patch('/reports/:id/status', departmentStaff, updateStatus);
router.post('/reports/:id/completion-report', departmentStaff, submitCompletion);
router.patch('/reports/:id/completion-review', departmentStaff, reviewCompletion);
router.post('/reports/:id/review', departmentStaff, startReview);
router.get('/reports/:id/team-recommendations', departmentStaff, recommendTeams);
router.post('/reports/:id/escalate', departmentStaff, escalateCase);
router.post('/reports/:id/resolve-escalation', departmentStaff, resolveEscalation);
router.post('/reports/:id/handover', departmentStaff, handoverCase);

// Teams
router.get('/teams', departmentStaff, listTeams);
router.post('/teams', departmentStaff, createTeam);
router.patch('/teams/:id', departmentStaff, updateTeam);

// Tasks (Field Execution)
router.get('/tasks', listTasks);
router.post('/tasks', departmentStaff, createTask);
router.get('/tasks/:id', getTask);
router.patch('/tasks/:id/status', departmentStaff, updateTaskStatus);
router.post('/tasks/:id/complete', completeTask);

// Operational assignment (Officer owns the task; only they may staff it)
router.patch('/tasks/:id/assign-worker', teamLeader, assignWorkerToTask);
router.delete('/tasks/:id/workers/:workerId', teamLeader, removeWorkerFromTask);
router.post('/tasks/:id/team', teamLeader, assignTeamToTask);
router.post('/tasks/:id/team/detach', teamLeader, detachTeamFromTask);
router.patch('/tasks/:id/transition', transitionTask);

// Field progress, blockers and evidence
router.post('/tasks/:id/progress', submitTaskProgress);
router.get('/tasks/:id/updates', listTaskUpdates);

// Workload and availability — always scoped to the caller's own department.
// Declared BEFORE '/workers/:id/…' and '/tasks/:id/…' so the literal
// segments can never be swallowed by a parameter route.
router.get('/workers/available', departmentStaff, availableWorkers);
router.get('/officers/available', departmentStaff, officerWorkload);
router.get('/department/workload', departmentStaff, departmentWorkload);
router.get('/workers/:id/assignments', workerAssignments);
router.patch('/workers/:id/availability', setWorkerAvailability);

// Resources
router.get('/resources', listResources);
router.post('/resources', createResource);
router.post('/resources/:id/request', requestResource);
router.patch('/resources/:id/review', reviewResourceRequest);

export default router;
