import test from 'node:test';
import assert from 'node:assert/strict';
import { can, permissionActions, permissionMatrix, roleMeta, roleOrder } from './permissions.js';

test('permission roles and metadata are complete and unique', () => {
  assert.equal(new Set(roleOrder).size, roleOrder.length);
  assert.deepEqual(Object.keys(roleMeta).sort(), [...roleOrder].sort());
  assert.equal(new Set(permissionMatrix.map((resource) => resource.key)).size, permissionMatrix.length);
});

test('permission matrix only references known actions and roles', () => {
  for (const resource of permissionMatrix) {
    for (const [action, definition] of Object.entries(resource.actions)) {
      assert.ok(permissionActions.includes(action), `${resource.key}.${action} is not a declared action`);
      assert.ok(Array.isArray(definition.roles), `${resource.key}.${action}.roles must be an array`);
      for (const role of definition.roles) {
        assert.ok(roleOrder.includes(role), `${resource.key}.${action} references unknown role ${role}`);
      }
    }
  }
});

test('can resolves declared grants and denies unknown access', () => {
  assert.equal(can('admin', 'settings', 'edit'), true);
  assert.equal(can('citizen', 'settings', 'edit'), false);
  assert.equal(can('admin', 'unknown', 'view'), false);
  assert.equal(can('admin', 'settings', 'unknown'), false);
});
