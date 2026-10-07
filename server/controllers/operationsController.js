import mongoose from 'mongoose';
import User from '../models/User.js';
import Report from '../models/Report.js';
import ActivityLog from '../models/ActivityLog.js';
import Notification from '../models/Notification.js';
import Department from '../models/Department.js';
import DepartmentTeam from '../models/DepartmentTeam.js';
import DepartmentTask from '../models/DepartmentTask.js';
import DepartmentTaskUpdate from '../models/DepartmentTaskUpdate.js';
import { emitDepartmentEvent } from '../realtime/emergencyRealtime.js';
import {
  bookWorker,
  releaseWorker,
  resolveAssignableTarget,
  workerWorkload
} from '../services/assignmentAuthority.js';
import {
  checkTaskTransition,
  isOpenTaskState,
  taskAuditAction,
  TASK_AUDIT_ACTIONS
} from '../services/taskWorkflow.js';
import { checkStageTransition } from '../services/reportWorkflow.js';
import { findPotentialDuplicateReports, isMasterReport } from '../services/duplicateReports.js';
import { notifyMasterCaseReporters } from '../services/masterCaseNotifications.js';

const MANAGEMENT_ROLES = ['department_head', 'department_officer'];
const label = (value = '') => String(value).replaceAll('_', ' ');

function departmentNameFor(user) {
  return user.departmentName || user.department?.name || '';
}

function fail(res, status, message) {
  res.status(status).json({ success: false, message });
  return null;
}

async function auditLog(user, action, targetType, targetId, targetName, description, metadata = {}) {
  try {
    return await ActivityLog.create({
      admin: user._id,
      actorRole: user.role || '',
      action,
      targetType,
      targetId,
      targetName: targetName || '',
      description: description || '',
      metadata,
      result: 'success'
    });
  } catch (error) {
    // Auditing must never block the operational action, but a silent failure
    // here would hide a real bug (a bad targetType, for example), so make it
    // visible in the server log.
    console.error(`[audit] failed to record ${action}:`, error.message);
    return null;
  }
}

async function notify(recipient, message, report) {
  if (!recipient) return;
  await Notification.create({ recipient, report, type: 'report_status', message })
    .catch((error) => console.error('[notification] failed to record task update:', error.message));
}

/**
 * Records a workflow stage step on the linked case so the citizen timeline
 * mirrors what the field team did. Returns true when the stage actually moved.
 */
function applyReportStage(report, stage, actor, note = '') {
  const check = checkStageTransition({ from: report.workflowStage, to: stage, actorRole: actor.role });
  if (!check.ok) return false;
  report.workflowHistory.push({
    stage,
    previousStage: report.workflowStage,
    actor: actor._id,
    actorRole: actor.role,
    note: String(note || '').slice(0, 500)
  });
  report.workflowStage = stage;
  return true;
}

async function loadOperationalTask(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return fail(res, 404, 'Task not found.');
  }
  const departmentName = departmentNameFor(req.user);
  if (!departmentName) return fail(res, 403, 'Your account is not attached to a department.');

  const task = await DepartmentTask.findById(req.params.id)
    .populate('workerIds', 'name role availability')
    .populate('assignedWorker', 'name role availability')
    .populate({
      path: 'team',
      select: 'name type departmentName leader members status',
      populate: [
        { path: 'leader', select: 'name role departmentName status' },
        { path: 'members', select: 'name role departmentName status' }
      ]
    })
    .populate('teamLeader', 'name role departmentName status')
    .populate('workerAssignments.worker', 'name role departmentName status');
  if (!task || task.departmentName !== departmentName) return fail(res, 404, 'Task not found.');
  if (task.populated('team') && !task.team) return fail(res, 404, 'Task not found.');
  if (req.user.role === 'field_worker'
    && !(await Report.exists({ _id: task.report, departmentName: task.departmentName }))) {
    return fail(res, 404, 'Task not found.');
  }

  if (MANAGEMENT_ROLES.includes(req.user.role)) return task;
  if (req.user.role === 'officer'
    && (task.assignedOfficer?.equals?.(req.user._id) || task.teamLeader?._id?.equals?.(req.user._id))) return task;
  if (req.user.role === 'field_worker') {
    const team = task.team;
    const isTeamMember = team?.departmentName === task.departmentName
      && team.members?.some((member) => member._id.equals(req.user._id)
        && member.role === 'field_worker'
        && member.status === 'active'
        && member.departmentName === departmentName);
    const hasAssignedTeam = Boolean(task.team);
    const onTask = (task.assignedWorker?.equals?.(req.user._id)
      || task.workerIds?.some?.((worker) => worker?._id?.equals?.(req.user._id))
      || task.workerAssignments?.some?.((assignment) => assignment.worker?._id?.equals?.(req.user._id)
        || assignment.worker?.equals?.(req.user._id)));
    if (onTask && (!hasAssignedTeam || isTeamMember)) return task;
  }
  return fail(res, 404, 'Task not found.');
}

function canStaffTask(user, task) {
  return user.role === 'officer' && task.assignedOfficer?.equals?.(user._id);
}

function requireStaffingAuthority(user, task, res) {
  if (!canStaffTask(user, task)) {
    return fail(res, 403, 'Only the Team Leader assigned to this task can assign workers or teams.');
  }
  return true;
}

/** Every worker currently booked onto this task. */
function bookedWorkerIds(task) {
  const ids = [];
  if (task.assignedWorker?._id) ids.push(task.assignedWorker._id);
  for (const worker of task.workerIds || []) if (worker?._id) ids.push(worker._id);
  return [...new Set(ids.map(String))].map((id) => new mongoose.Types.ObjectId(id));
}

function setWorkerAssignment(task, workerId, status = 'assigned') {
  const assignment = task.workerAssignments.find((item) =>
    String(item.worker?._id || item.worker) === String(workerId)
  );
  if (assignment) {
    assignment.status = status;
    assignment.updatedAt = new Date();
    return;
  }
  task.workerAssignments.push({ worker: workerId, status, updatedAt: new Date() });
}

function workerAssignmentFor(task, workerId) {
  return task.workerAssignments.find((item) =>
    String(item.worker?._id || item.worker) === String(workerId)
  );
}

/** Minimal response stand-in for service calls whose result we already know. */
const ignoreResponse = { status: () => ignoreResponse, json: () => ignoreResponse };

async function rollbackTaskBookings(taskId, workerIds) {
  const persisted = await DepartmentTask.findById(taskId).select('assignedWorker workerIds');
  const assigned = new Set([persisted?.assignedWorker, ...(persisted?.workerIds || [])].filter(Boolean).map(String));
  const unused = workerIds.filter((id) => !assigned.has(String(id)));
  if (unused.length) await User.updateMany({ _id: { $in: unused }, activeTask: taskId, activeEmergencyTeam: null }, { $set: { availability: 'available', activeTask: null, availabilityChangedAt: new Date() } });
}

/** Release every worker booked on a task that has just closed or been emptied. */
async function releaseTaskWorkers(task, { actor } = {}) {
  const released = [];
  for (const workerId of bookedWorkerIds(task)) {
    const user = await releaseWorker({ workerId, res: ignoreResponse });
    if (user) released.push(user);
  }
  if (released.length) {
    for (const worker of released) {
      await notify(worker._id, 'Your assignment has finished. You are now available for new work.', task.report);
      // A worker only becomes AVAILABLE once they hold nothing else; that check
      // lives in releaseWorker, and the audit records who freed them.
      await auditLog(
        actor || { _id: task.assignedOfficer, role: 'officer' },
        'WORKER_RELEASED',
        'task',
        task._id,
        task.title,
        `${worker.name} released and available`,
        { workerId: String(worker._id), releasedByTask: String(task._id) }
      );
    }
    emitDepartmentEvent('WORKER_RELEASED', {
      taskId: task._id,
      departmentName: task.departmentName,
      workerIds: released.map((worker) => String(worker._id))
    }, { department: task.departmentName });
  }
  return released;
}

export async function assignWorkerToTask(req, res, next) {
  try {
    const task = await loadOperationalTask(req, res);
    if (!task) return;
    if (!requireStaffingAuthority(req.user, task, res)) return;

    const workerId = req.body.workerId;
    if (!workerId) return fail(res, 400, 'workerId is required.');
    if (req.body.teamId && !mongoose.Types.ObjectId.isValid(req.body.teamId)) {
      return fail(res, 400, 'Select a valid team.');
    }
    if (!task.team && !req.body.teamId) {
      return fail(res, 409, 'Assign a response team before assigning workers to this field task.');
    }

    // A closed task can never take more staff.
    if (!['pending', 'assigned', 'team_formed'].includes(task.status)) {
      return fail(res, 409, `Task is ${task.status} and can no longer change its assigned team.`);
    }

    // A team is optional. When one is attached or selected, keep assignments
    // limited to its active members; otherwise assign any eligible worker in
    // the task's department.
    const taskTeamId = task.team?._id || task.team;
    const staffingTeam = taskTeamId
      ? await DepartmentTeam.findOne({
        _id: taskTeamId,
        departmentName: task.departmentName,
        active: true
      }).populate('leader', 'name role status').populate('members', 'role departmentName status')
      : await DepartmentTeam.findOne({
          _id: req.body.teamId,
          departmentName: task.departmentName,
          active: true
        }).populate('leader', 'name role status').populate('members', 'role departmentName status');
    if (!staffingTeam) {
      return fail(res, 400, 'Select an active team led by you before assigning one of its workers.');
    }
    if (taskTeamId && String(taskTeamId) !== String(staffingTeam._id)) {
      return fail(res, 409, 'Workers on a task must belong to its already attached team.');
    }
    if (staffingTeam && !staffingTeam.leader?._id.equals(req.user._id)) {
      return fail(res, 403, 'Only the Team Leader assigned to this task may staff this team.');
    }
    const eligibleMembers = staffingTeam.members.filter((member) =>
      member.role === 'field_worker' && member.status === 'active' && member.departmentName === task.departmentName
    );
    if (eligibleMembers.length < 2) {
      return fail(res, 409, 'A response team must have at least two active Field Workers before it can be assigned.');
    }
    const worker = await resolveAssignableTarget({ actor: req.user, targetUserId: workerId, res });
    if (!worker) return;
    if (staffingTeam && !staffingTeam.members.some((member) => String(member._id) === String(worker._id))) {
      return fail(res, 403, 'Choose a worker who belongs to the team attached to this task.');
    }

    if (bookedWorkerIds(task).some((id) => id.equals(worker._id))) {
      return fail(res, 409, 'That worker is already on this task.');
    }
    if (bookedWorkerIds(task).length >= staffingTeam.capacity) return fail(res, 409, 'This team has reached its worker capacity.');

    // Atomic booking — the loser of a race gets 409 here.
    const booked = await bookWorker({ workerId: worker._id, taskId: task._id, res });
    if (!booked) return;

    if (task.assignedWorker) task.workerIds.push(worker._id);
    else task.assignedWorker = worker._id;
    setWorkerAssignment(task, worker._id);
    if (staffingTeam) task.team = staffingTeam._id;
    task.teamLeader = req.user._id;
    task.status = task.status === 'pending' ? 'assigned' : task.status;
    task.timeline.push({ status: task.status, actor: req.user._id, actorRole: req.user.role, note: `Worker assigned: ${worker.name}` });
    try { await task.save(); }
    catch (error) { await rollbackTaskBookings(task._id, [worker._id]); throw error; }
    if (staffingTeam) await staffingTeam.updateOne({ $set: { status: 'busy' } });

    // The team on the case is now staffed, so the citizen sees "Team Assigned".
    const caseReport = await Report.findById(task.report);
    if (caseReport && applyReportStage(caseReport, 'TEAM_FORMED', req.user, `Worker assigned: ${worker.name}`)) {
      caseReport.activity.push({ action: 'Team assigned to the case', actorRole: req.user.role, note: `Worker: ${worker.name}` });
      await caseReport.save();
    }

    await auditLog(req.user, 'WORKER_ASSIGNED', 'task', task._id, task.title, `Worker ${worker.name} assigned to ${task.taskNumber || task.title}.`, {
      workerId: String(worker._id),
      previousStatus: task.status,
      newStatus: task.status
    });
    await notify(worker._id, `You were assigned to the field task "${task.title}".`, task.report);

    emitDepartmentEvent('WORKER_ASSIGNED', {
      taskId: task._id,
      caseId: task.report,
      workerId: worker._id,
      workerName: worker.name,
      departmentName: task.departmentName,
      status: task.status
    }, { userIds: [worker._id], department: task.departmentName });

    return res.json({ success: true, message: `${worker.name} assigned and marked busy.`, task });
  } catch (error) { next(error); }
}

/** PATCH /tasks/:id/remove-worker — releases one worker from a task. */
export async function removeWorkerFromTask(req, res, next) {
  try {
    const task = await loadOperationalTask(req, res);
    if (!task) return;
    if (!requireStaffingAuthority(req.user, task, res)) return;
    const { workerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(workerId)) return fail(res, 400, 'Invalid worker id.');

    const isPrimary = task.assignedWorker?.equals?.(workerId);
    const inTeam = task.workerIds.some((worker) => String(worker._id || worker) === String(workerId));
    if (!isPrimary && !inTeam) return fail(res, 404, 'That worker is not on this task.');

    if (isPrimary) {
      // Promote the next member so the task always has a lead worker.
      const next = task.workerIds.shift();
      task.assignedWorker = next?._id || next || null;
    } else {
      task.workerIds = task.workerIds.filter((worker) => String(worker._id || worker) !== String(workerId));
    }
    task.workerAssignments = task.workerAssignments.filter((assignment) =>
      String(assignment.worker?._id || assignment.worker) !== String(workerId)
    );
    await task.save();
    const user = await releaseWorker({ workerId, res });
    if (!user) return;
    task.timeline.push({ status: task.status, actor: req.user._id, actorRole: req.user.role, note: `Worker released: ${user.name}` });
    await task.save();

    await auditLog(req.user, 'WORKER_RELEASED', 'task', task._id, task.title, `Worker ${user.name} released from ${task.taskNumber || task.title}.`);
    await notify(user._id, `You were released from "${task.title}" and are available again.`, task.report);
    emitDepartmentEvent('WORKER_RELEASED', { taskId: task._id, workerId: user._id, departmentName: task.departmentName }, { userIds: [user._id], department: task.departmentName });

    return res.json({ success: true, message: `${user.name} released and available again.`, task });
  } catch (error) { next(error); }
}

/** POST /tasks/:id/team — attach a team (normal or roster) to a task. */
export async function assignTeamToTask(req, res, next) {
  try {
    const task = await loadOperationalTask(req, res);
    if (!task) return;
    if (!requireStaffingAuthority(req.user, task, res)) return;
    if (!['pending', 'assigned', 'team_formed'].includes(task.status)) {
      return fail(res, 409, `Task is ${task.status} and can no longer change its assigned team.`);
    }
    const { teamId } = req.body;
    const team = await DepartmentTeam.findOne({ _id: teamId, departmentName: task.departmentName, active: true })
      .populate('leader', 'name role departmentName status')
      .populate('members', 'name role departmentName status availability');
    if (!team) return fail(res, 404, 'That team is not active in this department.');
    if (!team.leader?._id.equals(req.user._id)) {
      return fail(res, 403, 'Only the Team Leader assigned to this task may attach their team.');
    }
    if (team.members.length < 2) {
      return fail(res, 409, 'A response team must have at least two active Field Workers before it can be assigned.');
    }
    if (team.members.length > team.capacity) return fail(res, 409, 'This team exceeds its worker capacity. Update its roster first.');
    const invalidMembers = team.members.filter((member) =>
      member.role !== 'field_worker'
      || member.status !== 'active'
      || member.departmentName !== task.departmentName
    );
    if (invalidMembers.length) {
      return fail(res, 409, `This team contains staff who cannot be assigned to this task: ${invalidMembers.map((member) => member.name).join(', ')}. Update the team roster first.`);
    }

    const already = bookedWorkerIds(task).map(String);
    const toBook = (team.members || []).filter((member) => !already.includes(String(member._id)));
    if (already.some((id) => !team.members.some((member) => String(member._id) === id))) {
      return fail(res, 409, 'Remove workers outside this team before attaching the team.');
    }

    // Book everyone up front; if any single worker is unavailable the whole
    // attach is refused, so a team is never half-committed.
    const booked = [];
    for (const member of toBook) {
      const result = await bookWorker({ workerId: member._id, taskId: task._id, res });
      if (!result) {
        for (const done of booked) {
          await releaseWorker({ workerId: done._id, res: { status: () => ({ json: () => {} }) } });
        }
        return;
      }
      booked.push(result);
    }

    task.team = team._id;
    task.teamLeader = team.leader._id;
    if (!task.assignedWorker) task.assignedWorker = booked[0]?._id || team.members[0]._id;
    task.workerIds = [...new Set([
      ...task.workerIds.map((worker) => String(worker._id || worker)),
      ...team.members.map((worker) => String(worker._id))
    ])].map((id) => new mongoose.Types.ObjectId(id));
    for (const member of team.members) setWorkerAssignment(task, member._id);
    task.status = 'team_formed';
    task.timeline.push({ status: 'team_formed', actor: req.user._id, actorRole: req.user.role, note: `${team.type === 'roster' ? 'Roster' : 'Normal'} team "${team.name}" attached (${booked.length} worker(s)).` });
    try { await task.save(); }
    catch (error) { await rollbackTaskBookings(task._id, booked.map((worker) => worker._id)); throw error; }
    await team.updateOne({ $set: { status: 'busy' } });

    // Record the team assignment on the case itself (citizen-visible stage).
    const caseReport = await Report.findById(task.report);
    if (caseReport && applyReportStage(caseReport, 'TEAM_FORMED', req.user, `Team ${team.name} (${booked.length} worker(s)) assigned.`)) {
      caseReport.activity.push({ action: 'Team assigned to the case', actorRole: req.user.role, note: `Team: ${team.name}` });
      await caseReport.save();
      await notifyMasterCaseReporters(caseReport, `A response team has been assigned to "${caseReport.title}".`);
    }

    await auditLog(req.user, 'TEAM_ASSIGNED', 'task', task._id, task.title, `${team.type === 'roster' ? 'Roster' : 'Normal'} team "${team.name}" (${booked.length} workers) assigned.`, {
      teamId: String(team._id),
      teamType: team.type,
      workerIds: booked.map((worker) => String(worker._id))
    });
    await Promise.all(booked.map((worker) => notify(worker._id, `You were added to "${task.title}" (team ${team.name}).`, task.report)));

    emitDepartmentEvent('TEAM_ASSIGNED', {
      taskId: task._id,
      teamId: team._id,
      teamName: team.name,
      teamType: team.type,
      workerIds: booked.map((worker) => String(worker._id)),
      departmentName: task.departmentName
    }, { userIds: booked.map((worker) => worker._id), department: task.departmentName });

    return res.json({ success: true, message: `Team ${team.name} assigned with ${booked.length} worker(s).`, task });
  } catch (error) { next(error); }
}

/** POST /tasks/:id/team/detach — release everyone the team put on the task. */
export async function detachTeamFromTask(req, res, next) {
  try {
    const task = await loadOperationalTask(req, res);
    if (!task) return;
    if (!requireStaffingAuthority(req.user, task, res)) return;
    if (!['pending', 'assigned', 'team_formed'].includes(task.status)) {
      return fail(res, 409, `Task is ${task.status} and its team can no longer be changed.`);
    }
    if (!task.team) return fail(res, 409, 'This task has no team attached.');

    const team = await DepartmentTeam.findById(task.team);
    const memberIds = new Set((team?.members || []).map(String));
    const toRelease = bookedWorkerIds(task).filter((id) => memberIds.has(String(id)));
    if (memberIds.has(String(task.assignedWorker?._id || task.assignedWorker))) task.assignedWorker = null;
    task.team = null;
    task.teamLeader = null;
    task.workerIds = task.workerIds.filter((worker) => !memberIds.has(String(worker?._id || worker)));
    task.workerAssignments = task.workerAssignments.filter((assignment) => !memberIds.has(String(assignment.worker)));
    task.timeline.push({ status: task.status, actor: req.user._id, actorRole: req.user.role, note: 'Team detached and its workers released.' });
    await task.save();
    for (const id of toRelease) {
      await releaseWorker({ workerId: id, res: { status: () => ({ json: () => {} }) } });
    }
    if (team) await team.updateOne({ $set: { status: 'available' } });

    await auditLog(req.user, 'TEAM_DETACHED', 'task', task._id, task.title, `Team released; ${toRelease.length} worker(s) freed.`);
    return res.json({ success: true, message: `Team detached, ${toRelease.length} worker(s) released.`, task });
  } catch (error) { next(error); }
}

export async function createTask(req, res, next) {
  try {
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return fail(res, 403, 'Your account is not attached to a department.');
    if (req.user.role !== 'officer') {
      return fail(res, 403, 'Only the Team Leader assigned to the case can create its field task.');
    }
    const report = await Report.findById(req.body.reportId);
    if (!report || report.departmentName !== departmentName) return fail(res, 404, 'Case not found.');
    if (!isMasterReport(report)) return fail(res, 409, 'Operational work can only be created for a master civic case.');

    if (req.user.role === 'officer' && !report.assignedOfficer?.equals?.(req.user._id)) {
      return fail(res, 403, 'This case is not assigned to you.');
    }
    if (!['ASSIGNED_TO_OFFICER', 'TEAM_FORMED', 'IN_PROGRESS'].includes(report.workflowStage)) {
      return fail(res, 409, `A case at ${report.workflowStage} cannot start operational work yet.`);
    }
    if (report.activeTask) return fail(res, 409, 'This case already has an active task.');
    if (report.duplicateReviewStatus !== 'separate') {
      const possibleDuplicates = await findPotentialDuplicateReports({
        title: report.title,
        description: report.description,
        category: report.category,
        departmentName: report.departmentName,
        location: report.location,
        excludeReportId: report._id
      });
      if (possibleDuplicates.length) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_REVIEW_REQUIRED',
          message: 'Review nearby master cases and link this report or explicitly keep it separate before creating field work.',
          duplicateCandidates: possibleDuplicates
        });
      }
    }
    const priority = String(req.body.priority || report.priority || 'medium').trim();
    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return fail(res, 422, 'Priority must be low, medium, high or urgent.');
    }
    const targetDueAt = req.body.targetDueAt ? new Date(req.body.targetDueAt) : report.dueAt || null;
    if (targetDueAt && Number.isNaN(targetDueAt.getTime())) {
      return fail(res, 422, 'Provide a valid SLA due date.');
    }
    const latitude = req.body.location?.latitude ?? report.location?.latitude ?? null;
    const longitude = req.body.location?.longitude ?? report.location?.longitude ?? null;
    const validLocation = (latitude === null && longitude === null)
      || (latitude !== null && longitude !== null && ['number', 'string'].includes(typeof latitude) && ['number', 'string'].includes(typeof longitude) && Number.isFinite(Number(latitude)) && Number(latitude) >= -90 && Number(latitude) <= 90
        && Number.isFinite(Number(longitude)) && Number(longitude) >= -180 && Number(longitude) <= 180);
    if (!validLocation) return fail(res, 422, 'Provide valid latitude and longitude coordinates for the task location.');

    const taskId = new mongoose.Types.ObjectId();
    const claimed = await Report.findOneAndUpdate(
      {
        _id: report._id,
        departmentName,
        activeTask: null,
        relationType: { $ne: 'DUPLICATE' },
        isMasterReport: { $ne: false }
      },
      { $set: { activeTask: taskId } },
      { new: true }
    );
    if (!claimed) return fail(res, 409, 'This master civic case already has operational work or was linked to another case.');

    let task;
    try {
      task = await DepartmentTask.create({
      _id: taskId,
      report: report._id,
      taskNumber: `TASK-${String(Date.now()).slice(-6)}`,
      title: String(req.body.title || report.title).trim().slice(0, 180),
      description: String(req.body.description || report.description).trim().slice(0, 2000),
      departmentName,
      assignedOfficer: req.user._id,
      teamLeader: req.user._id,
      instructions: String(req.body.instructions || '').trim().slice(0, 2000),
      assignedBy: req.user._id,
      status: 'pending',
      priority,
      targetDueAt,
      location: {
        address: String(req.body.location?.address || report.location?.address || report.location?.area || '').trim().slice(0, 300),
        latitude: latitude === null ? null : Number(latitude),
        longitude: longitude === null ? null : Number(longitude)
      },
      timeline: [{ status: 'pending', actor: req.user._id, actorRole: req.user.role, note: 'Task created from the citizen case.' }]
      });
    } catch (error) {
      await Report.updateOne({ _id: report._id, activeTask: taskId }, { $set: { activeTask: null } });
      throw error;
    }

    await auditLog(req.user, 'TASK_CREATED', 'task', task._id, task.title, `Task ${task.taskNumber} created for "${report.title}".`, { caseId: String(report._id) });
    emitDepartmentEvent('TASK_ASSIGNED', { taskId: task._id, caseId: report._id, departmentName, status: 'pending' }, { userIds: [report.assignedOfficer], department: departmentName });

    return res.status(201).json({ success: true, message: 'Task created.', task });
  } catch (error) { next(error); }
}

export async function transitionTask(req, res, next) {
  try {
    const task = await loadOperationalTask(req, res);
    if (!task) return;
    const to = String(req.body.status || '').trim();

    if (req.user.role === 'field_worker') {
      let assignment = workerAssignmentFor(task, req.user._id);
      const isAssigned = bookedWorkerIds(task).some((id) => id.equals(req.user._id))
        || task.team?.members?.some((member) => member._id.equals(req.user._id));
      if (!assignment && isAssigned) {
        const initialStatus = task.status === 'in_progress'
          ? 'in_progress'
          : task.status === 'accepted'
            ? 'accepted'
            : 'assigned';
        task.workerAssignments.push({ worker: req.user._id, status: initialStatus });
        assignment = workerAssignmentFor(task, req.user._id);
      }
      if (!assignment) return fail(res, 403, 'You are not assigned to this task.');
      if (!isOpenTaskState(task.status)) return fail(res, 409, `Task is ${task.status} and no longer accepts worker updates.`);
      if (['blocked', 'on_hold', 'paused'].includes(task.status)) {
        return fail(res, 409, 'Wait for the Team Leader to clear the task hold or blocker before continuing.');
      }
      const workerTransitions = {
        assigned: ['accepted'],
        accepted: ['in_progress']
      };
      if (!workerTransitions[assignment.status]?.includes(to)) {
        return fail(res, 409, `Your assignment is ${assignment.status}; it cannot move to ${to}.`);
      }
      if (to === 'completed') {
        return fail(res, 409, 'Use the field task completion action to submit your completion note.');
      }
      assignment.status = to;
      assignment.updatedAt = new Date();
      const assignments = task.workerAssignments;
      if (to === 'in_progress') task.status = 'in_progress';
      else if (to === 'accepted' && task.status !== 'in_progress') task.status = 'accepted';
      task.timeline.push({
        status: to,
        actor: req.user._id,
        actorRole: req.user.role,
        note: String(req.body.note || `${req.user.name}: ${to.replaceAll('_', ' ')}`).slice(0, 500)
      });
      await task.save();
      const report = await Report.findById(task.report);
      const stageForWorkerState = { accepted: 'ACCEPTED', in_progress: 'IN_PROGRESS' };
      if (report && stageForWorkerState[to] && applyReportStage(report, stageForWorkerState[to], req.user, req.body.note)) {
        await report.save();
        await notifyMasterCaseReporters(
          report,
          to === 'accepted'
            ? `Work on "${report.title}" has been accepted by the field team.`
            : `Field work has started for "${report.title}".`
        );
      }
      await auditLog(req.user, taskAuditAction(to), 'task', task._id, task.title, `Worker ${req.user.name}: ${to}`, {
        workerId: String(req.user._id),
        workerStatus: to,
        activeWorkerCount: assignments.filter((item) => item.status !== 'completed').length
      });
      emitDepartmentEvent('TASK_STATUS_CHANGED', {
        taskId: task._id,
        caseId: task.report,
        workerId: req.user._id,
        workerStatus: to,
        status: task.status,
        departmentName: task.departmentName
      }, { userIds: [task.assignedOfficer, req.user._id], department: task.departmentName });
      return res.json({ success: true, message: `Your assignment moved to ${to}.`, task });
    }

    if (to === 'verified') {
      if (req.user.role !== 'officer' || !task.teamLeader?._id?.equals(req.user._id)) {
        return fail(res, 403, 'Only the Team Leader assigned to this task can verify completed field work.');
      }
      if (!task.team || !task.workerAssignments.length || task.status !== 'completed'
        || task.workerAssignments.some((assignment) => assignment.status !== 'completed')) {
        return fail(res, 409, 'All assigned workers must complete the field task before Team Leader verification.');
      }
    }
    if ((task.team || task.workerAssignments.length) && req.user.role !== 'field_worker'
      && (['accepted', 'traveling', 'arrived'].includes(to)
        || (to === 'in_progress' && !['blocked', 'on_hold', 'paused'].includes(task.status)))) {
      return fail(res, 403, 'Workers on the assigned team must accept and start their own field assignments.');
    }
    if (to === 'completed' && (task.team || task.workerAssignments.length)) {
      return fail(res, 409, 'Assigned workers must complete the field task before it can be verified.');
    }

    const check = checkTaskTransition({ from: task.status, to, actorRole: req.user.role });
    if (!check.ok) return fail(res, check.status, check.message);

    if (['accepted', 'in_progress', 'blocked'].includes(to) && !bookedWorkerIds(task).length) {
      return fail(res, 409, 'Assign at least one worker before moving the task forward.');
    }

    const previousStatus = task.status;
    task.status = to;
    task.timeline.push({
      status: to,
      actor: req.user._id,
      actorRole: req.user.role,
      note: String(req.body.note || '').slice(0, 500)
    });

    if (to === 'blocked') {
      task.blockedInfo = {
        reason: String(req.body.reason || '').slice(0, 200),
        description: String(req.body.description || req.body.note || '').slice(0, 1000),
        resourceNeeded: String(req.body.resourceNeeded || '').slice(0, 300),
        reportedAt: new Date(),
        resolvedAt: null
      };
    } else if (previousStatus === 'blocked') {
      task.blockedInfo.resolvedAt = new Date();
    }
    if (to === 'completed') {
      task.completion.completedAt = new Date();
      task.progressPercent = 100;
    }
    await task.save();

    await auditLog(req.user, taskAuditAction(to), 'task', task._id, task.title, `${previousStatus} → ${to}`, { previousStatus, newStatus: to });

    // A closed task frees its people — but only those who hold nothing else.
    if (['completed', 'cancelled', 'rejected'].includes(to)) {
      await releaseTaskWorkers(task, { actor: req.user });
      task.assignedWorker = null;
      task.workerIds = [];
      await task.save();
      if (task.team) await DepartmentTeam.updateOne({ _id: task.team._id || task.team }, { $set: { status: 'available' } });
    }

    // Keep the citizen-facing case in step with the field work.
    const report = await Report.findById(task.report);
    const stageFor = {
      team_formed: 'TEAM_FORMED',
      accepted: 'ACCEPTED',
      in_progress: 'IN_PROGRESS',
      blocked: 'BLOCKED',
      on_hold: 'ON_HOLD',
      completed: 'COMPLETED',
      verified: 'PENDING_VERIFICATION',
      cancelled: 'CANCELLED'
    };
    const nextStage = stageFor[to];
    if (report && nextStage) {
      const stageChanged = applyReportStage(report, nextStage, req.user, req.body.note);
      if (stageChanged) {
        if (nextStage === 'COMPLETED') {
          // The team is finished. Record the completion the citizen will see and
          // hand the case to the verification queue.
          if (!report.completionReport?.submittedAt) {
            report.completionReport = {
              summary: String(req.body.note || task.title || 'Field work completed.').slice(0, 1200),
              materials: '',
              notes: '',
              beforeImages: [],
              afterImages: [],
              submittedBy: req.user._id,
              submittedAt: new Date(),
              verificationStatus: 'submitted'
            };
          }
          if (['pending', 'verified', 'assigned', 'in_progress', 'under_review'].includes(report.status)) report.status = 'completed';
          report.activity.push({ action: 'Field work completed by the response team', actorRole: req.user.role, note: String(req.body.note || '').slice(0, 500) });
          applyReportStage(report, 'PENDING_VERIFICATION', req.user, 'Awaiting Department Officer verification.');
        }
        await report.save();
        const citizenUpdate = {
          team_formed: `A response team has been assigned to "${report.title}".`,
          accepted: `Work on "${report.title}" has been accepted by the field team.`,
          in_progress: `Field work has started for "${report.title}".`,
          completed: `Field work is complete for "${report.title}" and is awaiting verification.`,
          verified: `The Team Leader verified work on "${report.title}".`
        }[to];
        if (citizenUpdate) await notifyMasterCaseReporters(report, citizenUpdate);
      }
      if (to === 'verified') {
        const departmentOfficer = report.assignedDepartmentOfficer;
        if (departmentOfficer) {
          await notify(departmentOfficer, `Team Leader verified field work for "${report.title}". The case is ready for Department Officer review.`, report._id);
        }
      }
    }
    if (report && ['cancelled', 'rejected'].includes(to)
      && String(report.activeTask?._id || report.activeTask || '') === String(task._id)) {
      report.activeTask = null;
      await report.save();
    }
    if (to === 'verified') {
      await Promise.all(task.workerAssignments.map((assignment) =>
        notify(assignment.worker?._id || assignment.worker, `Your field task "${task.title}" was verified by the Team Leader.`, task.report)
      ));
    }

    emitDepartmentEvent('TASK_STATUS_CHANGED', {
      taskId: task._id,
      caseId: task.report,
      status: to,
      previousStatus,
      departmentName: task.departmentName
    }, {
      userIds: to === 'verified'
        ? task.workerAssignments.map((assignment) => assignment.worker?._id || assignment.worker)
        : [],
      department: task.departmentName
    });

    return res.json({ success: true, message: `Task moved to ${to}.`, task });
  } catch (error) { next(error); }
}

export async function submitTaskProgress(req, res, next) {
  try {
    const task = await loadOperationalTask(req, res);
    if (!task) return;
    const onTask = bookedWorkerIds(task).some((id) => id.equals(req.user._id));
    if (!onTask && !canStaffTask(req.user, task)) {
      return fail(res, 403, 'Only a worker on this task can report progress.');
    }
    if (!isOpenTaskState(task.status)) {
      return fail(res, 409, `Task is ${task.status} and no longer accepts progress.`);
    }

    const kind = String(req.body.kind || 'progress').trim();
    if (!['progress', 'inspection', 'material', 'problem', 'blocked', 'note'].includes(kind)) {
      return fail(res, 422, 'Choose a valid field update type.');
    }
    const note = String(req.body.note || '').trim();
    const percent = req.body.progressPercent === undefined ? null : Number(req.body.progressPercent);
    if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) {
      return fail(res, 422, 'progressPercent must be between 0 and 100.');
    }
    const assignment = workerAssignmentFor(task, req.user._id);
    if (req.user.role === 'field_worker' && (!assignment || assignment.status !== 'in_progress')) {
      return fail(res, 409, 'Start your assigned field work before submitting an update.');
    }
    if (req.user.role === 'field_worker' && task.status !== 'in_progress') {
      return fail(res, 409, 'Field updates are available while the task is actively in progress.');
    }
    if (assignment && percent !== null && percent < assignment.progressPercent) {
      return fail(res, 409, 'Progress cannot move backwards from your last update.');
    }
    if (kind !== 'blocked' && note.length < 3) {
      return fail(res, 422, 'Add a field note of at least 3 characters.');
    }
    const reason = String(req.body.reason || '').trim();
    const description = String(req.body.description || '').trim();
    if (kind === 'blocked' && (!reason || (description || note).length < 3)) {
      return fail(res, 422, 'A blocker type and a description of at least 3 characters are required.');
    }
    if (kind === 'blocked' && percent !== null) {
      return fail(res, 422, 'Submit progress and blockers as separate field updates.');
    }
    if (percent !== null && task.status === 'blocked') {
      return fail(res, 409, 'Progress can be updated after the Team Leader clears the blocker.');
    }
    const blockerTransition = kind === 'blocked' && task.status !== 'blocked'
      ? checkTaskTransition({ from: task.status, to: 'blocked', actorRole: req.user.role })
      : { ok: true };
    if (!blockerTransition.ok) return fail(res, blockerTransition.status, blockerTransition.message);

    const latitude = req.body.latitude === undefined || req.body.latitude === null || req.body.latitude === '' ? null : Number(req.body.latitude);
    const longitude = req.body.longitude === undefined || req.body.longitude === null || req.body.longitude === '' ? null : Number(req.body.longitude);
    if ((latitude === null) !== (longitude === null)
      || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
      || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      return fail(res, 422, 'Provide valid latitude and longitude coordinates together.');
    }

    const rawEvidence = req.body.evidence ?? [];
    if (!Array.isArray(rawEvidence) || rawEvidence.length > 10) {
      return fail(res, 422, 'Evidence must contain no more than 10 uploaded files.');
    }
    const evidence = [];
    for (const item of rawEvidence) {
      let parsed;
      try { parsed = new URL(String(item?.url || '')); } catch { return fail(res, 422, 'Evidence contains an invalid URL.'); }
      if (!['http:', 'https:'].includes(parsed.protocol)) return fail(res, 422, 'Evidence URLs must use HTTPS or HTTP.');
      evidence.push({
        url: parsed.href.slice(0, 500),
        filename: String(item.filename || '').slice(0, 200),
        mediaType: item.mediaType === 'video' ? 'video' : 'image'
      });
    }

    const update = await DepartmentTaskUpdate.create({
      task: task._id,
      report: task.report,
      departmentName: task.departmentName,
      worker: req.user._id,
      kind,
      note: note.slice(0, 1000),
      progressPercent: percent ?? undefined,
      blocker: kind === 'blocked' ? {
        reason: reason.slice(0, 200),
        detail: String(description || note).slice(0, 1000),
        resourceNeeded: String(req.body.resourceNeeded || '').slice(0, 300)
      } : undefined,
      evidence,
      location: {
        latitude,
        longitude
      }
    });

    if (percent !== null && percent > (task.progressPercent || 0)) {
      task.progressPercent = percent;
    }
    if (assignment && percent !== null) {
      assignment.progressPercent = percent;
      assignment.updatedAt = new Date();
    }
    if (kind === 'blocked' && task.status !== 'blocked') {
      task.status = 'blocked';
      task.blockedInfo = {
        reason: reason.slice(0, 200),
        description: String(description || note).slice(0, 1000),
        resourceNeeded: String(req.body.resourceNeeded || '').slice(0, 300),
        reportedAt: new Date(),
        resolvedAt: null
      };
    }
    task.timeline.push({
      status: task.status,
      actor: req.user._id,
      actorRole: req.user.role,
      note: kind === 'blocked' ? `${reason}: ${String(description || note).slice(0, 300)}` : `${note}${percent !== null ? ` · ${percent}%` : ''}`
    });
    await task.save();

    await auditLog(req.user, kind === 'blocked' ? 'TASK_BLOCKED' : 'PROGRESS_UPDATED', 'task', task._id, task.title,
      `${kind}${percent !== null ? ` — ${percent}%` : ''}${note ? ` — ${note.slice(0, 120)}` : ''}`,
      { workerId: String(req.user._id), progressPercent: percent ?? null, evidenceCount: evidence.length });

    if (kind === 'blocked') {
      const report = await Report.findById(task.report);
      if (report) {
        if (applyReportStage(report, 'BLOCKED', req.user, `${reason}: ${description || note}`)) {
          report.activity.push({ action: 'Field task blocker reported', actorRole: req.user.role, note: `${reason}: ${String(description || note).slice(0, 300)}` });
          await report.save();
        }
      }
    }

    const teamLeaderId = task.teamLeader?._id || task.teamLeader || task.assignedOfficer?._id || task.assignedOfficer;
    await notify(teamLeaderId, `${req.user.name} reported ${label(kind)} on "${task.title}".`, task.report);
    emitDepartmentEvent('PROGRESS_UPDATED', {
      taskId: task._id,
      caseId: task.report,
      workerId: req.user._id,
      kind,
      progressPercent: percent,
      departmentName: task.departmentName
    }, { userIds: [teamLeaderId].filter(Boolean), department: task.departmentName });

    return res.status(201).json({ success: true, message: 'Progress recorded.', update });
  } catch (error) { next(error); }
}

/** GET /tasks/:id/updates — the field timeline, newest first. */
export async function listTaskUpdates(req, res, next) {
  try {
    const task = await loadOperationalTask(req, res);
    if (!task) return;
    const updates = await DepartmentTaskUpdate.find({ task: task._id })
      .populate('worker', 'name role')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, updates });
  } catch (error) { next(error); }
}

/** GET /workers/available — who this Officer may book right now. */
export async function availableWorkers(req, res, next) {
  try {
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return fail(res, 403, 'Your account is not attached to a department.');
    let workers = await workerWorkload({ departmentName });
    const only = String(req.query.availability || '').trim();
    if (req.query.teamId) {
      if (!mongoose.Types.ObjectId.isValid(String(req.query.teamId))) {
        return fail(res, 400, 'Select a valid team.');
      }
      const team = await DepartmentTeam.findOne({
        _id: req.query.teamId,
        departmentName,
        active: true
      }).populate('members', 'role departmentName status');
      if (!team) return fail(res, 404, 'The selected team is inactive or belongs to another department.');
      const validMemberIds = new Set(team.members
        .filter((member) => member.role === 'field_worker' && member.status === 'active' && member.departmentName === departmentName)
        .map((member) => String(member._id)));
      workers = workers.filter((worker) => validMemberIds.has(String(worker._id)));
    }
    const total = workers.length;
    const available = workers.filter((worker) => worker.availability === 'available');
    const unavailableCount = total - available.length;
    const reason = available.length
      ? ''
      : total
        ? `No workers are currently available${only ? ` with ${only.replaceAll('_', ' ')} status` : ''}. ${unavailableCount} eligible worker(s) are busy or off duty.`
        : req.query.teamId
          ? 'The selected team has no active field workers assigned in this department.'
          : 'No active field workers are assigned to this department.';
    return res.json({
      success: true,
      workers: only ? available.filter((worker) => worker.availability === only) : available,
      total,
      availableCount: available.length,
      unavailableCount,
      reason
    });
  } catch (error) { next(error); }
}

/** GET /officers/available — workload board for department management. */
export async function officerWorkload(req, res, next) {
  try {
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return fail(res, 403, 'Your account is not attached to a department.');
    const officers = await User.find({ departmentName, role: 'officer', status: 'active' })
      .select('name role availability availabilityChangedAt')
      .lean();
    const active = await DepartmentTask.find({
      assignedOfficer: { $in: officers.map((officer) => officer._id) },
      status: { $nin: ['completed', 'verified', 'cancelled', 'rejected'] }
    }).select('taskNumber title status assignedOfficer');
    return res.json({
      success: true,
      officers: officers.map((officer) => {
        const tasks = active.filter((task) => String(task.assignedOfficer) === String(officer._id));
        return {
          _id: officer._id,
          name: officer.name,
          role: officer.role,
          activeTasks: tasks.length,
          workload: tasks.map((task) => ({ id: task._id, taskNumber: task.taskNumber, title: task.title, status: task.status })),
          status: tasks.length ? 'busy' : 'available'
        };
      })
    });
  } catch (error) { next(error); }
}

/** GET /workers/:id/assignments — what a worker is currently holding. */
export async function workerAssignments(req, res, next) {
  try {
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return fail(res, 403, 'Your account is not attached to a department.');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, 'Invalid worker id.');
    if (req.user.role === 'field_worker' && String(req.params.id) !== String(req.user._id)) {
      return fail(res, 403, 'You can only view your own assignments.');
    }
    const worker = await User.findOne({ _id: req.params.id, departmentName, role: 'field_worker' })
      .select('name role availability activeTask');
    if (!worker) return fail(res, 404, 'Worker not found in your department.');
    const teams = await DepartmentTeam.find({ departmentName, members: worker._id }).distinct('_id');
    const reports = await Report.find({ departmentName }).distinct('_id');
    const tasks = await DepartmentTask.find({
      departmentName,
      report: { $in: reports },
      $or: [
        { assignedWorker: worker._id },
        { workerIds: worker._id },
        { 'workerAssignments.worker': worker._id },
        { team: { $in: teams } }
      ],
      status: { $nin: ['completed', 'verified', 'cancelled', 'rejected'] }
    }).select('taskNumber title status team assignedWorker');
    return res.json({ success: true, worker, activeTasks: tasks, available: worker.availability === 'available' && !tasks.length });
  } catch (error) { next(error); }
}

/** PATCH /workers/:id/availability — a worker sets their own duty status. */
export async function setWorkerAvailability(req, res, next) {
  try {
    const next = String(req.body.availability || '').trim();
    if (!['available', 'off_duty', 'on_leave', 'unavailable'].includes(next)) {
      return fail(res, 422, 'availability must be available, off_duty, on_leave or unavailable.');
    }
    if (String(req.user._id) !== String(req.params.id) && !MANAGEMENT_ROLES.includes(req.user.role)) {
      return fail(res, 403, 'You can only change your own availability.');
    }
    const worker = await User.findOne({ _id: req.params.id, departmentName: departmentNameFor(req.user), role: 'field_worker' });
    if (!worker) return fail(res, 404, 'Worker not found in your department.');

    // A worker mid-task cannot simply declare themselves free; the task must
    // be closed first, otherwise the booking would lie.
    if (next === 'available' && worker.availability === 'busy') {
      const open = await DepartmentTask.exists({
        $or: [{ assignedWorker: worker._id }, { workerIds: worker._id }],
        status: { $nin: ['completed', 'verified', 'cancelled', 'rejected'] }
      });
      if (open) return fail(res, 409, 'Finish or be released from your current task before going available.');
    }
    worker.availability = next;
    worker.availabilityChangedAt = new Date();
    await worker.save();
    await auditLog(req.user, 'WORKER_AVAILABILITY_CHANGED', 'user', worker._id, worker.name, `availability → ${next}`);
    return res.json({ success: true, message: `Availability set to ${next}.`, worker });
  } catch (error) { next(error); }
}

export async function departmentWorkload(req, res, next) {
  try {
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return fail(res, 403, 'Your account is not attached to a department.');
    const [workers, officers, teams] = await Promise.all([
      workerWorkload({ departmentName }),
      User.find({ departmentName, role: 'officer', status: 'active' }).select('name').lean(),
      DepartmentTeam.find({ departmentName, active: true }).select('name type status members capacity').lean()
    ]);
    return res.json({ success: true, departmentName, workers, officerCount: officers.length, teams });
  } catch (error) { next(error); }
}
