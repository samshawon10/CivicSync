import test from 'node:test';
import assert from 'node:assert/strict';

import departmentRouter from './departmentRoutes.js';

/** Express layer → "METHOD /path" label, used to assert the public contract. */
function routeLabels(router) {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
}

const expectedRoutes = [
  // Overview
  'GET /dashboard', 'GET /analytics', 'GET /activity', 'GET /staff',
  // Case operations
  'GET /reports', 'GET /reports/:id', 'POST /reports/:id/notes', 'POST /reports/:id/messages',
  'PATCH /reports/:id/priority', 'PATCH /reports/:id/assign', 'PATCH /reports/:id/status',
  'POST /reports/:id/completion-report', 'PATCH /reports/:id/completion-review',
  'GET /reports/:id/team-recommendations', 'POST /reports/:id/escalate',
  'POST /reports/:id/resolve-escalation', 'POST /reports/:id/handover',
  // Teams
  'GET /teams', 'POST /teams', 'PATCH /teams/:id',
  // Field tasks
  'GET /tasks', 'GET /tasks/:id', 'PATCH /tasks/:id/status', 'POST /tasks/:id/complete',
  // Resources
  'GET /resources', 'POST /resources', 'POST /resources/:id/request', 'PATCH /resources/:id/review'
];

test('department router exposes the full operations API surface', () => {
  assert.deepEqual(routeLabels(departmentRouter).sort(), [...expectedRoutes].sort());
});

test('every department route is protected by authentication and department roles', () => {
  // router.use(requireAuth, requireRole(...)) registers exactly two middleware layers.
  const guards = departmentRouter.stack.filter((layer) => !layer.route);
  assert.equal(guards.length, 2, 'department router must mount requireAuth and requireRole guards');
  assert.equal(typeof guards[0].handle, 'function');
  assert.equal(guards[0].handle.name, 'requireAuth');
  assert.equal(guards[1].handle.name, '', 'requireRole returns an anonymous role-checking middleware');
});

test('department route paths do not collide', () => {
  const labels = routeLabels(departmentRouter);
  assert.equal(new Set(labels).size, labels.length);
  assert.equal(labels.length, expectedRoutes.length);
});
