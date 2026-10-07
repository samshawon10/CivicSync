import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReportForm from '../../components/reports/ReportForm.jsx';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import { reportsApi } from '../../services/reportService.js';
import { apiMessage } from '../../services/api.js';
import { showSuccess } from '../../utils/sweetAlert.js';

export default function CreateReport() {
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [duplicateCandidates, setDuplicateCandidates] = useState([]);
  const [pendingPayload, setPendingPayload] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Pre-select a department when arriving from the citizen departments page
  const prefilledDepartment = searchParams.get('department') || '';

  async function save(values) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const { data } = await reportsApi.create(values);
      showSuccess(
        data.report?.relationType === 'DUPLICATE' ? 'Report linked' : 'Report submitted',
        data.message || 'Your civic report was sent to the selected department.'
      );
      navigate(`/dashboard/citizen/reports/${data.report._id}`);
    } catch (err) {
      const response = err.response?.data;
      if (response?.code === 'POTENTIAL_DUPLICATES' || response?.code === 'DUPLICATE_CANDIDATE_CHANGED') {
        setDuplicateCandidates(response.duplicateCandidates || []);
        setPendingPayload(values);
        setError('');
      } else {
        setError(apiMessage(err));
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <CitizenLayout title="Create a report">
      <div className="mx-auto max-w-3xl">
        <p className="mb-5 text-slate-600 dark:text-slate-300">
          Tell us what needs attention. We'll send it to the selected civic department.
        </p>
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        {duplicateCandidates.length > 0 && (
          <section aria-labelledby="duplicate-issues-title" className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-xs font-black uppercase tracking-[.14em] text-amber-800 dark:text-amber-300">Possible existing issue</p>
            <h2 id="duplicate-issues-title" className="mt-1 text-lg font-bold text-ink dark:text-slate-100">
              An issue similar to yours has already been reported nearby.
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Review the public issue details. You can link your report or keep it separate.
            </p>
            <div className="mt-4 space-y-3">
              {duplicateCandidates.map((candidate) => (
                <article key={candidate.id} className="rounded-xl border border-amber-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-ink dark:text-slate-100">{candidate.title}</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {candidate.category.replaceAll('_', ' ')} · {candidate.location.area || 'Nearby'} · approx. {candidate.location.distanceMeters} m away
                      </p>
                    </div>
                    <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-bold text-civic-800 dark:bg-civic-500/10 dark:text-civic-300">
                      {String(candidate.status).replaceAll('_', ' ').toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{candidate.description}</p>
                  <button
                    type="button"
                    disabled={busy || !pendingPayload}
                    onClick={() => save({ ...pendingPayload, duplicateDecision: 'duplicate', duplicateOf: candidate.id })}
                    className="mt-3 min-h-11 rounded-lg bg-civic-700 px-4 py-2 text-sm font-bold text-white hover:bg-civic-800 disabled:opacity-50"
                  >
                    This is the same issue
                  </button>
                </article>
              ))}
            </div>
            <button
              type="button"
              disabled={busy || !pendingPayload}
              onClick={() => save({ ...pendingPayload, duplicateDecision: 'separate' })}
              className="mt-4 min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              Report a different issue
            </button>
          </section>
        )}
        <ReportForm onSave={save} busy={busy} prefilledDepartment={prefilledDepartment} />
      </div>
    </CitizenLayout>
  );
}
