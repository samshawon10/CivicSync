import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReportStatusTimeline from '../../components/reports/ReportStatusTimeline.jsx';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import { mediaUrl, reportsApi } from '../../services/reportService.js';
import { apiMessage } from '../../services/api.js';
import { SkeletonCard, SkeletonList } from '../../components/ui/Skeleton.jsx';
import { useToast } from '../../components/ui/Toaster.jsx';

const label = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (x) => x.toUpperCase());

function AttachmentGallery({ attachments = [] }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-6">
      <h2 className="font-bold text-ink">Photo and video evidence</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {attachments.map((attachment) => {
          const src = mediaUrl(attachment);
          return (
            <figure key={attachment.filename} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {attachment.mediaType === 'video'
                ? <video src={src} controls preload="metadata" className="aspect-video w-full object-cover" />
                : <img src={src} alt={attachment.originalName || 'Report media'} className="aspect-video w-full object-cover" />}
              <figcaption className="truncate px-3 py-2 text-xs text-slate-500">{attachment.originalName}</figcaption>
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
    <section className="mt-6 rounded-xl border border-civic-200 bg-civic-50/50 p-4">
      <h2 className="font-bold text-ink">Resolution verification</h2>
      {report.citizenResolution?.status === 'confirmed' ? (
        <>
          <p className="mt-2 text-sm text-emerald-800">You confirmed this resolution{report.citizenResolution.resolvedAt ? ` on ${new Date(report.citizenResolution.resolvedAt).toLocaleString()}` : ''}.</p>
          {!report.citizenFeedback?.submittedAt ? (
            <form onSubmit={submitFeedback} className="mt-4 space-y-3">
              <label className="block text-sm font-semibold" htmlFor="feedback-rating">Response rating
                <select id="feedback-rating" value={feedback.rating} onChange={(event) => setFeedback((current) => ({ ...current, rating: Number(event.target.value) }))} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <option value={5}>5 — Excellent</option><option value={4}>4 — Good</option><option value={3}>3 — Acceptable</option><option value={2}>2 — Needs improvement</option><option value={1}>1 — Poor</option>
                </select>
              </label>
              <label className="block text-sm font-semibold" htmlFor="feedback-comment">Feedback
                <textarea id="feedback-comment" required minLength={3} maxLength={1000} value={feedback.comment} onChange={(event) => setFeedback((current) => ({ ...current, comment: event.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2" placeholder="Tell us about the response." />
              </label>
              <button type="submit" disabled={busy} className="rounded-lg bg-civic-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Submit feedback</button>
            </form>
          ) : <p className="mt-2 text-sm text-slate-600">Feedback submitted: {report.citizenFeedback.rating}/5.</p>}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">{canReopen ? 'The department marked this report as completed. Confirm if the issue is resolved, or request reopening if work is still needed.' : 'This report is closed. You can confirm the recorded resolution, but closed reports cannot be reopened from the citizen portal.'}</p>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => verify('confirm')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Confirm resolved</button></div>
          {canReopen && <><label className="mt-3 block text-sm font-semibold" htmlFor="reopen-note">Request reopening<input id="reopen-note" value={reopenNote} onChange={(event) => setReopenNote(event.target.value)} maxLength={500} placeholder="Explain what remains unresolved" className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label><button type="button" disabled={busy || reopenNote.trim().length < 3} onClick={() => verify('reopen')} className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-50">Request reopening</button></>}
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

  return (
    <CitizenLayout title="Report details">
      <button type="button" onClick={() => navigate('/dashboard/citizen')} className="text-sm font-bold text-civic-600">Back to My Reports</button>
      {error ? <div className="mt-5 rounded-lg bg-red-50 p-3 text-red-700" role="alert">{error}</div> : !report ? <div className="mt-8 space-y-4"><SkeletonCard height={280} /><SkeletonList rows={3} /></div> : (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[.14em] text-civic-600">REPORT</p>
                <h1 className="mt-2 text-2xl font-bold text-ink">{report.title}</h1>
              </div>
              <span className="h-fit rounded-full bg-civic-50 px-3 py-1 text-xs font-bold text-civic-700">{label(report.status)}</span>
            </div>
            <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Category</dt>
                <dd className="mt-1 font-bold text-ink">{label(report.category)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Department</dt>
                <dd className="mt-1 font-bold text-ink">{report.departmentName || 'Not assigned'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Priority</dt>
                <dd className="mt-1 font-bold text-ink">{label(report.priority)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Submitted</dt>
                <dd className="mt-1 font-bold text-ink">{new Date(report.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last updated</dt>
                <dd className="mt-1 font-bold text-ink">{new Date(report.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>
            <h2 className="mt-6 font-bold text-ink">Description</h2>
            <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-600">{report.description}</p>
            {(report.location?.area || report.location?.address || report.location?.landmark) && <section className="mt-6"><h2 className="font-bold text-ink">Location</h2><p className="mt-2 text-sm text-slate-600">{[report.location.area, report.location.address, report.location.landmark].filter(Boolean).join(' · ')}</p></section>}
            <AttachmentGallery attachments={report.attachments} />
            <ResolutionVerification report={report} busy={busy} reopenNote={reopenNote} setReopenNote={setReopenNote} feedback={feedback} setFeedback={setFeedback} verify={verify} submitFeedback={submitFeedback} />
          </section>
          <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-ink">Report Status</h2>
            <div className="mt-5"><ReportStatusTimeline status={report.status} /></div>
            {report.activity?.length ? <div className="mt-7 border-t pt-5"><h2 className="font-bold text-ink">Activity</h2><ul className="mt-3 space-y-3">{report.activity.map((item, index) => <li key={`${item.timestamp}-${index}`} className="text-sm"><p className="font-medium text-slate-700">{item.action}</p><p className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</p></li>)}</ul></div> : null}
            <Link to="/dashboard/citizen" className="mt-6 inline-block text-sm font-bold text-civic-600">View all reports</Link>
          </aside>
        </div>
      )}
    </CitizenLayout>
  );
}
