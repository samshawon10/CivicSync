import { LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import EmergencyTypeSelector from '../../components/emergency/EmergencyTypeSelector.jsx';
import EmergencyMap from '../../components/emergency/EmergencyMap.jsx';
import { ErrorState } from '../../components/emergency/EmergencyCard.jsx';
import { emergencyApi, label } from '../../services/emergencyService.js';
import { apiMessage } from '../../services/api.js';
import { showSuccess } from '../../utils/sweetAlert.js';
import useGeolocation from '../../hooks/useGeolocation.js';

const blank = { category: 'not_sure', subcategory: 'other', title: '', description: '', severity: 'high', address: '', landmark: '' };
const blankPerson = { name: '', age: '', photoUrl: '', description: '', clothing: '', additionalInfo: '', lastSeenAt: '', lastKnownAddress: '' };
const personCategories = ['missing_person', 'child_safety'];

export default function CreateEmergency() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(blank);
  const [person, setPerson] = useState(blankPerson);
  const [coords, setCoords] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const geolocation = useGeolocation();

  // Deep-link prefill (?category=women_safety&subcategory=stalking)
  useEffect(() => {
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    if (category) setForm((current) => ({ ...current, category, subcategory: subcategory || current.subcategory }));
  }, [searchParams]);

  useEffect(() => { emergencyApi.types().then(({ data }) => setTypes(data.categories || [])).catch(() => setTypes([])); }, []);

  // Advisory classification for "I'm not sure" — debounced, advisory only.
  useEffect(() => {
    if (form.category !== 'not_sure') { setSuggestion(null); return undefined; }
    const text = `${form.title} ${form.description}`.trim();
    if (text.length < 10) { setSuggestion(null); return undefined; }
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await emergencyApi.classify({ title: form.title, description: form.description });
        setSuggestion(data.suggestion);
      } catch { setSuggestion(null); }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [form.title, form.description, form.category]);

  async function captureGps() {
    const result = await geolocation.capture();
    if (result.ok) setCoords(result.location);
    return result;
  }

  async function submit(event) {
    event.preventDefault();
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setError('You are offline. The report cannot be submitted until the connection returns.'); return; }
    if (!form.title.trim()) { setError('Provide a short title.'); return; }
    if (!coords && !form.address.trim()) { setError('Provide your location: capture GPS or enter an address.'); return; }
    setBusy(true); setError('');
    try {
      const payload = {
        ...form,
        location: { address: form.address, landmark: form.landmark, ...(coords || {}) },
        ...(personCategories.includes(form.category) ? { personDetails: person } : {})
      };
      const { data } = await emergencyApi.create(payload);
      showSuccess('Emergency submitted', `Emergency ${data.emergency.emergencyId || ''} was received by Emergency Command.`);
      navigate(`/dashboard/citizen/emergency/${data.emergency._id}`, { state: { created: true } });
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }

  const showPerson = personCategories.includes(form.category);
  const gpsError = geolocation.error;

  return (
    <CitizenLayout title="Report an emergency">
      <div className="mx-auto max-w-4xl space-y-5">
        <ErrorState message={error} />
        <form onSubmit={submit} className="civic-card space-y-5 p-5">
          <div>
            <h2 className="text-xl font-black text-ink dark:text-slate-100">What is happening?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Not sure of the type? Describe it — we'll suggest a classification, and Emergency Command makes the final call.</p>
          </div>

          <EmergencyTypeSelector categories={types} value={form} onChange={setForm} suggestion={suggestion} onAcceptSuggestion={() => suggestion && setForm((current) => ({ ...current, category: suggestion.category, subcategory: suggestion.subcategory || 'other', severity: suggestion.severity || current.severity }))} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold">Short title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} placeholder="What is happening?" required /></label>
            <label className="text-sm font-bold">Severity
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {['low', 'medium', 'high', 'critical'].map((item) => <option key={item} value={item}>{label(item)}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm font-bold">Description<textarea rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} placeholder="Describe the emergency, people involved, and immediate hazards." /></label>

          <fieldset className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <legend className="text-sm font-black text-ink dark:text-slate-100">Location</legend>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={captureGps} className="civic-secondary inline-flex items-center justify-center gap-2"><LocateFixed size={16} /> {geolocation.loading ? 'Locating…' : 'Capture my location'}</button>
        {coords && <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">✓ GPS captured ({coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}){Number.isFinite(Number(coords.accuracy)) ? ` · ±${Math.round(Number(coords.accuracy))} m` : ''}</span>}
              {gpsError && <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{gpsError}</span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">Address or landmark<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, area…" /></label>
              <label className="text-sm font-bold">Landmark note<input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} maxLength={150} placeholder="Nearby landmark" /></label>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
              <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">Or tap the map to pin the exact spot (optional)</p>
              <EmergencyMap height="h-64" userLocation={coords} showControls={false} autoFit={Boolean(coords)} onMapClick={(point) => setCoords(point)} />
            </div>
          </fieldset>

          {showPerson && (
            <fieldset className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <legend className="text-sm font-black text-ink dark:text-slate-100">Person details (restricted visibility)</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-bold">Name<input value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} maxLength={120} /></label>
                <label className="text-sm font-bold">Age<input value={person.age} onChange={(e) => setPerson({ ...person, age: e.target.value })} maxLength={10} /></label>
                <label className="text-sm font-bold">Photo URL<input value={person.photoUrl} onChange={(e) => setPerson({ ...person, photoUrl: e.target.value })} maxLength={500} placeholder="Optional link" /></label>
                <label className="text-sm font-bold sm:col-span-2">Clothing / appearance<input value={person.clothing} onChange={(e) => setPerson({ ...person, clothing: e.target.value })} maxLength={300} /></label>
                <label className="text-sm font-bold">Last seen<input type="datetime-local" value={person.lastSeenAt} onChange={(e) => setPerson({ ...person, lastSeenAt: e.target.value })} /></label>
                <label className="text-sm font-bold sm:col-span-3">Last known location<input value={person.lastKnownAddress} onChange={(e) => setPerson({ ...person, lastKnownAddress: e.target.value })} maxLength={300} /></label>
                <label className="text-sm font-bold sm:col-span-3">Description<textarea rows="2" value={person.description} onChange={(e) => setPerson({ ...person, description: e.target.value })} maxLength={1000} /></label>
                <label className="text-sm font-bold sm:col-span-3">Additional information<textarea rows="2" value={person.additionalInfo} onChange={(e) => setPerson({ ...person, additionalInfo: e.target.value })} maxLength={1000} /></label>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Person details are restricted: only Emergency Command and assigned responders can see them.</p>
            </fieldset>
          )}

          <div className="flex flex-wrap gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <button disabled={busy} className="civic-primary">{busy ? 'Submitting…' : 'Submit emergency report'}</button>
            <button type="button" onClick={() => navigate('/dashboard/citizen/emergency')} className="civic-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </CitizenLayout>
  );
}