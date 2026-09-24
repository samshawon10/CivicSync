import { useCallback, useEffect, useState } from 'react';
import { apiMessage } from '../../services/api.js';
import { distanceKm, emergencyApi, label } from '../../services/emergencyService.js';
import { subscribeToEmergencyEvents } from '../../services/emergencySocket.js';
import { EmptyState, ErrorState } from './EmergencyCard.jsx';

/**
 * Live responder tracking for one incident. Polls positions and refreshes on
 * RESPONDER_LOCATION_UPDATED socket events. Distance is shown relative to the
 * incident location; only authorized viewers can fetch these positions.
 */
export default function ResponderTracker({ emergency, refreshKey = 0 }) {
  const [positions, setPositions] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!emergency?._id) return;
    try {
      const { data } = await emergencyApi.responderPositions(emergency._id);
      setPositions(data.positions || []);
      setError('');
    } catch (err) { setError(apiMessage(err)); }
  }, [emergency?._id]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 6000);
    const unsubscribe = subscribeToEmergencyEvents((event) => {
      if (event?.emergencyId === emergency?._id || event?.publicId === emergency?.emergencyId) load();
    });
    return () => { window.clearInterval(timer); unsubscribe(); };
  }, [load, refreshKey, emergency?._id, emergency?.emergencyId]);

  const incidentLocation = emergency?.location;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-black text-ink">Responder live tracking</h3>
        <span className="text-xs font-bold text-emerald-600">● updating every 6s</span>
      </div>
      <ErrorState message={error} />
      {positions.length ? (
        <ul className="mt-3 space-y-2">
          {positions.map((position) => {
            const distance = incidentLocation ? distanceKm(incidentLocation.latitude, incidentLocation.longitude, position.latitude, position.longitude) : null;
            return (
              <li key={`${position.responder?._id || position._id}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{position.responder?.name || 'Responder'} <span className="text-xs font-semibold text-slate-500">· {label(position.responder?.role)}</span></p>
                  <p className="text-xs text-slate-500">Last update {new Date(position.recordedAt).toLocaleTimeString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-civic-700">{distance != null ? `${distance} km` : '—'}</p>
                  <p className="text-[11px] text-slate-500">from incident</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : !error ? (
        <EmptyState title="No live responder positions yet." hint="Positions appear once a responder starts sharing location for this incident." />
      ) : null}
    </section>
  );
}