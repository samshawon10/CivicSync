import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import { reportsApi } from '../../services/reportService.js';
import { apiMessage } from '../../services/api.js';
import { SkeletonList } from '../../components/ui/Skeleton.jsx';
import { citizenStageLabel } from '../../components/department/workflowLabels.js';

const label = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const statuses = ['pending', 'verified', 'assigned', 'in_progress', 'under_review', 'completed', 'closed'];
const displayStatus = (report) => report.masterCaseSummary?.workflowStage
  ? citizenStageLabel(report.masterCaseSummary.workflowStage)
  : report.workflowStage
    ? citizenStageLabel(report.workflowStage)
    : label(report.status);

export default function CitizenReports() {
  const [reports, setReports] = useState([]);
  const [meta, setMeta] = useState({});
  const [params, setParams] = useState({ search: '', status: '', priority: '', sort: 'newest', page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await reportsApi.mine(params);
        if (!active) return;
        setReports(data.reports || []);
        setMeta(data.pagination || {});
      } catch (requestError) {
        if (active) setError(apiMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [params]);

  const set = (key, value) => setParams((current) => ({
    ...current,
    [key]: value,
    page: key === 'page' ? value : 1
  }));

  return (
    <CitizenLayout title="My reports">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row">
        <input value={params.search} onChange={(event) => set('search', event.target.value)} placeholder="Search title or description" aria-label="Search reports" />
        <select value={params.status} onChange={(event) => set('status', event.target.value)} aria-label="Filter reports by status">
          <option value="">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
        </select>
        <select value={params.priority} onChange={(event) => set('priority', event.target.value)} aria-label="Filter reports by priority">
          <option value="">All priorities</option>
          {['low', 'medium', 'high', 'urgent'].map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}
        </select>
        <select value={params.sort} onChange={(event) => set('sort', event.target.value)} aria-label="Sort reports">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="updated">Recently updated</option>
        </select>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      <div className="mt-5 grid gap-3">
        {loading ? <SkeletonList rows={5} /> : reports.length ? reports.map((report) => {
          const master = report.masterCaseSummary;
          const linked = report.relationType === 'DUPLICATE' || (master?.id && master.id !== report._id);
          return (
            <article key={report._id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="font-bold text-ink dark:text-slate-100">{report.title}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {[report.reference || report.reportId, label(report.category), report.departmentName, `${label(report.priority)} priority`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="h-fit rounded-full bg-civic-50 px-3 py-1 text-xs font-bold text-civic-700 dark:bg-civic-500/10 dark:text-civic-300">
                  {displayStatus(report)}
                </span>
              </div>
              {linked && master && (
                <div className="mt-3 rounded-lg border border-civic-200 bg-civic-50/70 p-3 text-sm dark:border-civic-800 dark:bg-civic-950/30">
                  <p className="font-bold text-civic-900 dark:text-civic-200">Linked to existing issue</p>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{master.title} · {master.reportCount} citizen report{master.reportCount === 1 ? '' : 's'}</p>
                </div>
              )}
              {!linked && master?.reportCount > 1 && (
                <p className="mt-3 text-sm font-semibold text-civic-700 dark:text-civic-300">
                  Master civic issue · {master.reportCount} citizen reports
                </p>
              )}
              <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{report.description}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Updated {new Date(report.updatedAt).toLocaleDateString()}</span>
                <Link className="font-bold text-civic-600 dark:text-civic-300" to={`/dashboard/citizen/reports/${report._id}`}>View details</Link>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-xl bg-white p-10 text-center dark:bg-slate-900">
            <p className="font-bold text-ink dark:text-slate-100">No reports match your filters.</p>
            <Link to="/dashboard/citizen/reports/new" className="mt-3 inline-block font-bold text-civic-600 dark:text-civic-300">Create a report</Link>
          </div>
        )}
      </div>
      {meta.pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <button type="button" disabled={params.page <= 1} onClick={() => set('page', params.page - 1)} className="rounded border px-3 py-2 disabled:opacity-40">Previous</button>
          <span className="text-sm">Page {meta.page} of {meta.pages}</span>
          <button type="button" disabled={params.page >= meta.pages} onClick={() => set('page', params.page + 1)} className="rounded border px-3 py-2 disabled:opacity-40">Next</button>
        </div>
      )}
    </CitizenLayout>
  );
}
