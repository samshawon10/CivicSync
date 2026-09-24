import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ShieldAlert, RefreshCw, Clock, ArrowRight, CheckCircle2, Flame } from 'lucide-react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import {
  Panel,
  PriorityPill,
  StatusPill,
  SlaPill,
  EmptyPanel,
  OpsError,
  StatTile,
  secondaryButton,
  formatOpsDate
} from './DepartmentOpsUI.jsx';
import ResolveEscalationModal from './ResolveEscalationModal.jsx';
import useDepartmentSync from './useDepartmentSync.js';

function CaseRow({ report, isHead, onResolve, onOpenCase, reason }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill value={report.priority} />
            <StatusPill value={report.status} />
            <SlaPill sla={report.sla} />
          </div>
          <h4 className="mt-2 font-black text-ink">{report.title}</h4>
          {reason && <p className="mt-1 text-sm font-semibold text-red-700">{reason}</p>}
          <p className="mt-1 text-xs text-slate-500">
            Officer {report.assignedOfficer?.name || 'unassigned'} · Field worker {report.assignedFieldWorker?.name || 'unassigned'}
            {report.assignedTeam?.name ? ` · Team ${report.assignedTeam.name}` : ''}
          </p>
          <p className="mt-1 text-xs text-slate-500">Case deadline {formatOpsDate(report.dueAt)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onOpenCase && (
            <button type="button" onClick={() => onOpenCase(report._id)} className={secondaryButton}>
              Open case <ArrowRight size={13} className="ml-1 inline" />
            </button>
          )}
          {isHead && report.escalation?.isEscalated && !report.escalation?.resolvedAt && (
            <button type="button" onClick={() => onResolve(report)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700">
              <CheckCircle2 size={14} aria-hidden="true" /> Resolve
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

const tabs = [
  { id: 'escalated', label: 'Escalation queue' },
  { id: 'breached', label: 'SLA breached' },
  { id: 'overdue', label: 'Overdue cases' }
];

export default function EscalationCenter({ role, onOpenCase }) {
  const isHead = role === 'department_head';
  const [escalated, setEscalated] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [all, setAll] = useState([]);
  const [tab, setTab] = useState('escalated');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [escalatedResult, overdueResult, allResult] = await Promise.all([
        departmentApi.reports({ escalated: 'true', limit: 50, sort: 'priority' }),
        departmentApi.reports({ overdue: 'true', limit: 50, sort: 'priority' }),
        departmentApi.reports({ limit: 50, sort: 'priority' })
      ]);
      setEscalated(escalatedResult.data.reports || []);
      setOverdue(overdueResult.data.reports || []);
      setAll(allResult.data.reports || []);
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useDepartmentSync(load);

  const breached = useMemo(() => all.filter((report) => report.sla?.overallStatus === 'breached'), [all]);
  const urgentUnassigned = useMemo(
    () => all.filter((report) => report.priority === 'urgent' && !report.assignedOfficer && !report.assignedTeam && !['completed', 'closed'].includes(report.status)),
    [all]
  );

  const lists = { escalated, breached, overdue };
  const visible = lists[tab] || [];
  const emptyMessages = {
    escalated: ['No open escalations', 'Cases escalated by officers with a reason will appear here for head resolution.'],
    breached: ['No SLA breaches', 'Every open case is still inside its response, arrival and resolution targets.'],
    overdue: ['No overdue cases', 'No open case has passed its deadline.']
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Open escalations" value={escalated.length} tone={escalated.length ? 'danger' : 'success'} icon={ShieldAlert} hint={isHead ? 'Awaiting your resolution' : 'Awaiting head resolution'} />
        <StatTile label="SLA breached" value={breached.length} tone={breached.length ? 'warning' : 'success'} icon={AlertTriangle} hint="Response, arrival or resolution" />
        <StatTile label="Overdue cases" value={overdue.length} tone={overdue.length ? 'warning' : 'success'} icon={Clock} hint="Past deadline and still open" />
        <StatTile label="Urgent & unassigned" value={urgentUnassigned.length} tone={urgentUnassigned.length ? 'danger' : 'success'} icon={Flame} hint="No officer or team yet" />
      </div>

      <Panel
        title="Escalation & SLA control tower"
        subtitle="Escalations raise a case to urgent priority and notify every Department Head in the department."
        action={<button type="button" onClick={load} className={secondaryButton}><RefreshCw size={14} className="mr-1 inline" /> Refresh</button>}
      >
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${tab === item.id ? 'border-ink bg-ink text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-civic-300'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4"><OpsError message={error} onRetry={load} /></div>

        {loading ? (
          <div className="mt-4 space-y-3">{[0, 1, 2].map((index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : visible.length ? (
          <div className="mt-4 space-y-3">
            {visible.map((report) => (
              <CaseRow
                key={report._id}
                report={report}
                isHead={isHead}
                onResolve={setResolving}
                onOpenCase={onOpenCase}
                reason={tab === 'escalated' ? report.escalation?.reason : tab === 'breached' ? 'SLA target breached — immediate intervention required.' : null}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4"><EmptyPanel title={emptyMessages[tab][0]} message={emptyMessages[tab][1]} /></div>
        )}
      </Panel>

      {resolving && <ResolveEscalationModal report={resolving} onClose={() => setResolving(null)} onResolved={() => { setResolving(null); load(); }} />}
    </div>
  );
}

