import { useState } from 'react';
import { MessageSquare, Send, Lock, Globe } from 'lucide-react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import { showError } from '../../utils/sweetAlert.js';
import { OpsError, Pill, inputClass, primaryButton, formatOpsDate } from './DepartmentOpsUI.jsx';

/** Internal-vs-citizen case conversation thread. */
export default function CaseConversation({ report, onPosted }) {
  const [text, setText] = useState('');
  const [isInternal, setIsInternal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const messages = report.messages || [];

  async function submit(event) {
    event.preventDefault();
    if (!text.trim()) { setError('Enter a message before posting.'); return; }
    setBusy(true); setError('');
    try {
      await departmentApi.message(report._id, text.trim(), isInternal);
      setText('');
      onPosted?.();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to post message', message);
    } finally { setBusy(false); }
  }


  return (
    <div className="space-y-4">
      <OpsError message={error} />

      {messages.length ? (
        <ol className="space-y-2.5">
          {messages.map((message, index) => (
            <li
              key={message._id || `${message.createdAt}-${index}`}
              className={`rounded-xl border p-3 ${message.isInternal ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={message.isInternal ? 'warning' : 'info'}>
                  {message.isInternal ? <><Lock size={11} aria-hidden="true" /> Internal</> : <><Globe size={11} aria-hidden="true" /> Citizen visible</>}
                </Pill>
                <span className="text-xs font-bold text-slate-700">{message.senderName || 'Department staff'}</span>
                <span className="text-xs text-slate-500">{String(message.senderRole || '').replaceAll('_', ' ')}</span>
                <span className="text-xs text-slate-400">{formatOpsDate(message.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{message.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
          <MessageSquare size={18} className="mx-auto text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-ink">No case messages yet</p>
          <p className="mt-0.5 text-xs text-slate-500">Use internal notes for coordination and citizen updates for requester-facing messages.</p>
        </div>
      )}

      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setIsInternal(true)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold ${isInternal ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-slate-300 bg-white text-slate-600'}`}
          >
            <Lock size={11} aria-hidden="true" /> Internal note
          </button>
          <button
            type="button"
            onClick={() => setIsInternal(false)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold ${!isInternal ? 'border-blue-300 bg-blue-100 text-blue-800' : 'border-slate-300 bg-white text-slate-600'}`}
          >
            <Globe size={11} aria-hidden="true" /> Citizen update
          </button>
        </div>
        <textarea
          rows={3}
          className={`${inputClass} mt-2`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={isInternal ? 'Coordinate with officers and field staff…' : 'Message that the reporting citizen will be able to read…'}
          aria-label="Case message"
        />
        <div className="mt-2 flex justify-end">
          <button type="submit" disabled={busy} className={primaryButton}>
            <Send size={14} className="mr-1 inline" /> {busy ? 'Posting…' : 'Post message'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Merged activity, handover and field-task timeline for a case. */
export function CaseTimeline({ report }) {
  const entries = [
    ...(report.activity || []).map((item) => ({ kind: 'activity', action: item.action, note: item.note, at: item.timestamp || item.createdAt, role: item.actorRole })),
    ...(report.handoverHistory || []).map((item) => ({ kind: 'handover', action: `Case handed over to ${item.newOfficer?.name || 'another officer'}`, note: item.reason || item.notes, at: item.transferredAt, role: null })),
    ...((report.activeTask?.timeline) || []).map((item) => ({ kind: 'task', action: `Field task: ${String(item.status || '').replaceAll('_', ' ')}`, note: item.note, at: item.timestamp, role: item.actorRole }))
  ].filter((entry) => entry.at).sort((a, b) => new Date(b.at) - new Date(a.at));

  if (!entries.length) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No recorded activity for this case yet.</p>;
  }

  const iconTone = { activity: 'bg-civic-600', handover: 'bg-indigo-600', task: 'bg-emerald-600' };

  return (
    <ol className="space-y-3">
      {entries.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="grid grid-cols-[16px_1fr] gap-3">
          <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-slate-100 ${iconTone[entry.kind] || 'bg-slate-400'}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{entry.action}</p>
            <p className="mt-0.5 text-xs text-slate-500">{formatOpsDate(entry.at)}{entry.role ? ` · ${String(entry.role).replaceAll('_', ' ')}` : ''}</p>
            {entry.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{entry.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
