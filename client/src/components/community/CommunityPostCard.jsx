import { Bookmark, Check, CornerDownRight, Heart, MessageCircle, Pencil, Reply, Send, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { apiMessage, confirmAction, showSuccess } from '../../services/api.js';
import { communityApi, communityMediaUrl } from '../../services/communityService.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * One community post with its threaded discussion. Editing, deleting and
 * replying are all authorised server-side (see services/communityThread.js);
 * this card only shows the actions the viewer is allowed to use.
 */

const categories = [['general', 'General'], ['local_issue', 'Local issues'], ['safety', 'Safety'], ['community_help', 'Community help'], ['lost_found', 'Lost & Found'], ['event', 'Events'], ['discussion', 'Discussions']];
const time = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const indent = (depth = 0) => ({ marginLeft: `${Math.min(depth, 4) * 18}px` });
const actionClass = 'flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100';

function CommentRow({ item, postId, onUpdated, onRemoved, onReplied, onError }) {
  const [mode, setMode] = useState('view');
  const [draft, setDraft] = useState(item.content);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  async function saveEdit(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const { data } = await communityApi.updateComment(postId, item._id, { content: draft.trim() });
      onUpdated(item._id, data.comment);
      setMode('view');
      showSuccess('Comment updated', 'Your edit is now visible.');
    } catch (error) { onError(apiMessage(error)); } finally { setBusy(false); }
  }

  async function remove() {
    const confirmed = await confirmAction({ title: 'Delete this comment?', text: item.replyCount ? 'Replies written under this comment are removed too.' : 'This comment will be removed for everyone.', confirmLabel: 'Delete comment' });
    if (!confirmed) return;
    setBusy(true);
    try {
      const { data } = await communityApi.removeComment(postId, item._id);
      onRemoved(data.removedIds || [item._id], data.commentCount);
      showSuccess('Comment deleted', 'The comment was removed.');
    } catch (error) { onError(apiMessage(error)); } finally { setBusy(false); }
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const { data } = await communityApi.comment(postId, { content: reply.trim(), parent: item._id });
      setReply('');
      setMode('view');
      onReplied(data.commentCount);
    } catch (error) { onError(apiMessage(error)); } finally { setBusy(false); }
  }

  return (
    <div style={indent(item.depth)} className="rounded-xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-sm font-bold text-ink">{item.author?.name || 'Community member'}</p>
        <p className="text-xs text-slate-500">{time(item.createdAt)}{item.editedAt ? ' · edited' : ''}</p>
        {item.depth > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-civic-700"><CornerDownRight size={12} /> Reply</span>}
      </div>
      {mode === 'edit' ? (
        <form onSubmit={saveEdit} className="mt-2">
          <label className="sr-only" htmlFor={`edit-comment-${item._id}`}>Edit comment</label>
          <textarea id={`edit-comment-${item._id}`} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength="1500" rows="3" className="w-full resize-none bg-white text-sm" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="flex min-h-9 items-center gap-1.5 rounded-lg bg-civic-600 px-3 text-xs font-bold text-white disabled:opacity-60"><Check size={14} /> {busy ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => { setDraft(item.content); setMode('view'); }} className="flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-slate-600 hover:bg-slate-100"><X size={14} /> Cancel</button>
          </div>
        </form>
      ) : <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.content}</p>}
      {mode !== 'edit' && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button type="button" aria-expanded={mode === 'reply'} onClick={() => { setMode(mode === 'reply' ? 'view' : 'reply'); setReply(''); }} className={actionClass}><Reply size={14} /> Reply</button>
          {item.canEdit && <button type="button" onClick={() => { setDraft(item.content); setMode('edit'); }} className={actionClass}><Pencil size={14} /> Edit</button>}
          {item.canManage && <button type="button" onClick={remove} disabled={busy} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"><Trash size={14} /> Delete</button>}
        </div>
      )}
      {mode === 'reply' && (
        <form onSubmit={sendReply} className="mt-2 flex gap-2">
          <label className="sr-only" htmlFor={`reply-comment-${item._id}`}>Reply to {item.author?.name || 'this comment'}</label>
          <input id={`reply-comment-${item._id}`} value={reply} onChange={(event) => setReply(event.target.value)} maxLength="1500" placeholder={`Reply to ${item.author?.name || 'this comment'}`} className="text-sm" />
          <button type="submit" disabled={busy} aria-label="Post reply" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-civic-600 text-white disabled:opacity-60"><Send size={16} /></button>
        </form>
      )}
    </div>
  );
}

export default function CommunityPostCard({ post, onChange }) {
  const { user } = useAuth();
  const [comments, setComments] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const author = post.author || {};
  const own = post.canManage ?? String(author._id) === String(user?._id || user?.id);

  async function react() { try { const { data } = await communityApi.react(post._id, post.viewerReaction || 'helpful'); onChange({ ...post, viewerReaction: data.reaction, reactionCount: data.reactionCount }); } catch (err) { setError(apiMessage(err)); } }
  async function save() { try { const { data } = await communityApi.save(post._id); onChange({ ...post, saved: data.saved }); } catch (err) { setError(apiMessage(err)); } }
  async function loadComments() { try { const { data } = await communityApi.comments(post._id); setComments(data.comments || []); } catch (err) { setError(apiMessage(err)); } }
  function applyCount(commentCount) { if (typeof commentCount === 'number') onChange({ ...post, commentCount }); }

  async function addComment(event) {
    event.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      const { data } = await communityApi.comment(post._id, { content: comment.trim() });
      setComment('');
      applyCount(data.commentCount);
      await loadComments();
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!edit.content.trim()) { setError('A post needs text or media.'); return; }
    setBusy(true);
    try {
      const { data } = await communityApi.update(post._id, { content: edit.content, category: edit.category, area: edit.area });
      onChange(data.post);
      setEdit(null);
      setError('');
      showSuccess('Post updated', 'Your changes are visible to the community.');
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }

  async function removePost() {
    const confirmed = await confirmAction({ title: 'Delete this post?', text: 'The post and its discussion are removed from the community feed.', confirmLabel: 'Delete post' });
    if (!confirmed) return;
    try {
      await communityApi.remove(post._id);
      onChange(null);
      showSuccess('Post deleted', 'The post was removed from the feed.');
    } catch (err) { setError(apiMessage(err)); }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-civic-100 font-bold text-civic-800">{author.name?.[0]?.toUpperCase() || 'C'}</span>
          <div>
            <p className="font-bold text-ink">{author.name || 'Community member'}</p>
            <p className="mt-0.5 text-xs text-slate-500">{time(post.createdAt)}{post.updatedAt && post.updatedAt !== post.createdAt ? ' · edited' : ''}{post.location?.area ? ` · ${post.location.area}` : ''}</p>
          </div>
        </div>
        <span className="rounded-full bg-civic-50 px-2 py-1 text-xs font-semibold text-civic-700">{post.category.replace('_', ' ')}</span>
      </div>

      {edit ? (
        <form onSubmit={saveEdit} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="sr-only" htmlFor={`edit-post-${post._id}`}>Edit post</label>
          <textarea id={`edit-post-${post._id}`} value={edit.content} onChange={(event) => setEdit({ ...edit, content: event.target.value })} maxLength="3000" rows="3" className="w-full resize-none bg-white text-sm" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input value={edit.area} onChange={(event) => setEdit({ ...edit, area: event.target.value })} maxLength="100" placeholder="Area (optional)" aria-label="Post area" className="min-w-36 flex-1 !py-2 text-sm" />
            <select value={edit.category} onChange={(event) => setEdit({ ...edit, category: event.target.value })} aria-label="Post topic" className="w-auto !py-2 text-sm">{categories.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
            <button type="submit" disabled={busy} className="ml-auto flex min-h-9 items-center gap-1.5 rounded-lg bg-civic-600 px-3 text-xs font-bold text-white disabled:opacity-60"><Check size={14} /> {busy ? 'Saving...' : 'Save changes'}</button>
            <button type="button" onClick={() => setEdit(null)} className="flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-slate-600 hover:bg-white"><X size={14} /> Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.content}</p>
          {post.hashtags?.length > 0 && <p className="mt-3 text-sm font-medium text-civic-700">{post.hashtags.map((tag) => `#${tag}`).join(' ')}</p>}
        </>
      )}

      {post.media?.length > 0 && <div className={`mt-4 grid gap-2 ${post.media.length > 1 ? 'grid-cols-2' : ''}`}>{post.media.map((item) => item.mediaType === 'video' ? <video key={item.filename} controls preload="metadata" className="max-h-96 w-full rounded-xl bg-slate-950" src={communityMediaUrl(item.url)} /> : <img key={item.filename} loading="lazy" className="max-h-96 w-full rounded-xl object-cover" alt={item.originalName || 'Community upload'} src={communityMediaUrl(item.url)} />)}</div>}

      <div className="mt-4 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
        <button onClick={react} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${post.viewerReaction ? 'bg-civic-50 text-civic-700' : 'text-slate-600 hover:bg-slate-50'}`}><Heart size={17} /> Helpful {post.reactionCount || 0}</button>
        <button onClick={() => { if (comments === null) loadComments(); else setComments(null); }} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><MessageCircle size={17} /> Comments {post.commentCount || 0}</button>
        <button onClick={save} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${post.saved ? 'text-civic-700' : 'text-slate-600 hover:bg-slate-50'}`}><Bookmark size={17} /> {post.saved ? 'Saved' : 'Save'}</button>
        {own && <button onClick={() => setEdit(edit ? null : { content: post.content, category: post.category, area: post.location?.area || '' })} className="ml-auto flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-civic-700 hover:bg-civic-50"><Pencil size={16} /> Edit</button>}
        {own && <button onClick={removePost} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash size={16} /> Remove</button>}
      </div>

      {comments !== null && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <form onSubmit={addComment} className="flex gap-2">
            <label className="sr-only" htmlFor={`comment-${post._id}`}>Add a comment</label>
            <input id={`comment-${post._id}`} value={comment} maxLength="1500" onChange={(event) => setComment(event.target.value)} placeholder="Add a constructive comment" />
            <button disabled={busy} aria-label="Post comment" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-civic-600 text-white disabled:opacity-60"><Send size={17} /></button>
          </form>
          <div className="mt-4 space-y-3">
            {comments.map((item) => (
              <CommentRow
                key={item._id}
                item={item}
                postId={post._id}
                onError={setError}
                onUpdated={(id, updated) => setComments((rows) => rows.map((row) => row._id === id ? { ...row, ...updated } : row))}
                onRemoved={(removedIds, commentCount) => {
                  const gone = removedIds.map(String);
                  setComments((rows) => rows.filter((row) => !gone.includes(String(row._id))));
                  applyCount(commentCount);
                }}
                onReplied={(commentCount) => { applyCount(commentCount); loadComments(); }}
              />
            ))}
            {!comments.length && <p className="text-sm text-slate-500">Start the discussion with a helpful comment.</p>}
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </article>
  );
}
