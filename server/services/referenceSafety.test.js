import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { referencePaths } from './referenceSafety.js';

test('reference checks find scalar, array and nested member ownership fields', () => {
  const schema = new mongoose.Schema({ owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], history: [{ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }], unrelated: String });
  assert.deepEqual(referencePaths(schema, 'User'), ['owner', 'members', 'history.actor']);
  assert.deepEqual(referencePaths(schema, 'Department'), []);
});
