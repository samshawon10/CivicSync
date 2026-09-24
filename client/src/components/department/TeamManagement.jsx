import { useEffect, useMemo, useState } from 'react';
import { Plus, Users, Wrench, Phone, MapPin, Pencil, RefreshCw } from 'lucide-react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import { showSuccess, showError } from '../../utils/sweetAlert.js';
import { Modal } from '../../components/ui/Overlays.jsx';
import {
  Panel,
  StatusPill,
  WorkloadBar,
  EmptyPanel,
  OpsError,
  StatTile,
  TextField,
  inputClass,
  primaryButton,
  secondaryButton,
  formatOpsDate
} from './DepartmentOpsUI.jsx';

const teamStatuses = ['available', 'busy', 'on_break', 'off_duty', 'offline', 'maintenance'];
const emptyDraft = { name: '', leaderId: '', memberIds: [], skills: '', serviceArea: '', capacity: 5, phone: '', notes: '', status: 'available' };

function toDraft(team) {
  return {
    name: team.name || '',
    leaderId: team.leader?._id || '',
    memberIds: (team.members || []).map((member) => member._id),
    skills: (team.skills || []).join(', '),
    serviceArea: team.serviceArea || '',
    capacity: team.capacity || 5,
    phone: team.phone || '',
    notes: team.notes || '',
    status: team.status || 'available'
  };
}

function TeamForm({ team, staff, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => (team ? toDraft(team) : emptyDraft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const workers = staff.filter((person) => ['field_worker', 'officer', 'department_officer'].includes(person.role));

  function set(key, value) { setDraft((current) => ({ ...current, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    if (!draft.name.trim()) { setError('Team name is required.'); return; }
    setBusy(true); setError('');
    try {
      const payload = {
        name: draft.name.trim(),
        leaderId: draft.leaderId || null,
        memberIds: draft.memberIds,
        skills: draft.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
        serviceArea: draft.serviceArea,
        capacity: Number(draft.capacity) || 5,
        phone: draft.phone,
        notes: draft.notes
      };
      if (team) {
        await departmentApi.updateTeam(team._id, { ...payload, leader: draft.leaderId || null, members: draft.memberIds, status: draft.status });
        showSuccess('Team updated', `${payload.name} was saved.`);
      } else {
        await departmentApi.createTeam(payload);
        showSuccess('Team created', `${payload.name} is ready for assignment.`);
      }
      onSaved();
    } catch (err) {
      const message = apiMessage(err);
      setError(message); showError('Unable to save team', message);
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={team ? `Edit ${team.name}` : 'Create response team'}
      subtitle="Teams group field workers so cases can be dispatched to a unit instead of individuals."
      size="lg"
      footer={<><button type="button" onClick={onClose} className={secondaryButton}>Cancel</button><button type="submit" form="team-form" disabled={busy} className={primaryButton}>{busy ? 'Saving…' : team ? 'Save changes' : 'Create team'}</button></>}
    >
      <form id="team-form" onSubmit={submit} className="space-y-4">
        <OpsError message={error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Team name">
            <input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Road Repair Unit A" maxLength={120} required />
          </TextField>
          <TextField label="Service area">
            <input className={inputClass} value={draft.serviceArea} onChange={(e) => set('serviceArea', e.target.value)} placeholder="e.g. Ward 12 – North" />
          </TextField>
          <TextField label="Team leader">
            <select className={inputClass} value={draft.leaderId} onChange={(e) => set('leaderId', e.target.value)}>
              <option value="">No leader assigned</option>
              {workers.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role.replaceAll('_', ' ')}</option>)}
            </select>
          </TextField>
          <TextField label="Contact number">
            <input className={inputClass} value={draft.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Team radio / phone" />
          </TextField>
          <TextField label="Capacity" hint="Maximum concurrent active tasks before this team is flagged overloaded.">
            <input type="number" min="1" max="50" className={inputClass} value={draft.capacity} onChange={(e) => set('capacity', e.target.value)} />
          </TextField>
          {team && (
            <TextField label="Team status">
              <select className={inputClass} value={draft.status} onChange={(e) => set('status', e.target.value)}>
                {teamStatuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
              </select>
            </TextField>
          )}
        </div>
        <TextField label="Skills" hint="Comma separated. Used by the team recommendation engine to match case categories.">
          <input className={inputClass} value={draft.skills} onChange={(e) => set('skills', e.target.value)} placeholder="road_infrastructure, drainage, street_light" />
        </TextField>
        <TextField label="Members" hint="Hold Ctrl/Cmd to select multiple workers.">
          <select
            multiple
            size={Math.min(6, Math.max(3, workers.length))}
            className={inputClass}
            value={draft.memberIds}
            onChange={(e) => set('memberIds', Array.from(e.target.selectedOptions).map((option) => option.value))}
          >
            {workers.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role.replaceAll('_', ' ')}</option>)}
          </select>
        </TextField>
        <TextField label="Notes">
          <textarea rows={3} className={inputClass} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Shift cover, equipment notes, escalation contacts…" />
        </TextField>
        {team && (
          <p className="text-xs text-slate-500">
            Created {formatOpsDate(team.createdAt)} · {team.activeTasksCount ?? 0} active task(s) · Workload {team.workloadPercent ?? 0}%
          </p>
        )}
      </form>
    </Modal>
  );
}

function TeamCard({ team, canManage, onEdit }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-black text-ink">{team.name}</h4>
          <p className="mt-0.5 text-xs text-slate-500">{team.serviceArea || 'No service area recorded'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusPill value={team.status} kind="team" />
          {canManage && (
            <button type="button" onClick={onEdit} aria-label={`Edit ${team.name}`} className={secondaryButton}>
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <WorkloadBar value={team.workloadPercent} label={`${team.activeTasksCount || 0} of ${team.capacity || 5} task slots`} />
      </div>

      <dl className="mt-3 grid gap-1.5 text-xs text-slate-600">
        <div className="flex items-start gap-1.5">
          <dt className="shrink-0 font-black uppercase tracking-wider text-slate-400">Leader</dt>
          <dd className="font-semibold">{team.leader?.name || 'Unassigned'}</dd>
        </div>
        <div className="flex items-start gap-1.5">
          <dt className="shrink-0 font-black uppercase tracking-wider text-slate-400">Members</dt>
          <dd className="font-semibold">{(team.members || []).map((member) => member.name).join(', ') || 'No members yet'}</dd>
        </div>
        {team.phone && (
          <div className="flex items-center gap-1.5">
            <Phone size={12} className="text-slate-400" aria-hidden="true" /><dd className="font-semibold">{team.phone}</dd>
          </div>
        )}
        {team.currentLocation?.address && (
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="text-slate-400" aria-hidden="true" /><dd className="truncate font-semibold">{team.currentLocation.address}</dd>
          </div>
        )}
      </dl>

      {(team.skills || []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {team.skills.map((skill) => (
            <span key={skill} className="rounded-full border border-civic-200 bg-civic-50 px-2 py-0.5 text-[11px] font-bold text-civic-700">{skill.replaceAll('_', ' ')}</span>
          ))}
        </div>
      )}

      {team.notes && <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">{team.notes}</p>}
    </article>
  );
}


export default function TeamManagement({ canManage = false }) {
  const [teams, setTeams] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const [{ data }, staffResult] = await Promise.all([
        departmentApi.teams(),
        canManage ? departmentApi.staff().catch(() => ({ data: { staff: [] } })) : Promise.resolve({ data: { staff: [] } })
      ]);
      setTeams(data.teams || []);
      setStaff(staffResult.data.staff || []);
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    total: teams.length,
    available: teams.filter((team) => team.status === 'available').length,
    busy: teams.filter((team) => team.status === 'busy').length,
    members: new Set(teams.flatMap((team) => (team.members || []).map((member) => member._id))).size,
    activeTasks: teams.reduce((sum, team) => sum + (team.activeTasksCount || 0), 0),
    overloaded: teams.filter((team) => (team.workloadPercent || 0) >= 100).length
  }), [teams]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Response teams" value={stats.total} hint={`${stats.members} assigned crew members`} icon={Users} />
        <StatTile label="Available now" value={stats.available} tone="success" hint={`${stats.busy} currently busy`} icon={Users} />
        <StatTile label="Active tasks" value={stats.activeTasks} tone="warning" hint="Across all teams" icon={Wrench} />
        <StatTile label="Over capacity" value={stats.overloaded} tone={stats.overloaded ? 'danger' : 'neutral'} hint="At or above declared capacity" icon={RefreshCw} />
      </div>

      <Panel
        title="Team roster & workload"
        subtitle="Workload is derived from live field task assignments per team."
        action={
          <div className="flex gap-2">
            <button type="button" onClick={load} className={secondaryButton}><RefreshCw size={14} className="mr-1 inline" /> Refresh</button>
            {canManage && (
              <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} className={primaryButton}>
                <Plus size={15} className="mr-1 inline" /> New team
              </button>
            )}
          </div>
        }
      >
        <OpsError message={error} onRetry={load} />
        {loading ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[0, 1].map((index) => <div key={index} className="h-40 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : teams.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {teams.map((team) => <TeamCard key={team._id} team={team} canManage={canManage} onEdit={() => { setEditing(team); setFormOpen(true); }} />)}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyPanel
              title="No response teams yet"
              message="Create a team to enable team-based dispatch, workload balancing and skill matching."
              action={canManage ? <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} className={primaryButton}>Create first team</button> : null}
            />
          </div>
        )}
      </Panel>

      {formOpen && (
        <TeamForm
          team={editing}
          staff={staff}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); }}
        />
      )}
    </div>
  );
}

