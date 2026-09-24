import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionAssignment, canTransitionEmergency } from './emergencyLifecycle.js';

test('allows the normal emergency lifecycle', () => {
  assert.equal(canTransitionEmergency('reported', 'received'), true);
  assert.equal(canTransitionEmergency('received', 'assessing'), true);
  assert.equal(canTransitionEmergency('assessing', 'verified'), true);
  assert.equal(canTransitionEmergency('verified', 'dispatched'), true);
  assert.equal(canTransitionEmergency('dispatched', 'en_route'), true);
  assert.equal(canTransitionEmergency('en_route', 'on_scene'), true);
  assert.equal(canTransitionEmergency('on_scene', 'responding'), true);
  assert.equal(canTransitionEmergency('responding', 'resolved'), true);
  assert.equal(canTransitionEmergency('resolved', 'closed'), true);
});

test('rejects emergency status shortcuts and terminal changes', () => {
  assert.equal(canTransitionEmergency('reported', 'resolved'), false);
  assert.equal(canTransitionEmergency('closed', 'responding'), false);
  assert.equal(canTransitionEmergency('cancelled', 'dispatched'), false);
  assert.equal(canTransitionEmergency('false_report', 'received'), false);
});

test('allows only the assignment lifecycle', () => {
  assert.equal(canTransitionAssignment('assigned', 'accepted'), true);
  assert.equal(canTransitionAssignment('accepted', 'en_route'), true);
  assert.equal(canTransitionAssignment('en_route', 'on_scene'), true);
  assert.equal(canTransitionAssignment('on_scene', 'responding'), true);
  assert.equal(canTransitionAssignment('responding', 'completed'), true);
  assert.equal(canTransitionAssignment('assigned', 'en_route'), false);
  assert.equal(canTransitionAssignment('completed', 'cancelled'), false);
});
