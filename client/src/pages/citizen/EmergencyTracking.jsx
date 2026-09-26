import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import EmergencyTimeline from '../../components/emergency/EmergencyTimeline.jsx';
import EmergencyMap from '../../components/emergency/EmergencyMap.jsx';
import ResponderTracker from '../../components/emergency/ResponderTracker.jsx';
import EvidenceUploader from '../../components/emergency/EvidenceUploader.jsx';
import SeverityBadge from '../../components/emergency/SeverityBadge.jsx';
import EmergencyStatusBadge from '../../components/emergency/EmergencyStatusBadge.jsx';
import { ErrorState, LoadingState } from '../../components/emergency/EmergencyCard.jsx';
import { emergencyApi, label } from '../../services/emergencyService.js';
import { apiMessage } from '../../services/api.js';
import useEmergencyEvents from '../../hooks/useEmergencyEvents.js';

const activeStatuses = ['reported', 'received', 'assessing', 'verified', 'dispatched', 'en_route', 'on_scene', 'responding', 'escalated', 'requires_backup'];

export default function EmergencyTracking() {
  const { id } = useParams();
  const routeState = useLocation().state || {};
  const [emergency, setEmergency] = useState(null);
  const [positions, setPositions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifyNotice, setVerifyNotice] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const { online, refreshKey } = useEmergencyEvents((event) => {
    if (event?.emergencyId === id || event?.publicId === emergency?.emergencyId) load();
  });

  const load = useCallback(async () => {
    try {
      const [emergencyResult, positionsResult] = await Promise.all([
        emergencyApi.get(id),
        emergencyApi.responderPositions(id).catch(() => ({ data: { positions: [] } }))
      ]);
      setEmergency(emergencyResult.data.emergency);
      setPositions(positionsResult.data.positions || []);
      setError('');
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 8000);
    return () => window.clearInterval(timer);
  }, [load, refreshKey]);

  async function verify(stillHappening) {
    setVerifyBusy(true); setVerifyNotice(''); setError('');
    try {
      const { data } = await emergencyApi.verify(id, { stillHappening });
      setVerifyNotice(data.message);
      setEmergency((current) => current ? { ...current, communityVerification: { ...current.communityVerification, ...data.communityVerification } } : current);
    } catch (err) { setError(apiMessage(err)); } finally { setVerifyBusy(false); }
  }

  if (loading) return <CitizenLayout title="Emergency tracking"><LoadingState text="Loading emergency…" /></CitizenLayout>;
  if (!emergency) return <CitizenLayout title="Emergency tracking"><ErrorState message={error || 'Emergency not found.'} onRetry={load} /></CitizenLayout>;

  const isActive = activeStatuses.includes(emergency.status);
  const verification = emergency.communityVerification || {};

  return (
    <CitizenLayout title={`Tracking ${emergency.emergencyId}`}>
      <div className="mx-auto max-w-4xl space-y-5">
        {!online && <p className="rounded-lg bg-slate-800 p-3 text-sm font-bold text-white">⚠ Offline — live updates paused.</p>}
        {routeState.created && <p className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Emergency submitted. Emergency Command has been notified.</p>}
        <ErrorState message={error} onRetry={load} />

        <section className="civic-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-red-700 dark:text-red-300">{emergency.emergencyId}</p>
                <SeverityBadge value={emergency.severity} />
                <EmergencyStatusBadge value={emergency.status} />
                {emergency.visibility === 'restricted' && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-black uppercase text-purple-700">Restricted</span>}
                {emergency.discreet && <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">Discreet</span>}
              </div>
              <h2 className="mt-1 text-2xl font-black text-ink dark:text-slate-100">{emergency.title}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{label(emergency.category)}{emergency.subcategory && emergency.subcategory !== 'other' ? ` · ${emergency.subcategory.replaceAll('_', ' ')}` : ''} · reported {new Date(emergency.createdAt).toLocaleString()}</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{emergency.description || 'No additional description provided.'}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">📍 {emergency.location?.address || 'Location shared privately with responders'}</p>

          {emergency.personDetails?.name && (
            <div className="mt-3 rounded-lg bg-purple-50 p-3 text-sm">
              <p className="font-black text-purple-800">Person details (restricted)</p>
              <p className="text-purple-900">{emergency.personDetails.name}{emergency.personDetails.age ? `, ~${emergency.personDetails.age}` : ''} · {emergency.personDetails.clothing || 'no clothing description'}</p>
              <p className="text-xs text-purple-700">Last seen: {emergency.personDetails.lastSeenAt ? new Date(emergency.personDetails.lastSeenAt).toLocaleString() : '—'} {emergency.personDetails.lastKnownAddress ? `· ${emergency.personDetails.lastKnownAddress}` : ''}</p>
            </div>
          )}

          {emergency.status === 'requires_backup' && <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm font-bold text-red-700 dark:text-red-300">⚠ Backup has been requested for this incident — command is organizing additional teams.</p>}
        </section>

        <section className="civic-card p-5">
          <h3 className="font-black text-ink dark:text-slate-100">Response timeline</h3>
          <div className="mt-3"><EmergencyTimeline emergency={emergency} /></div>
        </section>

        <section className="civic-card p-5">
          <h3 className="font-black text-ink dark:text-slate-100">Response teams</h3>
          {emergency.responseAssignments?.length ? (
            <div className="mt-3 space-y-2">
              {emergency.responseAssignments.map((assignment) => (
                <article key={assignment._id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-ink dark:text-slate-100">{label(assignment.responseType)} {assignment.responseTeam ? `· ${assignment.responseTeam}` : ''}</p>
                    <EmergencyStatusBadge value={assignment.status} />
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">Officer: {assignment.emergencyOfficer?.name || 'Unassigned'} · {assignment.fieldWorkers?.length || 0} field worker(s)</p>
                  {assignment.etaMinutes != null && <p className="text-xs text-slate-500 dark:text-slate-400">ETA: {assignment.etaMinutes} min</p>}
                </article>
              ))}
            </div>

          ) : <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No response team dispatched yet. Emergency Command is reviewing the incident.</p>}
        </section>

        {isActive && <ResponderTracker emergency={emergency} refreshKey={refreshKey} />}

        {Number.isFinite(emergency.location?.latitude) && (
          <section className="civic-card p-5">
            <h3 className="font-black text-ink dark:text-slate-100">Incident map</h3>
            <div className="mt-3">
              <EmergencyMap
                height="h-72"
                showControls={false}
                emergencies={[emergency]}
                responders={positions}
                selectedId={emergency._id}
              />
            </div>
          </section>
        )}

        <EvidenceUploader emergencyId={emergency._id} evidence={emergency.evidence || []} onChanged={setEmergency} />

        {isActive && emergency.visibility !== 'restricted' && (
          <section className="civic-card p-5">
            <h3 className="font-black text-ink dark:text-slate-100">Community verification</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Confirm what you can see. Verification counts are shared — no private details are exposed.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={verifyBusy} onClick={() => verify(true)} className="civic-secondary">Incident still happening</button>
              <button disabled={verifyBusy} onClick={() => verify(false)} className="civic-secondary">Incident resolved</button>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Still happening: {verification.stillHappening || 0} · Resolved: {verification.resolvedVotes || 0}</p>
            {verifyNotice && <p className="mt-2 rounded bg-emerald-50 dark:bg-emerald-950/40 p-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{verifyNotice}</p>}
          </section>
        )}
      </div>
    </CitizenLayout>
  );
}