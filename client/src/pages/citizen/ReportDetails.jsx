import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReportStatusTimeline from '../../components/reports/ReportStatusTimeline.jsx';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import { mediaUrl, reportsApi } from '../../services/reportService.js';
import { apiMessage } from '../../services/api.js';

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

export default function ReportDetails() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    reportsApi.get(id).then(({ data }) => setReport(data.report)).catch((err) => setError(apiMessage(err)));
  }, [id]);

  return (
    <CitizenLayout title="Report details">
      <button type="button" onClick={() => navigate('/dashboard/citizen')} className="text-sm font-bold text-civic-600">Back to My Reports</button>
      {error ? <p className="mt-5 rounded-lg bg-red-50 p-3 text-red-700">{error}</p> : !report ? <p className="mt-8 text-slate-500">Loading report...</p> : (
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
