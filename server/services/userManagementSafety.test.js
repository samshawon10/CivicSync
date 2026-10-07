import test from 'node:test';
import assert from 'node:assert/strict';
import { userManagementConflict } from './userManagementSafety.js';

test('the active global head cannot be deleted, suspended, or demoted', () => {
  const user = { role: 'emergency_department_head', status: 'active', department: 'a' };
  for (const change of [{ deleting: true }, { status: 'suspended' }, { role: 'citizen' }, { department: 'b' }]) {
    assert.match(userManagementConflict(user, change), /Replace the global/);
  }
  assert.equal(userManagementConflict(user, {}), null);
});
test('staff with resource reservations must be released before administrative changes', () => {
  for (const reservation of [{ activeTask: 'task' }, { activeEmergencyTeam: 'team' }]) {
    const user = { role: 'field_worker', status: 'active', department: 'a', ...reservation };
    assert.match(userManagementConflict(user, { deleting: true }), /Release/);
    assert.match(userManagementConflict(user, { role: 'citizen' }), /Release/);
    assert.match(userManagementConflict(user, { status: 'suspended' }), /Release/);
    assert.equal(userManagementConflict(user, {}), null);
  }
});
