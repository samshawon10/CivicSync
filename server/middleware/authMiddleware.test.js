import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth, requireRole } from './authMiddleware.js';
import { roleOrder } from '../config/permissions.js';

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
test('backend authentication rejects missing, malformed, expired tokens and suspended accounts', async (t) => {
  t.mock.method(User, 'findById', async () => ({ status: 'suspended', role: 'admin' }));
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'qa-auth-secret';
  try {
    for (const token of [null, 'invalid', jwt.sign({ userId: '123' }, 'qa-auth-secret', { expiresIn: -1 }), jwt.sign({ userId: '123' }, 'qa-auth-secret')]) {
      const res = response();
      let called = false;
      await requireAuth({ headers: token ? { authorization: `Bearer ${token}` } : {}, query: {} }, res, () => { called = true; });
      assert.equal(res.statusCode, 401);
      assert.equal(called, false);
    }
  } finally { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; }
});
test('RBAC uses authenticated database role, never a client role or URL', () => {
  let arrayAllowed = false;
  requireRole(['admin'])({ user: { role: 'admin' } }, response(), () => { arrayAllowed = true; });
  assert.equal(arrayAllowed, true);
  for (const allowed of roleOrder) for (const actual of roleOrder) {
    let called = false;
    const res = response();
    requireRole(allowed)({ user: { role: actual }, body: { role: allowed }, query: { role: allowed } }, res, () => { called = true; });
    assert.equal(called, actual === allowed, `${actual} -> ${allowed}`);
    if (actual !== allowed) assert.equal(res.statusCode, 403);
  }
});
test('a valid token loads the current database role instead of trusting JWT role claims', async (t) => {
  const user = { status: 'active', role: 'citizen' };
  t.mock.method(User, 'findById', async () => user);
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'qa-auth-secret';
  try {
    const req = { headers: { authorization: `Bearer ${jwt.sign({ userId: '123', role: 'admin' }, 'qa-auth-secret')}` }, query: {} };
    let called = false;
    await requireAuth(req, response(), () => { called = true; });
    assert.equal(called, true);
    assert.equal(req.user.role, 'citizen');
  } finally { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; }
});
