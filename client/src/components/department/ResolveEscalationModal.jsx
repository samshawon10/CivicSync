import { useState } from 'react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import { showSuccess, showError } from '../../utils/sweetAlert.js';
import { Modal } from '../../components/ui/Overlays.jsx';
import { OpsError, TextField, inputClass, primaryButton, secondaryButton, formatOpsDate } from './DepartmentOpsUI.jsx';

/** Shared escalation-resolution dialog (escalation queue + case workspace). */
export default function ResolveEscalationModal({ report, onClose, onResolved }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!note.trim()) { setError('A resolution note is required for the audit history.'); return; }
    setBusy(true); setError('');
    try {
      await departmentApi.resolveEscalation(report._id, note.trim());
      showSuccess('Escalation resolved', `"${report.title}" is no longer escalated.`);
      onResolved();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to resolve escalation', message);
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Resolve escalation"
      subtitle={report.title}
      footer={<><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="submit" form="resolve-escalation-form" disabled={busy} className={primaryButton}>{busy ? 'Resolving…' : 'Resolve escalation'}</button></>}
    >
      <form id="resolve-escalation-form" onSubmit={submit} className="space-y-4">
        <OpsError message={error} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-black uppercase tracking-wider">Escalation reason</p>
          <p className="mt-1 font-semibold">{report.escalation?.reason || 'No reason recorded.'}</p>
          <p className="mt-1 text-xs">Escalated {formatOpsDate(report.escalation?.escalatedAt)}</p>
        </div>
        <TextField label="Resolution note" hint="Record the decision taken so the case history stays auditable.">
          <textarea rows={4} className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reallocated to Road Unit B and escalated the resource request to the city office…" required />
        </TextField>
      </form>
    </Modal>
  );
}
