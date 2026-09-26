import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import EmergencyCard, { ErrorState, LoadingState } from '../../components/emergency/EmergencyCard.jsx';
import EmergencyMap from '../../components/emergency/EmergencyMap.jsx';
import NearbyServiceCard from '../../components/emergency/NearbyServiceCard.jsx';
import SOSButton from '../../components/emergency/SOSButton.jsx';
import { emergencyApi, facilitiesApi } from '../../services/emergencyService.js';
import { apiMessage } from '../../services/api.js';
import useGeolocation from '../../hooks/useGeolocation.js';
import useEmergencyEvents from '../../hooks/useEmergencyEvents.js';

const categories = [
  ['harassment', 'Harassment'], ['sexual_harassment', 'Sexual harassment'], ['stalking', 'Stalking'],
  ['following', 'Following'], ['threatening_behavior', 'Threatening behavior'], ['unsafe_public_area', 'Unsafe public area'],
  ['domestic_violence_emergency', 'Domestic violence emergency'], ['attempted_assault', 'Attempted assault'],
  ['suspicious_person', 'Suspicious person'], ['unsafe_transport', 'Unsafe transport situation']
];
const blank = { category: 'harassment', title: '', description: '', address: '' };

export default function WomenSafety() {
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [coords, setCoords] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const geolocation = useGeolocation();
  const { online, live } = useEmergencyEvents(load);

  async function load() {
    try {
      const [incidentResult, facilityResult] = await Promise.all([
        emergencyApi.list({ category: 'women_safety', limit: 20 }),
        facilitiesApi.list({ active: true }).catch(() => ({ data: { facilities: [] } }))
      ]);
      setIncidents(incidentResult.data.emergencies || []);
      setFacilities(facilityResult.data.facilities || []);
      setError('');
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function captureLocation() {
    const result = await geolocation.capture();
    if (result.ok) setCoords(result.location);
    return result;
  }
  async function submit(event) {
    event.preventDefault();
    if (!online) { setError('You are offline. This report cannot be submitted until the connection returns.'); return; }
    if (!form.title.trim()) { setError('Add a short description of what is happening.'); return; }
    if (!coords && !form.address.trim()) { setError('Capture your location or enter a safe address/landmark.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      const { data } = await emergencyApi.create({ category: 'women_safety', subcategory: form.category, title: form.title, description: form.description, severity: 'high', location: { address: form.address, ...(coords || {}) } });
      setSuccess(`Your restricted safety report was created: ${data.emergency.emergencyId}. Emergency Command has been notified.`);
      setForm(blank); setCoords(null); await load();
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }
  async function createDiscreetEmergency(location, meta) {
    if (meta?.offline) { setError('You are offline. The discreet emergency has not been sent.'); return; }
    if (!location) { setError('Location was not captured. Capture GPS or enter a safe address before sending.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      const { data } = await emergencyApi.create({ category: 'women_safety', subcategory: 'threatening_behavior', title: "I'm Not Safe — discreet help requested", description: 'Citizen activated the discreet safety action. Treat as a restricted emergency.', severity: 'critical', notSafe: true, sos: true, location });
      setSuccess(`Discreet emergency created: ${data.emergency.emergencyId}. Security response is being coordinated.`);
      await load();
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }

  return <CitizenLayout title="Women Safety"><div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black text-ink dark:text-slate-100">Private safety support</h2><p className="text-sm text-slate-500 dark:text-slate-400">Your reports, identity, and exact location are restricted to you, Emergency Command, and assigned responders.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${online ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{online ? (live ? 'Live updates connected' : 'Online') : 'Offline'}</span></div>
    {!online && <div className="rounded-lg bg-slate-800 p-3 text-sm font-bold text-white">⚠ You are offline. No emergency will be marked as sent until the server confirms receipt.</div>}
    <ErrorState message={error} onRetry={load} />
    {success && <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-sm font-semibold text-emerald-800 dark:text-emerald-300">{success}</div>}
    <section className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-violet-50 p-5 shadow-sm dark:border-purple-900/70 dark:bg-none dark:bg-purple-950/30"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.15em] text-purple-700 dark:text-purple-300">Discreet emergency</p><h3 className="mt-1 text-xl font-black text-ink dark:text-slate-100">I'm Not Safe</h3><p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-300">Use this when you are being harassed, stalked, followed, threatened, or need a discreet security response. Hold the button for three seconds.</p></div><SOSButton onActivate={createDiscreetEmergency} captureLocation={captureLocation} label={'I\'M NOT SAFE\nHOLD'} title="HOLD FOR DISCREET HELP" busy={busy} /></div><p className="mt-3 text-xs text-purple-800 dark:text-purple-200">If GPS is unavailable, use the detailed safety report below and enter the nearest safe address or landmark. CivicSync will not pretend a location was captured.</p></section>
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><section className="civic-card p-5"><h3 className="text-lg font-black text-ink dark:text-slate-100">Report a safety concern</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">For harassment, stalking, suspicious behavior, unsafe areas, or unsafe transport. Emergency Command decides the final response.</p><form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block text-sm font-bold">What is happening?<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
      <label className="block text-sm font-bold">Short title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={140} placeholder="For example: Someone is following me" required /></label>
      <label className="block text-sm font-bold">Details<textarea rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={2000} placeholder="Share only what responders need to help you." /></label>
      <fieldset className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3"><legend className="px-1 text-sm font-black text-ink dark:text-slate-100">Location</legend><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={captureLocation} className="civic-secondary">{geolocation.loading ? 'Locating…' : '📍 Capture my location'}</button>{coords && <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">✓ Location captured</span>}{geolocation.error && <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{geolocation.error}</span>}</div><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} maxLength={300} placeholder="Safe address or nearest landmark" aria-label="Safe address or landmark" /><EmergencyMap height="h-56" showControls={false} autoFit={Boolean(coords)} onMapClick={setCoords} emergencies={coords ? [{ _id: 'women-safety-pin', emergencyId: 'Location', title: 'Selected location', category: 'women_safety', severity: 'high', status: 'reported', createdAt: new Date().toISOString(), location: coords }] : []} /><p className="text-xs text-slate-500 dark:text-slate-400">Tap the map to choose a location manually. Sensitive locations are never placed on the public safety map.</p></fieldset>
      <button disabled={busy} className="civic-primary">{busy ? 'Sending…' : 'Send restricted safety report'}</button>
    </form></section>
    <section className="civic-card p-5"><h3 className="text-lg font-black text-ink dark:text-slate-100">My safety incidents</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Only your own restricted reports are shown here.</p><div className="mt-4 space-y-3">{loading ? <LoadingState text="Loading your safety reports…" /> : incidents.length ? incidents.map((incident) => <EmergencyCard key={incident._id} emergency={incident} onOpen={(item) => navigate(`/dashboard/citizen/emergency/${item._id}`)} />) : <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-sm text-slate-500 dark:text-slate-400">No women-safety reports yet.</p>}</div></section>
    </div>

    <section className="civic-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black text-ink dark:text-slate-100">Safety map and services</h3><p className="text-sm text-slate-500 dark:text-slate-400">Public map shows services and aggregate areas only — never your identity or exact report location.</p></div><button onClick={() => navigate('/dashboard/citizen/nearby-services')} className="civic-secondary">Open nearby services</button></div><div className="mt-3"><EmergencyMap height="h-64" emergencies={[]} facilities={facilities} responders={[]} showControls={false} /></div></section>
    <section className="civic-card p-5"><h3 className="text-lg font-black text-ink dark:text-slate-100">Nearby support</h3><p className="text-sm text-slate-500 dark:text-slate-400">Hospitals, police stations, safe points, and other registered services.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{facilities.slice(0, 6).map((facility) => <NearbyServiceCard key={facility._id} facility={facility} />)}</div></section>
  </div></CitizenLayout>;
}

