import test from 'node:test';
import assert from 'node:assert/strict';
import { emergencyDepartmentConflict, sameDepartment } from './emergencyDepartmentAccess.js';

test('emergency assignment validates department IDs for raw and populated references', () => {
  assert.equal(sameDepartment({ _id: 'a' }, 'a'), true);
  assert.equal(sameDepartment(null, null), false);
  assert.equal(emergencyDepartmentConflict({ assignedDepartment: 'a' }, { department: 'a' }), null);
  assert.match(emergencyDepartmentConflict({ assignedDepartment: 'a' }, { department: 'b' }), /assigned department/);
  assert.match(emergencyDepartmentConflict({}, { department: 'b' }, { department: 'a' }), /supervising/);
  assert.match(emergencyDepartmentConflict({}, {}), /must belong/);
});
