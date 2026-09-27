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
  await Notification.create({ recipient, report, type: 'report_status', message }).catch(() => {});
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
    .populate('team', 'name type members status');
  if (!task || task.departmentName !== departmentName) return fail(res, 404, 'Task not found.');

  if (MANAGEMENT_ROLES.includes(req.user.role)) return task;
  if (req.user.role === 'officer' && task.assignedOfficer?.equals?.(req.user._id)) return task;
  if (req.user.role === 'field_worker') {
    const onTask = task.assignedWorker?.equals?.(req.user._id)
      || task.workerIds?.some?.((worker) => worker?._id?.equals?.(req.user._id))
      || task.team?.members?.some?.((member) => member?.equals?.(req.user._id));
    if (onTask) return task;
  }
  return fail(res, 404, 'Task not found.');
}

function canStaffTask(user, task) {
  return user.role === 'officer' && task.assignedOfficer?.equals?.(user._id);
}

function requireStaffingAuthority(user, task, res) {
  if (!canStaffTask(user, task)) {
    return fail(res, 403, 'Only the Officer who owns this task can assign workers or teams.');
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

/** Minimal response stand-in for service calls whose result we already know. */
const ignoreResponse = { status: () => ignoreResponse, json: () => ignoreResponse };

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

    // A closed task can never take more staff.
    if (!isOpenTaskState(task.status)) {
      return fail(res, 409, `Task is ${task.status} and cannot take new workers.`);
    }

    // Authority + same-department + active, decided by the service.
    const worker = await resolveAssignableTarget({ actor: req.user, targetUserId: workerId, res });
    if (!worker) return;

    if (bookedWorkerIds(task).some((id) => id.equals(worker._id))) {
      return fail(res, 409, 'That worker is already on this task.');
    }

    // Atomic booking — the loser of a race gets 409 here.
    const booked = await bookWorker({ workerId: worker._id, taskId: task._id, res });
    if (!booked) return;

    if (task.assignedWorker) task.workerIds.push(worker._id);
    else task.assignedWorker = worker._id;
    task.status = task.status === 'pending' ? 'assigned' : task.status;
    task.timeline.push({ status: task.status, actor: req.user._id, actorRole: req.user.role, note: `Worker assigned: ${worker.name}` });
    await task.save();

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

    const user = await releaseWorker({ workerId, res });
    if (!user) return;

    if (isPrimary) {
      // Promote the next member so the task always has a lead worker.
      const next = task.workerIds.shift();
      task.assignedWorker = next?._id || next || null;
    } else {
      task.workerIds = task.workerIds.filter((worker) => String(worker._id || worker) !== String(workerId));
    }
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
    if (!isOpenTaskState(task.status)) {
      return fail(res, 409, `Task is ${task.status} and cannot take a team.`);
    }
    const { teamId } = req.body;
    const team = await DepartmentTeam.findOne({ _id: teamId, departmentName: task.departmentName, active: true })
      .populate('members', 'name role availability');
    if (!team) return fail(res, 404, 'That team is not active in this department.');

    const already = bookedWorkerIds(task).map(String);
    const toBook = (team.members || []).filter((member) => !already.includes(String(member._id)));
    if (!toBook.length) return fail(res, 409, 'Every member of that team is already on this task.');

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
    task.teamLeader = team.leader || null;
    if (!task.assignedWorker) task.assignedWorker = booked[0]._id;
    task.workerIds.push(...booked.map((worker) => worker._id));
    task.status = 'team_formed';
    task.timeline.push({ status: 'team_formed', actor: req.user._id, actorRole: req.user.role, note: `${team.type === 'roster' ? 'Roster' : 'Normal'} team "${team.name}" attached (${booked.length} worker(s)).` });
    await task.save();
    await team.updateOne({ $set: { status: 'busy' } });

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
    if (!task.team) return fail(res, 409, 'This task has no team attached.');

    const team = await DepartmentTeam.findById(task.team);
    const memberIds = new Set((team?.members || []).map(String));
    const toRelease = bookedWorkerIds(task).filter((id) => memberIds.has(String(id)));
    for (const id of toRelease) {
      await releaseWorker({ workerId: id, res: { status: () => ({ json: () => {} }) } });
    }
    task.team = null;
    task.teamLeader = null;
    task.workerIds = task.workerIds.filter((worker) => !memberIds.has(String(worker?._id || worker)));
    task.timeline.push({ status: task.status, actor: req.user._id, actorRole: req.user.role, note: 'Team detached and its workers released.' });
    await task.save();
    if (team) await team.updateOne({ $set: { status: 'available' } });

    await auditLog(req.user, 'TEAM_DETACHED', 'task', task._id, task.title, `Team released; ${toRelease.length} worker(s) freed.`);
    return res.json({ success: true, message: `Team detached, ${toRelease.length} worker(s) released.`, task });
  } catch (error) { next(error); }
}

export async function createTask(req, res, next) {
  try {
    const departmentName = departmentNameFor(req.user);
    if (!departmentName) return fail(res, 403, 'Your account is not attached to a department.');
    if (!['officer', ...MANAGEMENT_ROLES].includes(req.user.role)) {
      return fail(res, 403, 'Only an officer or department management can create a task.');
    }
    const report = await Report.findById(req.body.reportId);
    if (!report || report.departmentName !== departmentName) return fail(res, 404, 'Case not found.');

    if (req.user.role === 'officer' && !report.assignedOfficer?.equals?.(req.user._id)) {
      return fail(res, 403, 'This case is not assigned to you.');
    }
    if (report.workflowStage !== 'ASSIGNED_TO_OFFICER' && report.workflowStage !== 'TEAM_FORMED') {
      return fail(res, 409, `A case at ${report.workflowStage} cannot start operational work yet.`);
    }
    if (report.activeTask) return fail(res, 409, 'This case already has an active task.');

    const task = await DepartmentTask.create({
      report: report._id,
      taskNumber: `TASK-${String(Date.now()).slice(-6)}`,
      title: String(req.body.title || report.title).trim().slice(0, 180),
      description: String(req.body.description || report.description).trim().slice(0, 2000),
      departmentName,
      assignedOfficer: report.assignedOfficer,
      instructions: String(req.body.instructions || '').trim().slice(0, 2000),
      assignedBy: req.user._id,
      status: 'pending',
      priority: report.priority,
      location: {
        address: report.location?.address || report.location?.area || '',
        latitude: report.location?.latitude ?? null,
        longitude: report.location?.longitude ?? null
      },
      timeline: [{ status: 'pending', actor: req.user._id, actorRole: req.user.role, note: 'Task created from the citizen case.' }]
    });

    report.activeTask = task._id;
    await report.save();

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
      if (task.team) await DepartmentTeam.updateOne({ _id: task.team }, { $set: { status: 'available' } });
    }

    // Keep the citizen-facing case in step with the field work.
    const report = await Report.findById(task.report);
    const stageFor = { in_progress: 'IN_PROGRESS', blocked: 'BLOCKED', on_hold: 'ON_HOLD', completed: 'COMPLETED', cancelled: 'CANCELLED' };
    const nextStage = stageFor[to];
    if (report && nextStage) {
      const stageCheck = checkStageTransition({ from: report.workflowStage, to: nextStage, actorRole: req.user.role });
      if (stageCheck.ok) {
        report.workflowHistory.push({ stage: nextStage, previousStage: report.workflowStage, actor: req.user._id, actorRole: req.user.role, note: String(req.body.note || '').slice(0, 500) });
        report.workflowStage = nextStage;
        if (nextStage === 'COMPLETED' && ['pending', 'verified', 'assigned', 'in_progress'].includes(report.status)) {
          report.status = 'under_review';
        }
        await report.save();
      }
    }

    emitDepartmentEvent('TASK_STATUS_CHANGED', {
      taskId: task._id,
      caseId: task.report,
      status: to,
      previousStatus,
      departmentName: task.departmentName
    }, { department: task.departmentName });

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

    const kind = String(req.body.kind || 'progress').trim().slice(0, 40);
    const percent = req.body.progressPercent === undefined ? null : Number(req.body.progressPercent);
    if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) {
      return fail(res, 422, 'progressPercent must be between 0 and 100.');
    }
    const evidence = (Array.isArray(req.body.evidence) ? req.body.evidence : [])
      .filter((item) => item?.url)
      .slice(0, 10)
      .map((item) => ({
        url: String(item.url).slice(0, 500),
        filename: String(item.filename || '').slice(0, 200),
        mediaType: item.mediaType === 'video' ? 'video' : 'image'
      }));

    const update = await DepartmentTaskUpdate.create({
      task: task._id,
      report: task.report,
      departmentName: task.departmentName,
      worker: req.user._id,
      kind,
      note: String(req.body.note || '').slice(0, 1000),
      progressPercent: percent ?? undefined,
      blocker: kind === 'blocked' ? {
        reason: String(req.body.reason || '').slice(0, 200),
        detail: String(req.body.description || req.body.note || '').slice(0, 1000),
        resourceNeeded: String(req.body.resourceNeeded || '').slice(0, 300)
      } : undefined,
      evidence,
      location: {
        latitude: req.body.latitude === undefined ? null : Number(req.body.latitude),
        longitude: req.body.longitude === undefined ? null : Number(req.body.longitude)
      }
    });

    // Progress only ever moves forward within a task.
    if (percent !== null && percent > (task.progressPercent || 0)) {
      task.progressPercent = percent;
      task.timeline.push({ status: task.status, actor: req.user._id, actorRole: req.user.role, note: `Progress ${percent}%` });
      await task.save();
    }

    await auditLog(req.user, kind === 'blocked' ? 'TASK_BLOCKED' : 'PROGRESS_UPDATED', 'task', task._id, task.title,
      `${kind}${percent !== null ? ` — ${percent}%` : ''}${req.body.note ? ` — ${String(req.body.note).slice(0, 120)}` : ''}`,
      { workerId: String(req.user._id), progressPercent: percent ?? null, evidenceCount: evidence.length });

    // A blocker is a real state change, not just a note.
    if (kind === 'blocked' && task.status !== 'blocked') {
      const check = checkTaskTransition({ from: task.status, to: 'blocked', actorRole: 'field_worker' });
      if (check.ok) {
        task.status = 'blocked';
        task.blockedInfo = {
          reason: String(req.body.reason || '').slice(0, 200),
          description: String(req.body.description || req.body.note || '').slice(0, 1000),
          resourceNeeded: String(req.body.resourceNeeded || '').slice(0, 300),
          reportedAt: new Date(),
          resolvedAt: null
        };
        await task.save();
      }
    }

    // Progress goes to the Officer; the Officer reports upward.
    await notify(task.assignedOfficer, `${req.user.name} reported ${label(kind)} on "${task.title}".`, task.report);
    emitDepartmentEvent('PROGRESS_UPDATED', {
      taskId: task._id,
      caseId: task.report,
      workerId: req.user._id,
      kind,
      progressPercent: percent,
      departmentName: task.departmentName
    }, { userIds: [task.assignedOfficer], department: task.departmentName });

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
    const workers = await workerWorkload({ departmentName });
    const only = String(req.query.availability || '').trim();
    const filtered = only ? workers.filter((worker) => worker.availability === only) : workers;
    return res.json({ success: true, workers: filtered, total: workers.length });
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
      status: { $nin: ['completed', 'cancelled', 'rejected'] }
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
    const worker = await User.findOne({ _id: req.params.id, departmentName, role: { $in: ['field_worker', 'officer'] } })
      .select('name role availability activeTask');
    if (!worker) return fail(res, 404, 'Worker not found in your department.');
    const tasks = await DepartmentTask.find({
      $or: [{ assignedWorker: worker._id }, { workerIds: worker._id }, { 'team.members': worker._id }],
      status: { $nin: ['completed', 'cancelled', 'rejected'] }
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
        $or: [{ assignedWorker: worker._id }, { workerIds: worker._id }, { 'team.members': worker._id }],
        status: { $nin: ['completed', 'cancelled', 'rejected'] }
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