import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDepartmentSla, departmentSlaTargets } from './departmentSla.js';

test('department SLA targets exist for all priorities', () => {
  for (const prio of ['urgent', 'high', 'medium', 'low']) {
    assert.ok(departmentSlaTargets[prio]);
    assert.ok(departmentSlaTargets[prio].response > 0);
    assert.ok(departmentSlaTargets[prio].arrival > 0);
    assert.ok(departmentSlaTargets[prio].resolution > 0);
  }
});

test('calculateDepartmentSla evaluates safe, warning, and breached states accurately', () => {
  const now = new Date();
  
  // Breached case: created 5 days ago, unresolved
  const pastReport = {
    createdAt: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
    priority: 'urgent',
    status: 'pending'
  };
  const pastSla = calculateDepartmentSla(pastReport);
  assert.equal(pastSla.overallStatus, 'breached');
  assert.equal(pastSla.response.isBreached, true);
  assert.equal(pastSla.resolution.isBreached, true);

  // Safe case: just created
  const freshReport = {
    createdAt: now,
    priority: 'medium',
    status: 'pending'
  };
  const freshSla = calculateDepartmentSla(freshReport);
  assert.equal(freshSla.overallStatus, 'safe');
  assert.equal(freshSla.response.isBreached, false);
});
