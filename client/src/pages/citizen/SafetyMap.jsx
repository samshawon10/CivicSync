import { useEffect, useState } from 'react';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import SafetyHeatmap from '../../components/emergency/SafetyHeatmap.jsx';
import EmergencyMap from '../../components/emergency/EmergencyMap.jsx';
import { ErrorState } from '../../components/emergency/EmergencyCard.jsx';
import { emergencyApi, facilitiesApi } from '../../services/emergencyService.js';
import { apiMessage } from '../../services/api.js';
import useGeolocation from '../../hooks/useGeolocation.js';

const ALERT_PREF_KEY = 'civicsync_safety_alerts_enabled';

export default function SafetyMap() {
  const [hotspots, setHotspots] = useState([]);
  const [meta, setMeta] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(localStorage.getItem(ALERT_PREF_KEY) !== 'off');
  const [geoNotice, setGeoNotice] = useState('');
  const geolocation = useGeolocation();

  async function load() {
    try {
      const [hotspotResult, facilityResult] = await Promise.all([
        emergencyApi.hotspots({ days: 30, minCount: 2 }),
        facilitiesApi.list({ active: true }).catch(() => ({ data: { facilities: [] } }))
      ]);
      setHotspots((hotspotResult.data.areas || []).map((area) => ({ ...area, _id: { latitude: area._id.latitude, longitude: area._id.longitude, category: area._id.category } })));
      setMeta(hotspotResult.data);
      setFacilities(facilityResult.data.facilities || []);
      setError('');
    } catch (err) { setError(apiMessage(err)); }
  }

  useEffect(() => { load(); }, []);

  // Geo-fenced safety information: only when the user is near a density area,
  // only if the user has not disabled non-critical safety information.
  useEffect(() => {
    if (!alertsEnabled || !hotspots.length) { setGeoNotice(''); return; }
    let cancelled = false;
    geolocation.capture().then((result) => {
      if (cancelled || !result.ok) return;
      const near = hotspots.find((area) => {
        const dLat = Math.abs(area._id.latitude - result.location.latitude);
        const dLng = Math.abs(area._id.longitude - result.location.longitude);
        return dLat < 0.03 && dLng < 0.03;
      });
      if (near) setGeoNotice(`This area has a high number of reported incidents (${near.count} in the selected period). Stay aware — this is based on reports, not a guarantee of risk.`);
    });
    return () => { cancelled = true; };
  }, [hotspots, alertsEnabled]);

  function toggleAlerts() {
    const next = !alertsEnabled;
    setAlertsEnabled(next);
    localStorage.setItem(ALERT_PREF_KEY, next ? 'on' : 'off');
    if (!next) setGeoNotice('');
  }

  return (
    <CitizenLayout title="Safety Map">
      <div className="mx-auto max-w-6xl space-y-5">
        <ErrorState message={error} onRetry={load} />

        <section className="civic-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-ink">Reported incident density</h2>
              <p className="text-sm text-slate-500">Aggregated from real citizen reports with neutral labels. Adjust the period below.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4" checked={alertsEnabled} onChange={toggleAlerts} />
              Show safety information near me
            </label>
          </div>
          {geoNotice && (
            <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p><strong>Safety information:</strong> {geoNotice}</p>
              <button onClick={() => setGeoNotice('')} className="font-black">Dismiss</button>
            </div>
          )}
          <div className="mt-4"><SafetyHeatmap /></div>
        </section>

        <section className="civic-card p-5">
          <h2 className="text-lg font-black text-ink">Services & context map</h2>
          <p className="text-sm text-slate-500">Hospitals, police stations, fire stations, shelters, and safe points. Individual emergency markers are never shown to the public — only aggregates.</p>
          <div className="mt-3">
            <EmergencyMap height="h-[26rem]" hotspots={hotspots} facilities={facilities} emergencies={[]} autoFit />
          </div>
          {meta && <p className="mt-2 text-xs text-slate-500">{meta.note} {meta.totalReports} report(s) in the last {meta.dateRangeDays} days.</p>}
        </section>
      </div>
    </CitizenLayout>
  );
}