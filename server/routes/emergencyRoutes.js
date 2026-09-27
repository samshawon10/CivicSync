import { Router } from 'express';
import { addAssignmentWorkers, analytics, assignEmergency, backupEmergency, classifyRequest, closeEmergency, communityVerify, createAlert, createCategory, createContact, createEmergency, createAlertManaged, dashboard, deleteAlertManaged, deleteCategory, deleteContact, downloadEvidence, emergencyTypes, escalateEmergency, getEmergency, hotspots, listAlerts, listAssignableResponders, listContacts, listEmergencies, manageCategories, mapEmergencies, mergeEmergency, nearbyResponderTeams, responderLocations, responderPositions, resolveEmergency, safetyIntelligence, similarEmergencies, updateAlert, updateAlertManaged, updateAssignmentStatus, updateCategory, updateContact, updateEmergency, updateResponderLocation, updateStatus, uploadEvidence } from '../controllers/emergencyController.js';
import * as ops from '../controllers/emergencyOpsController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { uploadEmergencyEvidence } from '../middleware/uploadMiddleware.js';

const router = Router();
router.use(requireAuth);

// Emergency Operations Role-Based Dashboards
router.get('/dashboard/head', requireRole('emergency_department_head', 'admin'), ops.headDashboard);
router.get('/dashboard/department-officer', requireRole('emergency_department_officer', 'admin'), ops.edoDashboard);
router.get('/dashboard/officer', requireRole('emergency_officer', 'admin'), ops.eoDashboard);
router.get('/dashboard/field-worker', requireRole('emergency_field_worker', 'admin'), ops.fieldWorkerDashboard);

// Operations Management Endpoints
const allEmergencyRoles = ['emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker', 'admin'];
router.get('/ops/incidents', requireRole(...allEmergencyRoles), ops.listIncidents);
router.get('/ops/incidents/:id', requireRole(...allEmergencyRoles), ops.getIncident);
router.get('/ops/staff', requireRole('emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'admin'), ops.listStaff);
router.get('/ops/rosters', requireRole('emergency_officer', 'admin'), ops.listRosters);
router.post('/ops/rosters', requireRole('emergency_officer', 'admin'), ops.createRoster);

// Workflow Actions
router.post('/ops/incidents/:id/review', requireRole('emergency_department_head', 'admin'), ops.reviewHead);
router.post('/ops/incidents/:id/classify', requireRole('emergency_department_head', 'admin'), ops.classify);
router.post('/ops/incidents/:id/assign-edo', requireRole('emergency_department_head', 'admin'), ops.assignEDO);
router.post('/ops/incidents/:id/edo-review', requireRole('emergency_department_officer', 'admin'), ops.reviewEDO);
router.post('/ops/incidents/:id/assign-eo', requireRole('emergency_department_officer', 'admin'), ops.assignEO);
router.post('/ops/incidents/:id/accept', requireRole('emergency_officer', 'admin'), ops.acceptIncident);
router.post('/ops/incidents/:id/teams', requireRole('emergency_officer', 'admin'), ops.createTeam);
router.post('/ops/incidents/:id/teams/attach-roster', requireRole('emergency_officer', 'admin'), ops.attachRoster);
router.post('/ops/incidents/:id/teams/:teamId/members', requireRole('emergency_officer', 'admin'), ops.addTeamWorker);
router.delete('/ops/incidents/:id/teams/:teamId/members/:workerId', requireRole('emergency_officer', 'admin'), ops.releaseTeamWorker);
router.post('/ops/incidents/:id/start-response', requireRole('emergency_officer', 'admin'), ops.startResponse);
router.post('/ops/incidents/:id/field-assignment', requireRole('emergency_field_worker'), ops.updateFieldAssignment);
router.post('/ops/incidents/:id/progress', requireRole('emergency_officer', 'emergency_field_worker', 'admin'), ops.updateProgress);
router.post('/ops/incidents/:id/blockers', requireRole('emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker', 'admin'), ops.reportBlocker);
router.post('/ops/incidents/:id/blockers/:blockerIndex/resolve', requireRole('emergency_officer', 'emergency_department_officer', 'emergency_department_head', 'admin'), ops.resolveBlocker);
router.post('/ops/incidents/:id/escalate', requireRole('emergency_department_head', 'emergency_field_worker', 'emergency_officer', 'emergency_department_officer', 'admin'), ops.escalate);
router.post('/ops/incidents/:id/escalations/:escalationId/resolve', requireRole('emergency_department_officer', 'emergency_department_head', 'admin'), ops.resolveEscalation);
router.post('/ops/incidents/:id/worker-complete', requireRole('emergency_field_worker', 'admin'), ops.workerComplete);
router.post('/ops/incidents/:id/complete-response', requireRole('emergency_officer', 'admin'), ops.completeResponse);
router.post('/ops/incidents/:id/review-completion', requireRole('emergency_department_officer', 'admin'), ops.reviewCompletion);
router.post('/ops/incidents/:id/close', requireRole('emergency_department_head', 'admin'), ops.closeIncident);
router.post('/ops/incidents/:id/cancel', requireRole('emergency_department_head', 'admin'), ops.cancelIncident);
router.post('/ops/incidents/:id/instructions', requireRole('emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'admin'), ops.addDirective);

router.get('/types', emergencyTypes);
router.get('/categories/manage', manageCategories);
router.post('/categories', createCategory);
router.patch('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);
router.post('/classify', classifyRequest);
router.get('/assignable-responders', listAssignableResponders);
router.get('/map', mapEmergencies);
router.get('/responder-locations', responderLocations);
router.get('/hotspots', hotspots);
router.get('/safety-intelligence', safetyIntelligence);
router.get('/analytics', analytics);
router.get('/dashboard', dashboard);
router.get('/alerts', listAlerts);
router.post('/alerts', createAlertManaged);
router.patch('/alerts/:id', updateAlertManaged);
router.delete('/alerts/:id', deleteAlertManaged);
router.post('/', createEmergency);
router.get('/', listEmergencies);
router.get('/:id', getEmergency);
router.get('/:id/similar', similarEmergencies);
router.post('/:id/merge', mergeEmergency);
router.get('/:id/responders', nearbyResponderTeams);
router.get('/:id/responder-positions', responderPositions);
router.post('/:id/verify', communityVerify);
router.get('/:id/evidence/:filename', downloadEvidence);
router.post('/:id/evidence', uploadEmergencyEvidence, uploadEvidence);
router.patch('/:id/responder-location', updateResponderLocation);
router.patch('/:id', updateEmergency);
router.post('/:id/assign', assignEmergency);
router.patch('/:id/assignments/:assignmentId/status', updateAssignmentStatus);
router.post('/:id/assignments/:assignmentId/workers', addAssignmentWorkers);
router.patch('/:id/status', updateStatus);
router.post('/:id/escalate', escalateEmergency);
router.post('/:id/backup', backupEmergency);
router.post('/:id/resolve', resolveEmergency);
router.post('/:id/close', closeEmergency);

export const contactRouter = Router();
contactRouter.use(requireAuth, requireRole('citizen'));
contactRouter.get('/', listContacts);
contactRouter.post('/', createContact);
contactRouter.patch('/:id', updateContact);
contactRouter.delete('/:id', deleteContact);
export default router;
