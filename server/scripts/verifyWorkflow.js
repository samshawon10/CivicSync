/**
 * End-to-end check of the citizen → department → field → verification chain.
 *
 * It boots nothing itself: start the API first (`npm run start`) and then run
 * `node scripts/verifyWorkflow.js`. Every record it creates is removed again,
 * so the seeded demo case stays untouched and the script can be re-run freely.
 */
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const BASE = `http://127.0.0.1:${process.env.SMOKE_PORT || process.env.PORT || 5000}/api`;
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
};

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json response */ }
  return { status: res.status, json };
};

const accounts = {
  citizen: 'citizen@civicsync.demo',
  head: 'road.head@civicsync.demo',
  officer: 'road.officer@civicsync.demo',
  leader: 'road.leader@civicsync.demo',
  worker: 'road.worker1@civicsync.demo'
};

const created = { reports: [], tasks: [] };
let exitCode = 0;

try {
  const { connectDatabase } = await import('../config/database.js');
  await connectDatabase();
  const User = (await import('../models/User.js')).default;
  const Report = (await import('../models/Report.js')).default;
  const DepartmentTeam = (await import('../models/DepartmentTeam.js')).default;

  const users = {};
  for (const [key, email] of Object.entries(accounts)) {
    users[key] = await User.findOne({ email });
    if (!users[key]) throw new Error(`Missing demo account ${email}. Run: npm run seed:demo`);
  }
  const tok = (user) => jwt.sign(
    { userId: user._id, firebaseUid: `wf-${user._id}`, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const token = Object.fromEntries(Object.entries(users).map(([key, user]) => [key, tok(user)]));

  const team = await DepartmentTeam.findOne({ departmentName: users.head.departmentName, active: true }).lean();
  if (!team) throw new Error('No active team in the demo department.');

  const report = await Report.create({
    title: 'Workflow verification pothole',
    description: 'Automated end-to-end workflow verification case. Safe to delete.',
    category: 'roads_and_highways',
    departmentName: users.head.departmentName,
    priority: 'high',
    status: 'pending',
    workflowStage: 'SUBMITTED',
    workflowHistory: [{ stage: 'SUBMITTED', actor: users.citizen._id, actorRole: 'citizen', note: 'Case submitted.' }],
    location: { address: 'Verification Street 1', area: 'Demo Area', latitude: 23.7806, longitude: 90.4074 },
    media: [],
    createdBy: users.citizen._id
  });
  created.reports.push(report._id);
  const reference = report.reference;
  check('report created with a citizen reference', Boolean(reference), reference);

  const stageOf = async () => (await Report.findById(report._id).lean())?.workflowStage;

  // 1 — the citizen sees the reference and the submitted stage.
  const seen = await call('GET', `/reports/${report._id}`, { token: token.citizen });
  check('citizen sees reference + submitted stage',
    seen.status === 200 && seen.json?.report?.reference === reference && seen.json?.report?.workflowStage === 'SUBMITTED',
    `ref=${seen.json?.report?.reference} stage=${seen.json?.report?.workflowStage}`);

  // 2 — the Department Head starts the review.
  const review = await call('POST', `/departments/reports/${report._id}/review`, { token: token.head, body: { note: 'Desk review started.' } });
  check('head review → DEPARTMENT_HEAD_REVIEW',
    review.status === 200 && review.json?.report?.workflowStage === 'DEPARTMENT_HEAD_REVIEW',
    `status=${review.status} stage=${review.json?.report?.workflowStage || review.json?.message}`);

  // 3 — the head hands the case to the Department Officer.
  const toOfficer = await call('PATCH', `/departments/reports/${report._id}/assign`, { token: token.head, body: { departmentOfficerId: users.officer._id } });
  check('head assignment → ASSIGNED_TO_DEPARTMENT_OFFICER',
    toOfficer.status === 200 && toOfficer.json?.report?.workflowStage === 'ASSIGNED_TO_DEPARTMENT_OFFICER',
    `status=${toOfficer.status} stage=${toOfficer.json?.report?.workflowStage || toOfficer.json?.message}`);

  // 4 — the officer hands it to the Team Leader (officer review is optional).
  const toLeader = await call('PATCH', `/departments/reports/${report._id}/assign`, { token: token.officer, body: { officerId: users.leader._id } });
  check('officer assignment → ASSIGNED_TO_OFFICER',
    toLeader.status === 200 && toLeader.json?.report?.workflowStage === 'ASSIGNED_TO_OFFICER',
    `status=${toLeader.status} stage=${toLeader.json?.report?.workflowStage || toLeader.json?.message}`);

  // 5 — the Team Leader creates the task and forms the team.
  const taskRes = await call('POST', '/departments/tasks', {
    token: token.leader,
    body: { reportId: report._id, title: 'Repair verification pothole', instructions: 'Patch and photograph.' }
  });
  const taskId = taskRes.json?.task?._id;
  if (taskId) created.tasks.push(taskId);
  check('team leader creates the field task', taskRes.status === 201 && Boolean(taskId),
    `status=${taskRes.status} ${taskRes.json?.message || ''}`);

  const teamRes = await call('POST', `/departments/tasks/${taskId}/team`, { token: token.leader, body: { teamId: team._id } });
  check('team formation → TEAM_FORMED on the case',
    teamRes.status === 200 && (await stageOf()) === 'TEAM_FORMED',
    `status=${teamRes.status} stage=${await stageOf()} ${teamRes.json?.message || ''}`);

  // 6 — the field work runs and the case timeline follows it.
  const accepted = await call('PATCH', `/departments/tasks/${taskId}/transition`, { token: token.worker, body: { status: 'accepted', note: 'Team en route.' } });
  check('worker accepted the task', accepted.status === 200, `status=${accepted.status} ${accepted.json?.message || ''}`);
  const started = await call('PATCH', `/departments/tasks/${taskId}/transition`, { token: token.worker, body: { status: 'in_progress', note: 'Patching started.' } });
  check('field work started → IN_PROGRESS on the case',
    started.status === 200 && (await stageOf()) === 'IN_PROGRESS',
    `status=${started.status} stage=${await stageOf()} ${started.json?.message || ''}`);

  // 7 — completion lands in the verification queue.
  const done = await call('POST', `/departments/tasks/${taskId}/complete`, {
    token: token.worker,
    body: { summary: 'Pothole patched and compacted.', result: 'Repaired', materialsUsed: 'Cold mix asphalt', remainingIssues: 'None' }
  });
  check('field completion → PENDING_VERIFICATION',
    done.status === 200 && (await stageOf()) === 'PENDING_VERIFICATION',
    `status=${done.status} stage=${await stageOf()} ${done.json?.message || ''}`);

  // 8 — the verification decision belongs to the Department Officer only.
  const wrongRole = await call('PATCH', `/departments/reports/${report._id}/completion-review`, { token: token.head, body: { verificationStatus: 'verified', note: 'should be refused' } });
  check('only the Department Officer can verify', wrongRole.status === 403, `status=${wrongRole.status} ${wrongRole.json?.message || ''}`);

  const verified = await call('PATCH', `/departments/reports/${report._id}/completion-review`, { token: token.officer, body: { verificationStatus: 'verified', note: 'Evidence checked against site photos.' } });
  check('officer verification → VERIFIED',
    verified.status === 200 && verified.json?.report?.workflowStage === 'VERIFIED',
    `status=${verified.status} stage=${verified.json?.report?.workflowStage || verified.json?.message}`);

  const premature = await call('PATCH', `/departments/reports/${report._id}/completion-review`, { token: token.officer, body: { verificationStatus: 'approved', note: 'should be refused' } });
  check('only the Department Head can resolve', premature.status === 403, `status=${premature.status} ${premature.json?.message || ''}`);

  // 9 — the Department Head resolves the case.
  const resolved = await call('PATCH', `/departments/reports/${report._id}/completion-review`, { token: token.head, body: { verificationStatus: 'approved', note: 'Works signed off.' } });
  check('head approval → RESOLVED and closed',
    resolved.status === 200 && resolved.json?.report?.workflowStage === 'RESOLVED' && resolved.json?.report?.status === 'closed',
    `status=${resolved.status} stage=${resolved.json?.report?.workflowStage} reportStatus=${resolved.json?.report?.status}`);

  // 10 — the citizen timeline shows the whole chain.
  const final = await call('GET', `/reports/${report._id}`, { token: token.citizen });
  const stages = (final.json?.report?.workflowHistory || []).map((entry) => entry.stage);
  check('citizen timeline records the full chain',
    ['SUBMITTED', 'DEPARTMENT_HEAD_REVIEW', 'ASSIGNED_TO_DEPARTMENT_OFFICER', 'ASSIGNED_TO_OFFICER', 'TEAM_FORMED', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'VERIFIED', 'RESOLVED']
      .every((stage) => stages.includes(stage)),
    stages.join(' → '));
} catch (error) {
  exitCode = 1;
  console.error('Workflow verification crashed ::', error?.message || error);
} finally {
  try {
    const mongoose = (await import('mongoose')).default;
    const Report = (await import('../models/Report.js')).default;
    const DepartmentTask = (await import('../models/DepartmentTask.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    if (created.reports.length) {
      await DepartmentTask.deleteMany({ report: { $in: created.reports } });
      const removed = await Notification.deleteMany({ report: { $in: created.reports } });
      await Report.deleteMany({ _id: { $in: created.reports } });
      console.log(`\nCleaned up ${created.reports.length} verification case(s), ${created.tasks.length} task(s) and ${removed.deletedCount} notification(s).`);
    }
    await mongoose.disconnect();
  } catch { /* the API holds its own connection */ }
}

const failed = results.filter((pass) => !pass).length;
console.log(`\n${results.length - failed}/${results.length} workflow checks passed.`);
process.exit(failed || exitCode ? 1 : 0);
