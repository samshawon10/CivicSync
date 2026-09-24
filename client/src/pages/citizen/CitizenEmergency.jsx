import { Bell, Hospital, MapPinned, PhoneCall, ShieldCheck, Siren } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import SOSButton from '../../components/emergency/SOSButton.jsx';
import EmergencyMap from '../../components/emergency/EmergencyMap.jsx';
import EmergencyCard, { ErrorState } from '../../components/emergency/EmergencyCard.jsx';
import { emergencyApi, label } from '../../services/emergencyService.js';
import { apiMessage } from '../../services/api.js';
import useGeolocation from '../../hooks/useGeolocation.js';
import useEmergencyEvents from '../../hooks/useEmergencyEvents.js';

const quickLinks = [
  ['Report emergency', '/dashboard/citizen/emergency/new', Siren],
  ['Women Safety', '/dashboard/citizen/women-safety', ShieldCheck],
  ['Safety Map', '/dashboard/citizen/safety-map', MapPinned],
  ['Safety Alerts', '/dashboard/citizen/alerts', Bell],
  ['Nearby services', '/dashboard/citizen/nearby-services', Hospital],
  ['Emergency contacts', '/dashboard/citizen/emergency-contacts', PhoneCall]
];

export default function CitizenEmergency() {
  const navigate = useNavigate();
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sosResult, setSosResult] = useState(null);
  const [sosStatus, setSosStatus] = useState('');
  const [addressDraft, setAddressDraft] = useState('');
  const [confirmNotSafe, setConfirmNotSafe] = useState(false);
  const geolocation = useGeolocation();
  const { online, live } = useEmergencyEvents(() => { load(); });
  const notSafeTimer = useRef(null);

  async function load() {
    try {
      const { data } = await emergencyApi.list({ limit: 10 });
      setEmergencies(data.emergencies || []);
      setError('');
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // Refresh the SOS panel status with real server state until a team responds.
  useEffect(() => {
    if (!sosResult) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const { data } = await emergencyApi.get(sosResult._id);
        setSosStatus(data.emergency.status);
        setEmergencies((items) => items.map((item) => item._id === data.emergency._id ? data.emergency : item));
      } catch { /* keep last known state */ }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [sosResult]);

  async function createSos(location) {
    setBusy(true); setError('');
    try {
      const { data } = await emergencyApi.create({
        category: 'not_sure', subcategory: 'other',
        title: 'SOS — immediate assistance requested',
        description: 'Quick SOS activated from the citizen emergency dashboard.',
        sos: true, severity: 'critical',
        location: { address: addressDraft, ...(location || {}) }
      });
      setSosResult({ ...data.emergency, _contactInfo: data.emergencyContacts, _locationCaptured: Boolean(location) });
      setSosStatus(data.emergency.status);
      await load();
    } catch (err) { setError(apiMessage(err)); }
    finally { setBusy(false); }
  }

  async function handleSos(location, meta) {
    if (meta?.offline) { setError('You appear to be offline. Your SOS cannot be sent until the connection is restored.'); return; }
    if (!location) {
      setError('Location was NOT captured. Enter the address below, then press and hold SOS again — we never claim a location we do not have.');
      return;
    }
    await createSos(location);
  }

  async function confirmNotSafeSOS() {
    setConfirmNotSafe(false);
    setBusy(true); setError('');
    const gps = await geolocation.capture();
    try {
      const { data } = await emergencyApi.create({
        category: 'security_crime', subcategory: 'suspicious_activity',
        title: "I'm Not Safe",
        description: 'Discreet safety request raised by the citizen. Minimal details shared — treat with care.',
        notSafe: true, severity: 'critical',
        location: { address: addressDraft, ...(gps.location || {}) }
      });
      setSosResult({ ...data.emergency, _contactInfo: data.emergencyContacts, _locationCaptured: Boolean(gps.location) });
      setSosStatus(data.emergency.status);
      await load();
    } catch (err) { setError(apiMessage(err)); }
    finally { setBusy(false); }
  }

  function holdNotSafe() {
    // Minimal-step discreet flow: one tap opens a single quiet confirmation.
    setConfirmNotSafe(true);
    clearTimeout(notSafeTimer.current);
  }

  async function attachAddress() {
    if (!sosResult || !addressDraft.trim()) return;
    setBusy(true);
    try {
      const { data } = await emergencyApi.update(sosResult._id, { location: { address: addressDraft.trim() } });
      setSosResult((current) => ({ ...current, ...data.emergency }));
      setAddressDraft('');
      setError('');
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }

  const activeStatus = ['reported', 'received', 'assessing', 'verified', 'dispatched'].includes(sosStatus) ? 'DISPATCHING' : sosStatus;

  return (
    <CitizenLayout title="Emergency & Safety">
      <div className="mx-auto max-w-5xl space-y-6">
        {!online && <p className="rounded-lg bg-slate-800 p-3 text-sm font-bold text-white">⚠ You are offline. Emergencies and SOS cannot be sent until the connection returns.</p>}
        {online && !live && <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-700">Live connection reconnecting… updates may lag.</p>}
        <ErrorState message={error} />

        <section className="overflow-hidden rounded-2xl bg-red-700 p-6 text-white shadow-lg">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold tracking-wider text-red-100">🚨 EMERGENCY</p>
              <h2 className="mt-1 text-3xl font-black">{sosResult ? 'SOS ACTIVATED' : 'HOLD TO SEND SOS'}</h2>
              <p className="mt-2 max-w-xl text-sm text-red-100">
                {sosResult
                  ? 'Your emergency exists on the server. Track the live response below.'
                  : 'Hold the button for 3 seconds. We capture your location first and never pretend it was captured.'}
              </p>
              {!sosResult && (
                <label className="mt-3 block text-left text-xs font-bold text-red-100">
                  Address fallback (used if GPS fails)
                  <input value={addressDraft} onChange={(e) => setAddressDraft(e.target.value)} placeholder="Street, landmark…" className="mt-1 w-full rounded-lg border-0 bg-white/95 px-3 py-2 text-sm text-slate-800" />
                </label>
              )}
            </div>
            {!sosResult && (
              <SOSButton busy={busy} onActivate={handleSos} captureLocation={geolocation.capture} />
            )}
          </div>

          {sosResult && (
            <div className="mt-5 rounded-xl bg-white/95 p-4 text-slate-800">
              <p className="text-sm font-black text-red-700">Emergency ID: {sosResult.emergencyId}</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li>{sosResult._locationCaptured ? '✓' : '✗'} Location {sosResult._locationCaptured ? `captured${Number.isFinite(Number(sosResult.location?.accuracy)) ? ` (±${Math.round(Number(sosResult.location.accuracy))} m)` : ''}` : 'NOT captured — enter an address'}</li>
                <li>✓ Emergency Command notified (server confirmed)</li>
                <li>{sosResult._contactInfo?.recorded ? `✓ ${sosResult._contactInfo.recorded} emergency contact(s) recorded for command` : '— No enabled emergency contacts on file'}</li>
                {!sosResult._contactInfo?.recorded && <li className="text-xs text-slate-500">Add contacts so command can reach your next of kin (SMS delivery needs an SMS gateway, which is not configured).</li>}
              </ul>
              {!sosResult._locationCaptured && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <input value={addressDraft} onChange={(e) => setAddressDraft(e.target.value)} placeholder="Enter the location manually" className="min-w-50 flex-1" />
                  <button onClick={attachAddress} disabled={busy || !addressDraft.trim()} className="civic-primary">Save location</button>
                </div>
              )}
              {sosResult.location?.latitude != null && sosResult.location?.longitude != null ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Your emergency location</p>
                  <EmergencyMap height="h-64" emergencies={[sosResult]} userLocation={sosResult.location} showControls={false} autoFit />
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-xs font-black uppercase text-slate-500">Response status:</span>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${activeStatus === 'DISPATCHING' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{label(activeStatus)}</span>
                <button onClick={() => navigate(`/dashboard/citizen/emergency/${sosResult._id}`)} className="text-sm font-bold text-civic-600">Open full tracking →</button>
                <button onClick={() => setSosResult(null)} className="text-sm font-bold text-slate-500">Dismiss</button>
              </div>
            </div>
          )}
          {!sosResult && (
            <div className="mt-5 flex flex-col items-center gap-2 rounded-xl bg-red-800/60 p-4 sm:flex-row sm:justify-between">
              <div className="text-center sm:text-left">
                <p className="font-black">I'm Not Safe</p>
                <p className="text-xs text-red-100">Discreet request for help — minimal details, extra privacy.</p>
              </div>
              <button onClick={holdNotSafe} disabled={busy} className="rounded-lg bg-white px-4 py-2.5 text-sm font-black text-red-700 hover:bg-red-50">I'M NOT SAFE</button>
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickLinks.map(([text, to, Icon]) => (
            <button key={to} onClick={() => navigate(to)} className="civic-card interactive flex flex-col items-center gap-2 p-4 text-center">
              <Icon size={24} className="text-civic-600" aria-hidden="true" />
              <span className="text-xs font-bold text-ink">{text}</span>
            </button>
          ))}
        </section>

        <section className="civic-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-ink">My emergencies</h2>
              <p className="text-sm text-slate-500">Live status of incidents you reported.</p>
            </div>
            <button onClick={() => navigate('/dashboard/citizen/emergency/new')} className="civic-primary">New detailed report</button>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? <p className="py-6 text-center text-sm text-slate-500">Loading emergencies…</p>
              : emergencies.length ? emergencies.map((item) => (
                <EmergencyCard key={item._id} emergency={item} onOpen={(emergency) => navigate(`/dashboard/citizen/emergency/${emergency._id}`)} />
              )) : (
                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No active emergencies. If you need help, hold the SOS button.</p>
              )}
          </div>
        </section>

        {confirmNotSafe && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
              <p className="text-sm font-black text-slate-700">DISCREET HELP</p>
              <h2 className="mt-1 text-lg font-black text-ink">Send "I'm Not Safe"?</h2>
              <p className="mt-2 text-sm text-slate-600">We'll capture your location and quietly alert Emergency Command.</p>
              <div className="mt-4 flex gap-3">
                <button onClick={confirmNotSafeSOS} disabled={busy} className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-black text-white">{busy ? 'Sending…' : 'Send quietly'}</button>
                <button onClick={() => setConfirmNotSafe(false)} className="civic-secondary flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CitizenLayout>
  );
}