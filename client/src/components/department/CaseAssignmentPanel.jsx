import { useCallback, useEffect, useState } from 'react';
import { Sparkles, UserCheck, Users, RefreshCw } from 'lucide-react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import { showSuccess, showError } from '../../utils/sweetAlert.js';
import { Pill, StatusPill, WorkloadBar, OpsError, TextField, inputClass, primaryButton, secondaryButton } from './DepartmentOpsUI.jsx';

/**
 * Assignment surface for a single case: manual officer / worker / team placement
 * plus the server-scored team recommendation engine.
 */
export default function CaseAssignmentPanel({ report, staff, onChanged }) {
  const [officerId, setOfficerId] = useState(report.assignedOfficer?._id || '');
  const [fieldWorkerId, setFieldWorkerId] = useState(report.assignedFieldWorker?._id || '');
  const [teamId, setTeamId] = useState(report.assignedTeam?._id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [recoState, setRecoState] = useState('idle');

  const officers = staff.filter((person) => ['department_officer', 'officer'].includes(person.role));
  const workers = staff.filter((person) => ['field_worker', 'officer'].includes(person.role));

  const loadRecommendations = useCallback(async () => {
    setRecoState('loading');
    try {
      const { data } = await departmentApi.teamRecommendations(report._id);
      setRecommendations(data.recommendations || []);
      setRecoState('ready');
    } catch (err) {
      setRecoState('error');
      setError(apiMessage(err));
    }
  }, [report._id]);

  useEffect(() => { loadRecommendations(); }, [loadRecommendations]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await departmentApi.assign(report._id, {
        officerId: officerId || null,
        fieldWorkerId: fieldWorkerId || null,
        teamId: teamId || null
      });
      showSuccess('Assignment updated', 'Dispatch saved. A field task is created automatically for field workers and teams.');
      onChanged?.();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to update assignment', message);
    } finally { setBusy(false); }
  }

  async function assignTeam(team) {
    if (!team) return;
    setBusy(true); setError('');
    try {
      await departmentApi.assign(report._id, { teamId: team._id });
      setTeamId(team._id);
      showSuccess('Team dispatched', `${team.name} was assigned to this case.`);
      onChanged?.();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to assign team', message);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <OpsError message={error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Responsible officer">
            <select className={inputClass} value={officerId} onChange={(event) => setOfficerId(event.target.value)}>
              <option value="">Unassigned</option>
              {officers.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.workload ?? 0} active</option>)}
            </select>
          </TextField>
          <TextField label="Field worker" hint="Assigning a worker creates an execution task automatically.">
            <select className={inputClass} value={fieldWorkerId} onChange={(event) => setFieldWorkerId(event.target.value)}>
              <option value="">Unassigned</option>
              {workers.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role.replaceAll('_', ' ')} · {person.workload ?? 0} active</option>)}
            </select>
          </TextField>
        </div>
        <TextField label="Response team">
          <select className={inputClass} value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            <option value="">No team</option>
            {recommendations.map((team) => <option key={team._id} value={team._id}>{team.name} · score {team.score} · {team.currentWorkload} active</option>)}
          </select>
        </TextField>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className={primaryButton}>
            <UserCheck size={15} className="mr-1 inline" /> {busy ? 'Saving…' : 'Save dispatch'}
          </button>
          <button type="button" onClick={loadRecommendations} className={secondaryButton}>
            <RefreshCw size={14} className="mr-1 inline" /> Re-score teams
          </button>
        </div>
      </form>

      <div>
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-civic-600" aria-hidden="true" />
          <h4 className="text-sm font-black text-ink">Team recommendation engine</h4>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Scored on availability, live workload and category/skill match for this case.</p>

        {recoState === 'loading' && <div className="mt-3 h-24 animate-pulse rounded-xl bg-slate-100" />}
        {recoState === 'ready' && !recommendations.length && (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No active teams to score yet. Create a team first.</p>
        )}
        <ul className="mt-3 space-y-2">
          {recommendations.slice(0, 5).map((team, index) => (
            <li key={team._id} className={`rounded-xl border p-3 ${index === 0 ? 'border-civic-300 bg-civic-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-ink">{team.name}</span>
                    {index === 0 && <Pill tone="success">Best match</Pill>}
                    <StatusPill value={team.status} kind="team" />
                    <Pill tone="info">Score {team.score}</Pill>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{team.serviceArea || 'No service area'} · {(team.members || []).length} members</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => assignTeam(team)}
                  className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  <Users size={12} aria-hidden="true" /> Assign team
                </button>
              </div>
              <div className="mt-2">
                <WorkloadBar
                  value={Math.min(100, Math.round(((team.currentWorkload || 0) / (team.capacity || 5)) * 100))}
                  label={`${team.currentWorkload || 0} of ${team.capacity || 5} slots`}
                />
              </div>
              {team.reasons?.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                  {team.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

