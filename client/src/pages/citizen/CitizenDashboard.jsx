import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReportForm from '../../components/reports/ReportForm.jsx';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import { mediaUrl, reportsApi } from '../../services/reportService.js';
import { apiMessage } from '../../services/api.js';

const label = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (x) => x.toUpperCase());
const editable = (report) => ['pending', 'verified'].includes(report.status);

function MediaPreview({ attachment }) {
  if (!attachment) return null;
  const src = mediaUrl(attachment);
  if (attachment.mediaType === 'video') return <video src={src} className="h-20 w-28 rounded-lg object-cover" muted preload="metadata" />;
  return <img src={src} alt={attachment.originalName || 'Report media'} className="h-20 w-28 rounded-lg object-cover" />;
}

export default function CitizenDashboard() {
  const [reports, setReports] = useState([]); const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, completed: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const [reportResponse, statsResponse] = await Promise.all([reportsApi.mine({ limit: 5 }), reportsApi.stats()]);
      setReports(reportResponse.data.reports); setStats(statsResponse.data.stats);
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);


  async function save(values) {
    setBusy(true);
    setError('');
    try {
      if (editing) {
        const { data } = await reportsApi.update(editing._id, values);
        setReports((items) => items.map((item) => item._id === data.report._id ? data.report : item));
        setMessage('Report updated successfully.');
        setEditing(null);
      } else {
        const { data } = await reportsApi.create(values);
        setReports((items) => [data.report, ...items]);
        setMessage('Report submitted successfully.');
      }
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(report) {
    setError('');
    try {
      await reportsApi.remove(report._id);
      setReports((items) => items.filter((item) => item._id !== report._id));
      setMessage('Report deleted successfully.');
      setDeleting(null);
    } catch (err) {
      setError(apiMessage(err));
    }
  }

  return (
    <CitizenLayout title="Dashboard">
      <section className="rounded-2xl bg-ink p-6 text-white"><p className="text-civic-100">Welcome back,</p><h2 className="mt-1 text-3xl font-bold">Your civic reports at a glance</h2><p className="mt-2 text-sm text-slate-300">Follow the progress of the issues you’ve raised in your community.</p></section>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Total Reports', stats.total],
          ['Pending Reports', stats.pending],
          ['In Progress', stats.inProgress], ['Completed', stats.completed], ['Closed', stats.closed]
        ].map(([name, value]) => (
          <div key={name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{name}</p>
            <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(320px,.8fr)_minmax(0,1.4fr)]">
        <ReportForm report={editing} onSave={save} onCancel={() => setEditing(null)} busy={busy} />
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-bold text-ink">My Reports</h2>
            <p className="mt-1 text-sm text-slate-500">Track every civic issue you submit.</p>
          </div>
          {message && <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
          {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          {loading ? <p className="py-10 text-center text-slate-500">Loading reports...</p> : reports.length ? (
            <div className="space-y-3">
              {reports.map((report) => {
                const attachments = report.attachments || [];
                return (
                  <article key={report._id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <MediaPreview attachment={attachments[0]} />
                        <div>
                          <h3 className="font-bold text-ink">{report.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">{label(report.category)} · {label(report.priority)} priority</p>
                          <p className="mt-1 text-sm text-slate-500">Department: {report.departmentName || 'Not assigned'}</p>
                        </div>
                      </div>
                      <span className="h-fit rounded-full bg-civic-50 px-2.5 py-1 text-xs font-bold text-civic-700">{label(report.status)}</span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-slate-600">{report.description}</p>
                    <p className="mt-3 text-xs text-slate-400">
                      Submitted {new Date(report.createdAt).toLocaleDateString()} · Updated {new Date(report.updatedAt).toLocaleDateString()}
                      {attachments.length ? ` · ${attachments.length} media file${attachments.length === 1 ? '' : 's'}` : ''}
                    </p>
                    <div className="mt-3 flex gap-3 text-sm font-bold">
                      <button onClick={() => navigate(`/dashboard/citizen/reports/${report._id}`)} className="text-civic-600">View</button>
                      {editable(report) && (
                        <>
                          <button onClick={() => setEditing(report)} className="text-civic-600">Edit</button>
                          <button onClick={() => setDeleting(report)} className="text-red-600">Delete</button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="font-semibold text-ink">You haven't submitted any civic reports yet.</p>
              <p className="mt-2 text-sm text-slate-500">Help improve your community by reporting a civic issue.</p>
            </div>
          )}
        </section>
      </div>
      {deleting && <div role="dialog" aria-modal="true" aria-labelledby="delete-report-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h2 id="delete-report-title" className="text-lg font-bold text-ink">Delete this report?</h2><p className="mt-2 text-sm text-slate-600">This cannot be undone. Any uploaded media will also be removed.</p><div className="mt-5 flex justify-end gap-3"><button onClick={() => setDeleting(null)} className="rounded-lg border px-4 py-2 font-bold">Cancel</button><button onClick={() => remove(deleting)} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white">Delete report</button></div></div></div>}
    </CitizenLayout>
  );
}
