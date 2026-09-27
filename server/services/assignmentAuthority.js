import mongoose from 'mongoose';
import User from '../models/User.js';
import DepartmentTask from '../models/DepartmentTask.js';

/** Which role an actor is allowed to book, per actor role. */
export const ASSIGNABLE_ROLES = Object.freeze({
  department_head: ['department_officer'],
  department_officer: ['officer'],
  officer: ['field_worker'],
  emergency_department_head: ['emergency_department_officer'],
  emergency_department_officer: ['emergency_officer'],
  emergency_officer: ['emergency_field_worker']
});

/** Roles that can hold an operational task, i.e. can be double-booked. */
export const WORKER_ROLES = Object.freeze(['field_worker', 'emergency_field_worker']);

const CONFLICT = 409;
const label = (value = '') => String(value).replaceAll('_', ' ');

export function canAssignRole(actorRole, targetRole) {
  return Boolean(ASSIGNABLE_ROLES[actorRole]?.includes(targetRole));
}

/** True when this actor may assign anybody at all. */
export function isAssignerRole(role) {
  return Boolean(ASSIGNABLE_ROLES[role]);
}

export const CASE_ASSIGNERS = Object.freeze(['department_head', 'department_officer']);

export function canAssignCaseLevel(role) {
  return CASE_ASSIGNERS.includes(role);
}

export function isWorkerRole(role) {
  return WORKER_ROLES.includes(role);
}

function fail(res, status, message) {
  res.status(status).json({ success: false, message });
  return null;
}

export async function resolveAssignableTarget({ actor, targetUserId, res }) {
  if (!isAssignerRole(actor.role)) {
    return fail(res, 403, 'Your role cannot assign operational staff.');
  }
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return fail(res, 400, 'That team member is not a valid user.');
  }
  const actorDepartment = actor.departmentName || actor.department?.name || '';
  if (!actorDepartment) return fail(res, 403, 'Your account is not attached to a department.');

  const target = await User.findById(targetUserId);
  if (!target || target.status !== 'active') {
    return fail(res, 404, 'That team member was not found or is not active.');
  }
  if (!canAssignRole(actor.role, target.role)) {
    return fail(res, 403, `A ${label(actor.role)} cannot assign a ${label(target.role)}.`);
  }
  if ((target.departmentName || '') !== actorDepartment) {
    return fail(res, 403, 'You can only assign staff from your own department.');
  }
  return target;
}

export async function bookWorker({ workerId, taskId, res }) {

  const booked = await User.findOneAndUpdate(
    { _id: workerId, availability: 'available', activeEmergencyTeam: null },
    { $set: { availability: 'busy', activeTask: taskId, availabilityChangedAt: new Date() } },
    { new: true }
  );
  if (booked) return booked;

  // The conditional update lost the race — work out why, for a clear message.
  const current = await User.findById(workerId).select('availability activeTask activeEmergencyTeam');
  if (!current) return fail(res, 404, 'That worker was not found.');
  if (current.activeEmergencyTeam) {
    return fail(res, CONFLICT, 'Worker is already deployed on an emergency response team.');
  }
  if (current.availability === 'busy') {
    return fail(res, CONFLICT, 'Worker is already assigned to an active task.');
  }
  return fail(res, CONFLICT, `Worker is not available (${label(current.availability)}).`);
}

export async function releaseWorker({ workerId, res }) {
  const otherActive = await DepartmentTask.exists({
    $or: [{ assignedWorker: workerId }, { 'team.members': workerId }],
    status: { $nin: ['completed', 'cancelled', 'rejected'] }
  });
  if (otherActive) {
    return fail(res, CONFLICT, 'This worker still holds another active task and cannot be released.');
  }
  const released = await User.findOneAndUpdate(
    { _id: workerId, availability: 'busy' },
    { $set: { availability: 'available', activeTask: null, availabilityChangedAt: new Date() } },
    { new: true }
  );
  return released || (await User.findById(workerId));
}

export async function workerWorkload({ departmentName, role = 'field_worker' }) {
  const workers = await User.find({ departmentName, role, status: 'active' })
    .select('name role availability activeTask availabilityChangedAt');
  const ids = workers.map((worker) => worker._id);
  const busyTasks = await DepartmentTask.find({
    status: { $nin: ['completed', 'cancelled', 'rejected'] },
    $or: [{ assignedWorker: { $in: ids } }, { 'team.members': { $in: ids } }]
  }).select('taskNumber title status assignedWorker team');
  return workers.map((worker) => {
    const task = busyTasks.find((candidate) =>
      candidate.assignedWorker?.equals?.(worker._id)
      || candidate.team?.members?.some?.((member) => member.equals?.(worker._id))
    );
    return {
      _id: worker._id,
      name: worker.name,
      role: worker.role,
      availability: worker.availability,
      currentTask: task
        ? { id: task._id, taskNumber: task.taskNumber, title: task.title, status: task.status }
        : null
    };
  });
}