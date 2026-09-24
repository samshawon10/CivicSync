import { useState } from 'react';
import { Modal } from '../../components/ui/Overlays.jsx';
import { OpsError, TextField, inputClass, primaryButton, secondaryButton } from './DepartmentOpsUI.jsx';

/**
 * Collects the structured payload the server requires for the transitions that
 * cannot be expressed as a single click (complete / block / reject).
 */
export default function TaskActionModal({ task, kind, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    summary: '', result: '', materialsUsed: '', remainingIssues: '', evidenceUrls: '',
    reason: '', description: '', resourceNeeded: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function set(key, value) { setDraft((current) => ({ ...current, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    const payload = {};
    if (kind === 'complete') {
      if (!draft.summary.trim()) { setError('A completion summary is required.'); return; }
      payload.status = 'completed';
      payload.summary = draft.summary.trim();
      payload.result = draft.result.trim();
      payload.materialsUsed = draft.materialsUsed.trim();
      payload.remainingIssues = draft.remainingIssues.trim();
      payload.evidenceUrls = draft.evidenceUrls.split(/[\n,]+/).map((url) => url.trim()).filter(Boolean);
    } else if (kind === 'block') {
      if (!draft.reason.trim()) { setError('A blocker reason is required.'); return; }
      payload.status = 'blocked';
      payload.reason = draft.reason.trim();
      payload.description = draft.description.trim();
      payload.resourceNeeded = draft.resourceNeeded.trim();
    } else {
      if (!draft.reason.trim()) { setError('A rejection reason is required.'); return; }
      payload.status = 'rejected';
      payload.reason = draft.reason.trim();
    }

    setBusy(true); setError('');
    try { await onSubmit(payload); } catch (err) { setError(err?.message || 'Unable to update the task.'); } finally { setBusy(false); }
  }

  const titles = {
    complete: { title: `Complete ${task.taskNumber || task.title}`, subtitle: 'Submit the field completion report. This moves the parent case to review.' },
    block: { title: `Report blocker on ${task.taskNumber || task.title}`, subtitle: 'Blockers are routed to the department officer for resolution.' },
    reject: { title: `Reject ${task.taskNumber || task.title}`, subtitle: 'Rejecting returns the task to the department for reassignment.' }
  }[kind] || { title: 'Update task', subtitle: '' };

  return (
    <Modal
      open
      onClose={onClose}
      title={titles.title}
      subtitle={titles.subtitle}
      size="lg"
      footer={<><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="submit" form="task-action-form" disabled={busy} className={primaryButton}>{busy ? 'Submitting…' : 'Submit'}</button></>}
    >
      <form id="task-action-form" onSubmit={submit} className="space-y-4">
        <OpsError message={error} />

        {kind === 'complete' && (
          <>
            <TextField label="Completion summary" hint="What was actually done on site?">
              <textarea rows={3} className={inputClass} value={draft.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Repaired 3 potholes and re-laid 6m of asphalt…" required />
            </TextField>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Outcome / result">
                <input className={inputClass} value={draft.result} onChange={(e) => set('result', e.target.value)} placeholder="Resolved / partially resolved" />
              </TextField>
              <TextField label="Materials used">
                <input className={inputClass} value={draft.materialsUsed} onChange={(e) => set('materialsUsed', e.target.value)} placeholder="2 bags asphalt mix, 1 sign board" />
              </TextField>
            </div>
            <TextField label="Remaining issues">
              <textarea rows={2} className={inputClass} value={draft.remainingIssues} onChange={(e) => set('remainingIssues', e.target.value)} placeholder="Follow-up needed for drainage near the junction…" />
            </TextField>
            <TextField label="Evidence links" hint="One URL per line (uploaded photos, documents or storage links).">
              <textarea rows={3} className={inputClass} value={draft.evidenceUrls} onChange={(e) => set('evidenceUrls', e.target.value)} placeholder="https://…/after-photo-1.jpg" />
            </TextField>
          </>
        )}

        {kind === 'block' && (
          <>
            <TextField label="Blocker reason">
              <input className={inputClass} value={draft.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Site inaccessible / equipment unavailable / safety hazard" required />
            </TextField>
            <TextField label="Description">
              <textarea rows={3} className={inputClass} value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe what is preventing the work…" />
            </TextField>
            <TextField label="Resource required" hint="Used by the department officer to fulfil the request.">
              <input className={inputClass} value={draft.resourceNeeded} onChange={(e) => set('resourceNeeded', e.target.value)} placeholder="Crane truck / traffic police support" />
            </TextField>
          </>
        )}

        {kind === 'reject' && (
          <TextField label="Rejection reason">
            <textarea rows={3} className={inputClass} value={draft.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Outside my service area / conflicting emergency assignment" required />
          </TextField>
        )}
      </form>
    </Modal>
  );
}
