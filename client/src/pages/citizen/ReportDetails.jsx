import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReportStatusTimeline from '../../components/reports/ReportStatusTimeline.jsx';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import { mediaUrl, reportsApi } from '../../services/reportService.js';
import { apiMessage } from '../../services/api.js';
import { SkeletonCard, SkeletonList } from '../../components/ui/Skeleton.jsx';
import { useToast } from '../../components/ui/Toaster.jsx';
import AIBriefingCard from '../../components/ai/AIBriefingCard.jsx';
import ReportForm from '../../components/reports/ReportForm.jsx';
import { confirmAction } from '../../utils/sweetAlert.js';

const label = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (x) => x.toUpperCase());

function AttachmentGallery({ attachments = [] }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-6">
      <h2 className="font-bold text-ink dark:text-slate-100">Photo and video evidence</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {attachments.map((attachment) => {
          const src = mediaUrl(attachment);
          return (
            <figure key={attachment.filename} className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              {attachment.mediaType === 'video'
                ? <video src={src} controls preload="metadata" className="aspect-video w-full object-cover" />
                : <img src={src} alt={attachment.originalName || 'Report media'} className="aspect-video w-full object-cover" />}
              <figcaption className="truncate px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{attachment.originalName}</figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

function ResolutionVerification({ report, busy, reopenNote, setReopenNote, feedback, setFeedback, verify, submitFeedback }) {
  if (!['completed', 'closed'].includes(report.status)) return null;
  const canReopen = report.status === 'completed';
  return (
    <section className="mt-6 rounded-xl border border-civic-200 dark:border-civic-800 bg-civic-50/50 p-4">
      <h2 className="font-bold text-ink dark:text-slate-100">Resolution verification</h2>
      {report.citizenResolution?.status === 'confirmed' ? (
        <>
          <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">You confirmed this resolution{report.citizenResolution.resolvedAt ? ` on ${new Date(report.citizenResolution.resolvedAt).toLocaleString()}` : ''}.</p>
          {!report.citizenFeedback?.submittedAt ? (
            <form onSubmit={submitFeedback} className="mt-4 space-y-3">
              <label className="block text-sm font-semibold" htmlFor="feedback-rating">Response rating
                <select id="feedback-rating" value={feedback.rating} onChange={(event) => setFeedback((current) => ({ ...current, rating: Number(event.target.value) }))} className="mt-1 block rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                  <option value={5}>5 — Excellent</option><option value={4}>4 — Good</option><option value={3}>3 — Acceptable</option><option value={2}>2 — Needs improvement</option><option value={1}>1 — Poor</option>
                </select>
              </label>
              <label className="block text-sm font-semibold" htmlFor="feedback-comment">Feedback
                <textarea id="feedback-comment" required minLength={3} maxLength={1000} value={feedback.comment} onChange={(event) => setFeedback((current) => ({ ...current, comment: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2" placeholder="Tell us about the response." />
              </label>
              <button type="submit" disabled={busy} className="rounded-lg bg-civic-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Submit feedback</button>
            </form>
          ) : <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Feedback submitted: {report.citizenFeedback.rating}/5.</p>}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{canReopen ? 'The department marked this report as completed. Confirm if the issue is resolved, or request reopening if work is still needed.' : 'This report is closed. You can confirm the recorded resolution, but closed reports cannot be reopened from the citizen portal.'}</p>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => verify('confirm')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Confirm resolved</button></div>
          {canReopen && <><label className="mt-3 block text-sm font-semibold" htmlFor="reopen-note">Request reopening<input id="reopen-note" value={reopenNote} onChange={(event) => setReopenNote(event.target.value)} maxLength={500} placeholder="Explain what remains unresolved" className="mt-1 block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2" /></label><button type="button" disabled={busy || reopenNote.trim().length < 3} onClick={() => verify('reopen')} className="mt-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-4 py-2 text-sm font-bold text-amber-800 dark:text-amber-300 disabled:opacity-50">Request reopening</button></>}
        </>
      )}
    </section>
  );
}


export default function ReportDetails() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reopenNote, setReopenNote] = useState('');
  const [feedback, setFeedback] = useState({ rating: 5, comment: '' });
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  async function load() {
    setError('');
    try { const { data } = await reportsApi.get(id); setReport(data.report); } catch (loadError) { setError(apiMessage(loadError)); }
  }
  useEffect(() => { load(); }, [id]);

  async function verify(action) {
    setBusy(true); setError('');
    try { const { data } = await reportsApi.verifyResolution(id, { action, note: reopenNote }); setReport(data.report); setReopenNote(''); toast.success(data.message); } catch (verifyError) { setError(apiMessage(verifyError)); } finally { setBusy(false); }
  }
  async function submitFeedback(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const { data } = await reportsApi.feedback(id, feedback); setReport(data.report); toast.success(data.message); } catch (feedbackError) { setError(apiMessage(feedbackError)); } finally { setBusy(false); }
  }

  async function saveEdit(values) {
    setBusy(true); setError('');
    try {
      const { data } = await reportsApi.update(id, values);
      setReport(data.report); setEditing(false); toast.success(data.message);
    } catch (editError) { setError(apiMessage(editError)); } finally { setBusy(false); }
  }

  async function removeReport() {
    const confirmed = await confirmAction({ title: 'Delete this report?', text: 'This draft report and its uploaded evidence will be permanently removed.', confirmLabel: 'Delete report', requireText: 'DELETE' });
    if (!confirmed) return;
    setBusy(true); setError('');
    try {
      const { data } = await reportsApi.remove(id);
      toast.success(data.message); navigate('/dashboard/citizen/reports');
    } catch (deleteError) { setError(apiMessage(deleteError)); } finally { setBusy(false); }
  }

  return (
    <CitizenLayout title="Report details">
      <button type="button" onClick={() => navigate('/dashboard/citizen/reports')} className="text-sm font-bold text-civic-600 dark:text-civic-300">Back to My Reports</button>
      {error ? <div className="mt-5 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-red-700 dark:text-red-300" role="alert">{error}</div> : !report ? <div className="mt-8 space-y-4"><SkeletonCard height={280} /><SkeletonList rows={3} /></div> : (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[.14em] text-civic-600 dark:text-civic-300">REPORT</p>
                <h1 className="mt-2 text-2xl font-bold text-ink dark:text-slate-100">{report.title}</h1>
              </div>
              <span className="h-fit rounded-full bg-civic-50 dark:bg-civic-500/10 px-3 py-1 text-xs font-bold text-civic-700 dark:text-civic-300">{label(report.status)}</span>
            </div>
            <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Category</dt>
                <dd className="mt-1 font-bold text-ink dark:text-slate-100">{label(report.category)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Department</dt>
                <dd className="mt-1 font-bold text-ink dark:text-slate-100">{report.departmentName || 'Not assigned'}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Priority</dt>
                <dd className="mt-1 font-bold text-ink dark:text-slate-100">{label(report.priority)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Submitted</dt>
                <dd className="mt-1 font-bold text-ink dark:text-slate-100">{new Date(report.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Last updated</dt>
                <dd className="mt-1 font-bold text-ink dark:text-slate-100">{new Date(report.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>
            <h2 className="mt-6 font-bold text-ink dark:text-slate-100">Description</h2>
            <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-600 dark:text-slate-300">{report.description}</p>
            {['pending', 'verified'].includes(report.status) && <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => setEditing((current) => !current)} className="civic-secondary">{editing ? 'Close editor' : 'Edit report'}</button><button type="button" disabled={busy} onClick={removeReport} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300">Delete report</button></div>}
            {editing && <div className="mt-6"><ReportForm report={report} onSave={saveEdit} onCancel={() => setEditing(false)} busy={busy} /></div>}
            {/* Contextual AI. Only the report id/title are sent; the gateway re-authorizes
                and loads the case server-side, so no case data travels through the client. */}
            <AIBriefingCard
              className="mt-6"
              presetKey="case"
              context={{ caseId: report._id, caseRef: report.reportId || report._id, caseTitle: report.title, caseStatus: report.status, caseCategory: report.category }}
              title="✦ Ask CivicSync AI"
              subtitle="Get a grounded explanation of this case."
              description="Ask for a summary, the timeline, SLA status, or help drafting a citizen update."
              stats={[
                { label: 'Status', value: label(report.status) },
                { label: 'Priority', value: label(report.priority) },
                { label: 'Activity entries', value: report.activity?.length || 0 }
              ]}
              actionLabel="Ask about this case"
            />
            {(report.location?.area || report.location?.address || report.location?.landmark) && <section className="mt-6"><h2 className="font-bold text-ink dark:text-slate-100">Location</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{[report.location.area, report.location.address, report.location.landmark].filter(Boolean).join(' · ')}</p></section>}
            <AttachmentGallery attachments={report.attachments} />
            <ResolutionVerification report={report} busy={busy} reopenNote={reopenNote} setReopenNote={setReopenNote} feedback={feedback} setFeedback={setFeedback} verify={verify} submitFeedback={submitFeedback} />
          </section>
          <aside className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="font-bold text-ink dark:text-slate-100">Report Status</h2>
            <div className="mt-5"><ReportStatusTimeline status={report.status} /></div>
            {report.activity?.length ? <div className="mt-7 border-t pt-5"><h2 className="font-bold text-ink dark:text-slate-100">Activity</h2><ul className="mt-3 space-y-3">{report.activity.map((item, index) => <li key={`${item.timestamp}-${index}`} className="text-sm"><p className="font-medium text-slate-700 dark:text-slate-200">{item.action}</p><p className="text-xs text-slate-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleString()}</p></li>)}</ul></div> : null}
            <Link to="/dashboard/citizen/reports" className="mt-6 inline-block text-sm font-bold text-civic-600 dark:text-civic-300">View all reports</Link>
          </aside>
        </div>
      )}
    </CitizenLayout>
  );
}
