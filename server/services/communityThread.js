/**
 * Pure, database-free helpers for the community comment threads.
 * Kept out of the controller so the permission and ordering rules can be
 * unit-tested directly (see communityThread.test.js).
 */

/** Compares a raw id against a reference that may be populated ({ _id }) or raw. */
export function sameId(value, id) {
  const resolved = value?._id || value;
  return Boolean(resolved && String(resolved) === String(id));
}

/** Only the author of a still-published comment may edit it. */
export function canEditComment(viewer, comment) {
  if (!viewer || !comment || comment.status !== 'published') return false;
  return sameId(comment.author, viewer._id);
}

/**
 * A comment can be removed by its author, by the author of the post it belongs
 * to (their thread to moderate) or by a platform admin.
 */
export function canDeleteComment(viewer, comment, post) {
  if (!viewer || !comment || comment.status !== 'published') return false;
  return sameId(comment.author, viewer._id) || sameId(post?.author, viewer._id) || viewer.role === 'admin';
}

const createdAt = (comment) => new Date(comment.createdAt || 0).getTime();

/**
 * Orders a flat comment list into reading order: every root comment followed by
 * its replies (parents before children), then the next root. Each entry is
 * tagged with its `depth` and its direct `replyCount` so the client can render
 * indentation without recursing. Replies whose parent is missing or no longer
 * published are promoted to roots so a thread never vanishes from the UI.
 */
export function threadComments(comments = []) {
  const published = comments.filter((comment) => comment?.status === 'published').sort((a, b) => createdAt(a) - createdAt(b));
  const known = new Set(published.map((comment) => String(comment._id)));
  const childrenOf = new Map();
  const roots = [];
  published.forEach((comment) => {
    const parent = comment.parent ? String(comment.parent) : null;
    if (!parent || !known.has(parent)) roots.push(comment);
    else childrenOf.set(parent, [...(childrenOf.get(parent) || []), comment]);
  });
  const ordered = [];
  const visit = (comment, depth) => {
    const replies = childrenOf.get(String(comment._id)) || [];
    ordered.push({ ...comment, depth, replyCount: replies.length });
    replies.forEach((reply) => visit(reply, depth + 1));
  };
  roots.forEach((root) => visit(root, 0));
  return ordered;
}

/**
 * Ids of every descendant of `rootId`, transitively. Deleting a comment removes
 * its whole subtree so no reply is left orphaned.
 */
export function descendantIds(comments = [], rootId) {
  const childrenOf = new Map();
  comments.forEach((comment) => {
    const parent = comment?.parent ? String(comment.parent) : null;
    if (parent) childrenOf.set(parent, [...(childrenOf.get(parent) || []), String(comment._id)]);
  });
  const found = [];
  const seen = new Set([String(rootId)]);
  const queue = [...(childrenOf.get(String(rootId)) || [])];
  while (queue.length) {
    const next = queue.shift();
    if (seen.has(next)) continue;
    seen.add(next);
    found.push(next);
    queue.push(...(childrenOf.get(next) || []));
  }
  return found;
}
