import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import {
  assignDepartmentHead,
  assignEmergencyDepartmentHead,
  createDepartment,
  deleteComplaint,
  deleteDepartment,
  deleteUser,
  exportReport,
  getAnalytics,
  getComplaintDetail,
  getDashboardStats,
  getDepartmentDetail,
  getEmergencyDetail,
  getSettings,
  getUserDetail,
  listActivityLogs,
  listAssignableRoles,
  listComplaints,
  listDepartments,
  listDepartmentsForCitizen,
  listEmergencies,
  listUsers,
  selectUsers,
  toggleDepartmentStatus,
  updateComplaint,
  updateDepartment,
  updateEmergency,
  updateEmergencyRouting,
  updateSettings,
  updateUserRole,
  updateUserStatus
} from '../controllers/adminController.js';
import {
  getCategoryGovernance,
  getGovernanceOverview,
  getMapTileHealth,
  getOperationsAnalytics,
  getPermissions,
  getSystemHealth,
  globalSearch
} from '../controllers/adminGovernanceController.js';
import {
  createReportCategory,
  deleteReportCategory,
  listManagedReportCategories,
  restoreDefaultReportCategories,
  updateReportCategory
} from '../controllers/reportCategoryController.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// Overview, governance and intelligence
router.get('/dashboard', getDashboardStats);
router.get('/analytics', getAnalytics);
router.get('/analytics/operations', getOperationsAnalytics);
router.get('/governance', getGovernanceOverview);
router.get('/governance/categories', getCategoryGovernance);
router.get('/system-health/map-tiles', getMapTileHealth);
router.get('/system-health', getSystemHealth);
router.get('/permissions', getPermissions);
router.get('/search', globalSearch);
router.get('/reports/export', exportReport);

// Users
router.get('/users/select', selectUsers);
router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

// Departments — public route first, then parameterised
router.get('/departments/citizen-list', listDepartmentsForCitizen);
router.get('/departments/assignable-roles', listAssignableRoles);
router.get('/departments', listDepartments);
router.post('/departments', createDepartment);
router.get('/departments/:id', getDepartmentDetail);
router.patch('/departments/:id/status', toggleDepartmentStatus);
router.patch('/departments/:id/emergency-routing', updateEmergencyRouting);
router.patch('/departments/:id', updateDepartment);
router.post('/departments/:id/head', assignDepartmentHead);
router.post('/departments/:id/emergency-head', assignEmergencyDepartmentHead);
router.delete('/departments/:id', deleteDepartment);

// Report categories — the catalogue citizens pick from, with default departments
router.get('/report-categories', listManagedReportCategories);
router.post('/report-categories', createReportCategory);
router.post('/report-categories/restore-defaults', restoreDefaultReportCategories);
router.patch('/report-categories/:id', updateReportCategory);
router.delete('/report-categories/:id', deleteReportCategory);

// Complaints
router.get('/complaints', listComplaints);
router.get('/complaints/:id', getComplaintDetail);
router.patch('/complaints/:id', updateComplaint);
router.delete('/complaints/:id', deleteComplaint);

// Emergency oversight
router.get('/emergencies', listEmergencies);
router.get('/emergencies/:id', getEmergencyDetail);
router.patch('/emergencies/:id', updateEmergency);

// Audit trail, export and configuration
router.get('/activity-logs', listActivityLogs);
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);

export default router;
