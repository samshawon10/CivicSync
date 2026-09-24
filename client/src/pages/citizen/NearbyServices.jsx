import { LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import NearbyServiceCard from '../../components/emergency/NearbyServiceCard.jsx';
import PageHead from '../../components/ui/PageHead.jsx';
import { ErrorState, LoadingState } from '../../components/emergency/EmergencyCard.jsx';
import { facilitiesApi, label } from '../../services/emergencyService.js';
import { apiMessage } from '../../services/api.js';
import useGeolocation from '../../hooks/useGeolocation.js';

const types = ['', 'emergency_center', 'ambulance', 'fire_station', 'police', 'safe_point', 'shelter', 'flood_shelter', 'hazard', 'road_blockage', 'hospital', 'pharmacy', 'clinic', 'first_aid_center', 'mosque', 'school', 'government_office', 'help_center', 'safe_water_point', 'public_toilet'];

export default function NearbyServices() {
  const [facilities, setFacilities] = useState([]);
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasLocation, setHasLocation] = useState(false);
  const geolocation = useGeolocation();

  async function load(location) {
    setLoading(true);
    try {
      const locationParams = location ? { lat: location.latitude, lng: location.longitude } : {};
      const { data } = await facilitiesApi.nearby({ ...locationParams, ...(type ? { type } : {}), limit: 60 });
      setFacilities(data.facilities || []);
      setHasLocation(Boolean(location));
      setError('');
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }

  useEffect(() => { load(geolocation.location); }, [type]);

  return (
    <CitizenLayout title="Nearby Services">
      <PageHead title="Nearby Emergency Help" description="Find registered police, ambulance, hospital, fire, shelter, pharmacy and safe-point services using real geospatial proximity." />
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-ink">Emergency & safety services</h2>
            <p className="text-sm text-slate-500">Real registered locations, sorted by geographic distance only after sharing a position.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="civic-secondary" onClick={async () => { const result = await geolocation.capture(); setHasLocation(Boolean(result.ok)); await load(result.location); }} disabled={geolocation.loading}><LocateFixed size={16} /> {geolocation.loading ? 'Locating…' : hasLocation ? 'Update location' : 'Use my location'}</button>
            <select className="w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Service type">
              {types.map((value) => <option key={value} value={value}>{value ? label(value) : 'All services'}</option>)}
            </select>
          </div>
        </div>
        {!hasLocation && !geolocation.loading && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-700">
            {geolocation.error || 'Location unavailable — services are listed without distance sorting.'}
            <button onClick={async () => { const result = await geolocation.capture(); setHasLocation(Boolean(result.ok)); await load(result.location); }} className="ml-2 font-black underline">Try again</button>
          </p>
        )}
        <ErrorState message={error} onRetry={() => load(null)} />
        {loading ? <LoadingState text="Loading nearby services…" /> : facilities.length ? (
          <div className="grid gap-3 md:grid-cols-2">{facilities.map((facility) => <NearbyServiceCard key={facility._id} facility={facility} origin={geolocation.location} />)}</div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No services registered yet. Administrators maintain the facilities directory — nothing is faked here.
          </p>
        )}
      </div>
    </CitizenLayout>
  );
}