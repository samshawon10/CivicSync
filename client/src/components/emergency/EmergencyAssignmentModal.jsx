import { useEffect, useState } from 'react';
import { apiMessage } from '../../services/api.js';
import { emergencyApi, label, responseTeamsApi } from '../../services/emergencyService.js';
import ResponseTeamCard from './ResponseTeamCard.jsx';
import { ErrorState } from './EmergencyCard.jsx';

const responseTypeOptions = ['Medical', 'Fire', 'Security', 'Traffic', 'Disaster', 'Rescue', 'Infrastructure', 'Other'];

/**
 * Multi-branch dispatch modal. The Emergency Head can attach several
 * response teams to one incident (e.g. Medical + Security + Traffic)
 * by submitting the form repeatedly before closing.
 */
export default function EmergencyAssignmentModal({ emergency, onClose, onAssigned }) {
  const [responders, setResponders] = useState([]);
  const [teams, setTeams] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [form, setForm] = useState({ responseType: '', customType: '', officerId: '', fieldWorkerIds: [], teamId: '', etaMinutes: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadReference() {
    try {
      const [responderResult, teamResult, nearbyResult] = await Promise.all([
        emergencyApi.assignableResponders().catch(() => ({ data: { responders: [] } })),
        responseTeamsApi.list().catch(() => ({ data: { teams: [] } })),
        emergencyApi.nearbyResponders(emergency._id).catch(() => ({ data: { teams: [], suggestedTypes: [] } }))
      ]);
      setResponders(responderResult.data.responders || []);
      setTeams(teamResult.data.teams || []);
      setNearby(nearbyResult.data.teams || []);
      setSuggested(nearbyResult.data.suggestedTypes || []);
    } catch (err) { setError(apiMessage(err)); }
  }

  useEffect(() => { loadReference(); }, [emergency._id]);

  const officers = responders.filter((user) => user.role === 'emergency_officer');
  const workers = responders.filter((user) => user.role === 'emergency_field_worker');

  async function submit(event) {
    event.preventDefault();
    const responseType = form.responseType === 'Other' ? form.customType.trim() : form.responseType;
    if (!responseType) { setError('Choose a response type.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      const { data } = await emergencyApi.assign(emergency._id, {
        responseType,
        teamId: form.teamId,
        responseTeam: teams.find((team) => team._id === form.teamId)?.name || '',
        officerId: form.officerId,
        fieldWorkerIds: form.fieldWorkerIds,
        etaMinutes: form.etaMinutes === '' ? null : Number(form.etaMinutes),
        notes: form.notes
      });
      setSuccess(`${responseType} response dispatched.`);
      setForm({ ...form, officerId: '', fieldWorkerIds: [], teamId: '', notes: '' });
      if (onAssigned) onAssigned(data.emergency, data.assignment);
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }

  function toggleWorker(id) {
    setForm((current) => ({
      ...current,
      fieldWorkerIds: current.fieldWorkerIds.includes(id) ? current.fieldWorkerIds.filter((value) => value !== id) : [...current.fieldWorkerIds, id]
    }));
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 sm:place-items-center sm:p-4">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-red-700">{emergency.emergencyId} · DISPATCH RESPONSE</p>
            <h2 className="text-xl font-black text-ink">Assign response teams</h2>
            <p className="text-xs text-slate-500">One incident can carry multiple simultaneous response branches.</p>
          </div>
          <button onClick={onClose} className="civic-secondary">Close</button>
        </div>

        {suggested.length > 0 && (
          <p className="mt-3 rounded-lg bg-blue-50 p-2.5 text-xs font-bold text-blue-800">Suggested response: {suggested.map(label).join(' + ')}</p>
        )}

        {nearby.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-black text-ink">Nearby available teams</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {nearby.slice(0, 6).map((team) => (
                <ResponseTeamCard key={team._id} team={team} selected={form.teamId === team._id} onSelect={(selected) => setForm({ ...form, teamId: selected._id, responseType: form.responseType || (responseTypeOptions.find((opt) => opt.toLowerCase() === selected.type) || '') })} />
              ))}
            </div>
          </div>
        )}

        <ErrorState message={error} />
        {success && <p className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-sm font-semibold text-emerald-700">{success}</p>}

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">Response type
              <select value={form.responseType} onChange={(e) => setForm({ ...form, responseType: e.target.value })} required>
                <option value="">Select…</option>
                {responseTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            {form.responseType === 'Other' && (
              <label className="text-sm font-bold">Custom response name
                <input value={form.customType} onChange={(e) => setForm({ ...form, customType: e.target.value })} placeholder="e.g. Water Rescue" required maxLength={80} />
              </label>
            )}
            <label className="text-sm font-bold">Response team (optional)
              <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                <option value="">No registered team</option>
                {teams.map((team) => <option key={team._id} value={team._id}>{team.name} ({label(team.type)} · {label(team.availability)})</option>)}
              </select>
            </label>
            <label className="text-sm font-bold">Emergency officer
              <select value={form.officerId} onChange={(e) => setForm({ ...form, officerId: e.target.value })}>
                <option value="">Leave unassigned</option>
                {officers.map((user) => <option key={user._id} value={user._id}>{user.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold">ETA (minutes)
              <input type="number" min="0" max="999" value={form.etaMinutes} onChange={(e) => setForm({ ...form, etaMinutes: e.target.value })} placeholder="Optional" />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-black text-ink">Field workers</legend>
            {workers.length ? (
              <div className="mt-2 grid max-h-40 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                {workers.map((user) => (
                  <label key={user._id} className="flex items-center gap-2 rounded p-1 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={form.fieldWorkerIds.includes(user._id)} onChange={() => toggleWorker(user._id)} className="h-4 w-4" />
                    {user.name}
                  </label>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">No active field workers found.</p>}
          </fieldset>

          <label className="block text-sm font-bold">Dispatch notes
            <textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} placeholder="Instructions for the team" />
          </label>

          <button disabled={busy} className="civic-primary w-full sm:w-auto">{busy ? 'Dispatching…' : 'Dispatch this response'}</button>
          <p className="text-xs text-slate-500">Submit again to attach additional response branches to the same incident.</p>
        </form>
      </section>
    </div>
  );
}