import test from 'node:test';
import assert from 'node:assert/strict';
import { canSearch, isCategoryPublic, resolveCategories, searchCategories, visibleCategories } from './civicSearchScope.js';

const user = (role, extra = {}) => ({ _id: `${role}-1`, role, departmentName: 'Road & Highway', ...extra });

test('citizens search only civic-public categories they own', () => {
  const categories = visibleCategories(user('citizen'));
  assert.deepEqual(categories, ['cases', 'community', 'facilities', 'alerts', 'directory', 'contacts']);
  assert.equal(categories.includes('citizens'), false);
  assert.equal(categories.includes('audit'), false);
  assert.equal(categories.includes('emergencies'), false);
  assert.equal(categories.includes('resources'), false);
  assert.equal(categories.includes('tasks'), false);
});

test('civic department staff are scoped to civic work and never see the citizen directory or audit', () => {
  ['department_head', 'department_officer', 'officer', 'field_worker'].forEach((role) => {
    const categories = visibleCategories(user(role));
    assert.ok(categories.includes('cases'), `${role} should search cases`);
    assert.ok(categories.includes('resources'), `${role} should search department resources`);
    assert.ok(categories.includes('tasks'), `${role} should search field tasks`);
    assert.equal(categories.includes('citizens'), false, `${role} must not search citizen accounts`);
    assert.equal(categories.includes('audit'), false, `${role} must not search the audit trail`);
    assert.equal(categories.includes('emergencies'), false, `${role} must not search emergencies`);
    assert.equal(categories.includes('teams'), false, `${role} must not search response teams`);
    assert.equal(categories.includes('contacts'), false, `${role} must not search emergency contacts`);
  });
});

test('emergency staff are isolated to emergency categories', () => {
  ['emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'].forEach((role) => {
    const categories = visibleCategories(user(role));
    assert.ok(categories.includes('emergencies'), `${role} should search emergencies`);
    assert.ok(categories.includes('facilities'), `${role} should search facilities`);
    assert.ok(categories.includes('alerts'), `${role} should search alerts`);
    assert.equal(categories.includes('cases'), false, `${role} must not search civic cases`);
    assert.equal(categories.includes('community'), false, `${role} must not search community posts`);
    assert.equal(categories.includes('citizens'), false, `${role} must not search citizen accounts`);
    assert.equal(categories.includes('audit'), false, `${role} must not search the audit trail`);
    assert.equal(categories.includes('resources'), false, `${role} must not search department resources`);
  });
  assert.equal(visibleCategories(user('emergency_field_worker')).includes('teams'), false);
  assert.equal(visibleCategories(user('emergency_officer')).includes('teams'), true);
});

test('only the Super Admin reaches the whole operational catalogue', () => {
  const categories = visibleCategories(user('admin'));
  assert.deepEqual(categories, Object.keys(searchCategories).filter((key) => key !== 'contacts'));
  assert.ok(categories.includes('citizens'));
  assert.ok(categories.includes('audit'));
  assert.ok(categories.includes('emergencies'));
  assert.equal(categories.includes('contacts'), false, 'citizen emergency contacts stay private even from admin search');
});

test('unknown roles and unauthenticated callers search nothing', () => {
  assert.deepEqual(visibleCategories(null), []);
  assert.deepEqual(visibleCategories({ _id: 'x', role: 'unknown_role' }), []);
  assert.equal(canSearch('citizen'), true);
  assert.equal(canSearch('unknown_role'), false);
  assert.equal(canSearch(undefined), false);
});

test('requested categories are intersected with the role, never widened', () => {
  const citizen = user('citizen');
  assert.deepEqual(resolveCategories(citizen, ['citizens', 'audit', 'cases']), ['cases']);
  assert.deepEqual(resolveCategories(citizen, ['audit']), []);
  assert.deepEqual(resolveCategories(citizen, []), ['cases', 'community', 'facilities', 'alerts', 'directory', 'contacts']);
  const officer = user('department_officer');
  assert.deepEqual(resolveCategories(officer, ['emergencies', 'tasks']), ['tasks']);
});

test('case visibility follows the existing report ownership rules', () => {
  assert.deepEqual(searchCategories.cases.scopeFor(user('citizen')), { kind: 'owner', field: 'createdBy', userId: 'citizen-1' });
  assert.deepEqual(searchCategories.cases.scopeFor(user('department_officer')), { kind: 'department', field: 'departmentName', departmentName: 'Road & Highway' });
  assert.deepEqual(searchCategories.cases.scopeFor(user('field_worker')), { kind: 'assigned', field: 'assignedFieldWorker', userId: 'field_worker-1' });
  assert.deepEqual(searchCategories.cases.scopeFor(user('admin')), { kind: 'all' });
});

test('emergency visibility follows command vs participant rules', () => {
  assert.deepEqual(searchCategories.emergencies.scopeFor(user('emergency_department_head')), { kind: 'all' });
  assert.deepEqual(searchCategories.emergencies.scopeFor(user('admin')), { kind: 'all' });
  assert.deepEqual(searchCategories.emergencies.scopeFor(user('emergency_officer')), { kind: 'emergencyParticipant', userId: 'emergency_officer-1' });
  assert.deepEqual(searchCategories.emergencies.scopeFor(user('emergency_field_worker')), { kind: 'emergencyParticipant', userId: 'emergency_field_worker-1' });
});

test('employee-only categories are never treated as public', () => {
  assert.equal(isCategoryPublic('admin', 'audit'), false);
  assert.equal(isCategoryPublic('admin', 'citizens'), false);
  assert.equal(isCategoryPublic('citizen', 'emergencies'), false);
  assert.equal(isCategoryPublic('department_officer', 'emergencies'), false);
  assert.equal(isCategoryPublic('emergency_officer', 'emergencies'), true);
  assert.equal(isCategoryPublic('citizen', 'facilities'), true);
  assert.equal(isCategoryPublic('citizen', 'directory'), true);
});
