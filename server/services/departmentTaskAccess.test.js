import test from 'node:test';
import assert from 'node:assert/strict';
import { departmentTaskAccess } from './departmentTaskAccess.js';

const task = { departmentName: 'Roads', assignedWorker: 'worker-1' };
const teamTask = { ...task, workerIds: ['worker-2'], workerAssignments: [{ worker: 'worker-2' }] };

test('department task access is limited to the matching department', () => {
  assert.equal(departmentTaskAccess.canAccess({ _id: 'head-1', role: 'department_head', departmentName: 'Roads' }, task), true);
  assert.equal(departmentTaskAccess.canAccess({ _id: 'head-2', role: 'department_head', departmentName: 'Water' }, task), false);
});

test('field workers can only access their assigned tasks', () => {
  assert.equal(departmentTaskAccess.canAccess({ _id: 'worker-1', role: 'field_worker', departmentName: 'Roads' }, task), true);
  assert.equal(departmentTaskAccess.canAccess({ _id: 'worker-2', role: 'field_worker', departmentName: 'Roads' }, task), false);
  assert.equal(departmentTaskAccess.canAccess({ _id: 'worker-2', role: 'field_worker', departmentName: 'Roads' }, teamTask), true);
  assert.equal(departmentTaskAccess.canAccess({ _id: 'worker-3', role: 'field_worker', departmentName: 'Roads' }, { ...teamTask, team: { departmentName: 'Roads', members: ['worker-3'] } }), false);
});

test('only department management or the task Team Leader can manage tasks', () => {
  assert.equal(departmentTaskAccess.canManage({ _id: 'officer-1', role: 'department_officer', departmentName: 'Roads' }, task), true);
  assert.equal(departmentTaskAccess.canManage({ _id: 'worker-1', role: 'field_worker', departmentName: 'Roads' }, task), false);
  assert.equal(departmentTaskAccess.canManage({ _id: 'worker-2', role: 'field_worker', departmentName: 'Roads' }, task), false);
  assert.equal(departmentTaskAccess.canManage({ _id: 'officer-1', role: 'department_officer', departmentName: 'Water' }, task), false);
  assert.equal(departmentTaskAccess.canManage({ _id: 'leader-1', role: 'officer', departmentName: 'Roads' }, { ...task, teamLeader: 'leader-1' }), true);
  assert.equal(departmentTaskAccess.canManage({ _id: 'leader-2', role: 'officer', departmentName: 'Roads' }, { ...task, teamLeader: 'leader-1' }), false);
});

test('Team Leaders can access only tasks assigned to them', () => {
  const leader = { _id: 'leader-1', role: 'officer', departmentName: 'Roads' };
  assert.equal(departmentTaskAccess.canAccess(leader, { ...task, assignedOfficer: 'leader-1' }), true);
  assert.equal(departmentTaskAccess.canAccess(leader, { ...task, teamLeader: 'leader-1' }), true);
  assert.equal(departmentTaskAccess.canAccess(leader, { ...task, assignedOfficer: 'leader-2', teamLeader: 'leader-2' }), false);
  assert.equal(departmentTaskAccess.canAccess({ ...leader, role: 'department_head' }, task), true);
});
