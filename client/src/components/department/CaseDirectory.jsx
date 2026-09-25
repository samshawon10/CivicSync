import { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, ArrowRight } from 'lucide-react';
import { departmentApi } from '../../services/departmentService.js';
import { apiMessage } from '../../services/api.js';
import { Panel, PriorityPill, StatusPill, SlaPill, EmptyPanel, OpsError, secondaryButton, inputClass, formatOpsDate } from './DepartmentOpsUI.jsx';
import useDepartmentSync from './useDepartmentSync.js';

const statusOptions = ['', 'pending', 'verified', 'assigned', 'in_progress', 'under_review', 'completed', 'closed'];
const priorityOptions = ['', 'urgent', 'high', 'medium', 'low'];

/** Searchable case directory — the entry point into the unified case workspace. */
export default function CaseDirectory({ onOpenCase, title = 'Case workspace directory' }) {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await departmentApi.reports({
        search,
        status,
        priority,
        overdue: overdue ? 'true' : '',
        escalated: escalated ? 'true' : '',
        limit: 30,
        sort: 'priority'
      });
      setReports(data.reports || []);
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }, [search, status, priority, overdue, escalated]);

  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);
  useDepartmentSync(load);

  return (
    <Panel
      title={title}
      subtitle="Open any case to manage its SLA position, dispatch, escalation, handover, messages and activity."
      action={<button type="button" onClick={load} className={secondaryButton}><RefreshCw size={14} className="mr-1 inline" /> Refresh</button>}
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block sm:col-span-2 xl:col-span-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <span className="sr-only">Search cases</span>
          <input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search case title or details…" />
        </label>
        <select className={inputClass} aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          {statusOptions.map((value) => <option key={value || 'all'} value={value}>{value ? value.replaceAll('_', ' ') : 'All statuses'}</option>)}
        </select>
        <select className={inputClass} aria-label="Filter by priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
          {priorityOptions.map((value) => <option key={value || 'all'} value={value}>{value || 'All priorities'}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={overdue} onChange={(event) => setOverdue(event.target.checked)} /> Overdue only
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={escalated} onChange={(event) => setEscalated(event.target.checked)} /> Escalated only
          </label>
        </div>
      </div>
      <div className="mt-4"><OpsError message={error} onRetry={load} /></div>
      {loading ? (
        <div className="mt-4 space-y-2">{[0, 1, 2, 3].map((index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : reports.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Case</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">SLA</th>
                <th className="px-3 py-2">Next action</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report._id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                  <td className="max-w-xs px-3 py-3">
                    <p className="text-[11px] font-black text-slate-400">#{report._id.slice(-6).toUpperCase()}</p>
                    <p className="font-bold text-ink">{report.title}</p>
                    <p className="text-xs text-slate-500">{String(report.category || '').replaceAll('_', ' ')}</p>
                  </td>
                  <td className="px-3 py-3"><PriorityPill value={report.priority} /></td>
                  <td className="px-3 py-3"><StatusPill value={report.status} /></td>
                  <td className="px-3 py-3"><SlaPill sla={report.sla} /></td>
                  <td className="max-w-xs px-3 py-3 text-xs text-slate-600">
                    <p className="font-bold text-slate-700">{report.nextAction?.action || '—'}</p>
                    <p>{report.nextAction?.responsibleRole ? String(report.nextAction.responsibleRole).replaceAll('_', ' ') : ''}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">{report.assignedOfficer?.name || 'Unassigned'}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{formatOpsDate(report.dueAt)}</td>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => onOpenCase(report._id)} className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white">
                      Open <ArrowRight size={12} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4"><EmptyPanel title="No cases match these filters" message="Adjust the search, status or SLA filters to find department cases." /></div>
      )}


    </Panel>
  );
}
