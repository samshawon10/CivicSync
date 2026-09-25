import test from 'node:test';
import assert from 'node:assert/strict';
import { departmentTaskAccess } from './departmentTaskAccess.js';

const task = { departmentName: 'Roads', assignedWorker: 'worker-1' };

test('department task access is limited to the matching department', () => {
  assert.equal(departmentTaskAccess.canAccess({ _id: 'head-1', role: 'department_head', departmentName: 'Roads' }, task), true);
  assert.equal(departmentTaskAccess.canAccess({ _id: 'head-2', role: 'department_head', departmentName: 'Water' }, task), false);
});

test('field workers can only access their assigned tasks', () => {
  assert.equal(departmentTaskAccess.canAccess({ _id: 'worker-1', role: 'field_worker', departmentName: 'Roads' }, task), true);
  assert.equal(departmentTaskAccess.canAccess({ _id: 'worker-2', role: 'field_worker', departmentName: 'Roads' }, task), false);
});

test('management and assigned workers can manage tasks, unrelated staff cannot', () => {
  assert.equal(departmentTaskAccess.canManage({ _id: 'officer-1', role: 'department_officer', departmentName: 'Roads' }, task), true);
  assert.equal(departmentTaskAccess.canManage({ _id: 'worker-1', role: 'field_worker', departmentName: 'Roads' }, task), true);
  assert.equal(departmentTaskAccess.canManage({ _id: 'worker-2', role: 'field_worker', departmentName: 'Roads' }, task), false);
  assert.equal(departmentTaskAccess.canManage({ _id: 'officer-1', role: 'department_officer', departmentName: 'Water' }, task), false);
});
