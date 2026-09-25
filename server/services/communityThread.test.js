import test from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteComment, canEditComment, descendantIds, sameId, threadComments } from './communityThread.js';

const post = { _id: 'post-1', author: 'post-owner' };
const author = { _id: 'comment-author' };
const stranger = { _id: 'passer-by' };
const admin = { _id: 'platform-admin', role: 'admin' };
const comment = { _id: 'c1', author: 'comment-author', parent: null, status: 'published', createdAt: '2024-01-01T00:00:00.000Z' };

test('sameId compares raw ids and populated references', () => {
  assert.equal(sameId('abc', 'abc'), true);
  assert.equal(sameId({ _id: 'abc', name: 'Amina' }, 'abc'), true);
  assert.equal(sameId('abc', 'xyz'), false);
  assert.equal(sameId(null, 'abc'), false);
  assert.equal(sameId(undefined, undefined), false);
});

test('comment editing is limited to the author of a published comment', () => {
  assert.equal(canEditComment(author, comment), true);
  assert.equal(canEditComment(stranger, comment), false);
  assert.equal(canEditComment(admin, comment), false);
  assert.equal(canEditComment(author, { ...comment, status: 'removed' }), false);
  assert.equal(canEditComment(null, comment), false);
  assert.equal(canEditComment(author, null), false);
});

test('comment deletion allows the comment author, the post author and admins only', () => {
  assert.equal(canDeleteComment(author, comment, post), true);
  assert.equal(canDeleteComment({ _id: 'post-owner' }, comment, post), true);
  assert.equal(canDeleteComment(admin, comment, post), true);
  assert.equal(canDeleteComment(stranger, comment, post), false);
  assert.equal(canDeleteComment(author, { ...comment, status: 'removed' }, post), false);
  assert.equal(canDeleteComment(author, comment, { _id: 'post-1', author: 'someone-else' }), true);
});

test('threadComments nests replies under their parent with depth and reply counts', () => {
  const ordered = threadComments([
    { _id: 'r1', parent: null, status: 'published', createdAt: '2024-01-03T00:00:00.000Z' },
    { _id: 'c1', parent: null, status: 'published', createdAt: '2024-01-01T00:00:00.000Z' },
    { _id: 'c2', parent: 'c1', status: 'published', createdAt: '2024-01-02T00:00:00.000Z' },
    { _id: 'c3', parent: 'c2', status: 'published', createdAt: '2024-01-02T05:00:00.000Z' },
    { _id: 'hidden', parent: 'c1', status: 'removed', createdAt: '2024-01-02T06:00:00.000Z' }
  ]);
  assert.deepEqual(ordered.map((item) => item._id), ['c1', 'c2', 'c3', 'r1']);
  assert.deepEqual(ordered.map((item) => item.depth), [0, 1, 2, 0]);
  assert.deepEqual(ordered.map((item) => item.replyCount), [1, 1, 0, 0]);
  assert.equal(ordered.some((item) => item._id === 'hidden'), false);
});

test('threadComments keeps replies visible when their parent is gone', () => {
  const ordered = threadComments([{ _id: 'orphan', parent: 'missing', status: 'published', createdAt: '2024-01-01T00:00:00.000Z' }]);
  assert.deepEqual(ordered.map((item) => [item._id, item.depth]), [['orphan', 0]]);
});

test('descendantIds returns the whole subtree and ignores unrelated comments', () => {
  const rows = [
    { _id: 'c1', parent: null }, { _id: 'c2', parent: 'c1' }, { _id: 'c3', parent: 'c2' }, { _id: 'c4', parent: 'other' }, { _id: 'c5', parent: null }
  ];
  assert.deepEqual(descendantIds(rows, 'c1'), ['c2', 'c3']);
  assert.deepEqual(descendantIds(rows, 'c4'), []);
  assert.deepEqual(descendantIds(rows, 'c5'), []);
});
