import { useEffect, useState } from 'react';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import NearbyServiceCard from '../../components/emergency/NearbyServiceCard.jsx';
import { ErrorState, LoadingState } from '../../components/emergency/EmergencyCard.jsx';
import { facilitiesApi, label } from '../../services/emergencyService.js';
import { apiMessage } from '../../services/api.js';
import useGeolocation from '../../hooks/useGeolocation.js';

const types = ['', 'hospital', 'police', 'fire_station', 'ambulance', 'shelter', 'safe_point'];

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

  useEffect(() => {
    (async () => {
      const result = await geolocation.capture();
      await load(result.ok ? result.location : null);
    })();
  }, [type]);

  return (
    <CitizenLayout title="Nearby Services">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-ink">Emergency & safety services</h2>
            <p className="text-sm text-slate-500">Hospitals, police, fire stations, ambulances, shelters, and safe points.</p>
          </div>
          <select className="w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Service type">
            {types.map((value) => <option key={value} value={value}>{value ? label(value) : 'All services'}</option>)}
          </select>
        </div>
        {!hasLocation && !geolocation.loading && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-700">
            {geolocation.error || 'Location unavailable — services are listed without distance sorting.'}
            <button onClick={async () => load(await geolocation.capture().then((r) => r.location))} className="ml-2 font-black underline">Try again</button>
          </p>
        )}
        <ErrorState message={error} onRetry={() => load(null)} />
        {loading ? <LoadingState text="Loading nearby services…" /> : facilities.length ? (
          <div className="space-y-2">{facilities.map((facility) => <NearbyServiceCard key={facility._id} facility={facility} />)}</div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No services registered yet. Administrators maintain the facilities directory — nothing is faked here.
          </p>
        )}
      </div>
    </CitizenLayout>
  );
}