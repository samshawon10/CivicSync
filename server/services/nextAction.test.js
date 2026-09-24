import test from 'node:test';
import assert from 'node:assert/strict';
import { getEmergencyNextAction, getReportNextAction } from './nextAction.js';

test('report next action follows workflow ownership and keeps the configured due date', () => {
  const dueAt = new Date('2026-09-25T12:00:00Z');
  const action = getReportNextAction({ status: 'in_progress', assignedFieldWorker: 'worker-1', assignedOfficer: 'officer-1', dueAt, priority: 'high' });
  assert.equal(action.action, 'Submit completion report');
  assert.equal(action.responsibleRole, 'field_worker');
  assert.equal(action.responsibleUser, 'worker-1');
  assert.equal(action.deadline, dueAt);
  assert.equal(action.priority, 'high');
});

test('unassigned and terminal reports do not invent an individual owner or action', () => {
  const unassigned = getReportNextAction({ status: 'verified' });
  assert.equal(unassigned.action, 'Assign an officer');
  assert.equal(unassigned.responsibleUser, null);
  assert.equal(getReportNextAction({ status: 'closed' }), null);
});

test('emergency next action prioritizes live assignment state over the incident summary state', () => {
  const action = getEmergencyNextAction({
    status: 'dispatched',
    severity: 'critical',
    responseAssignments: [{ status: 'en_route', emergencyOfficer: 'officer-1', fieldWorkers: ['worker-1'] }]
  }, { dueAt: '2026-09-25T12:00:00Z' });
  assert.equal(action.action, 'Confirm arrival on scene');
  assert.equal(action.responsibleRole, 'emergency_field_worker');
  assert.equal(action.responsibleUser, 'worker-1');
  assert.equal(action.priority, 'critical');
});

test('emergency without an assignment exposes command action; terminal status has none', () => {
  assert.equal(getEmergencyNextAction({ status: 'verified', severity: 'high' }).action, 'Assign a response team');
  assert.equal(getEmergencyNextAction({ status: 'closed', severity: 'high' }), null);
});
