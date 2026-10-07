import DepartmentTask from '../models/DepartmentTask.js';
import Emergency from '../models/Emergency.js';
import { TERMINAL_STATUSES } from '../config/emergencyOps.js';
import { assertUnreferencedRecord } from './referenceSafety.js';

export function userManagementConflict(user, { role = user.role, department = user.department, status = user.status, deleting = false } = {}) {
  const roleChanged = role !== user.role || String(department || '') !== String(user.department || '');
  if (user.role === 'emergency_department_head' && user.status === 'active' && (deleting || roleChanged || status !== 'active')) {
    return 'Replace the global Emergency Department Head through the head assignment action before changing this account.';
  }
  if ((deleting || roleChanged || status !== 'active') && (user.activeTask || user.activeEmergencyTeam)) {
    return 'Release this user from active work before changing their role, department, status, or deleting the account.';
  }
  return null;
}

export async function assertUserManagementSafe(user, changes) {
  let message = userManagementConflict(user, changes);
  if (!message) {
    const changing = changes.deleting || (changes.role !== undefined && changes.role !== user.role)
      || (changes.department !== undefined && String(changes.department || '') !== String(user.department || ''))
      || (changes.status !== undefined && changes.status !== 'active');
    if (changing) {
      const [task, incident] = await Promise.all([
        DepartmentTask.exists({ status: { $nin: ['completed', 'verified', 'cancelled', 'rejected'] }, $or: [{ assignedOfficer: user._id }, { teamLeader: user._id }, { assignedWorker: user._id }, { workerIds: user._id }] }),
        Emergency.exists({ 'ops.workflowStatus': { $nin: TERMINAL_STATUSES }, $or: [{ 'ops.departmentOfficer': user._id }, { 'ops.emergencyOfficer': user._id }] })
      ]);
      if (task || incident) message = 'Reassign active tasks and emergencies before changing this operational account.';
    }
  }
  if (message) throw Object.assign(new Error(message), { statusCode: 409 });
  if (changes.deleting) await assertUnreferencedRecord('User', user._id);
}
