import { label } from '../../services/emergencyService.js';

const icons = { hospital: '🏥', police: '🚓', fire_station: '🚒', ambulance: '🚑', shelter: '🏠', safe_point: '🛡️' };

export default function NearbyServiceCard({ facility }) {
  if (!facility) return null;
  return (
    <article className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="min-w-0">
        <p className="font-bold text-ink"><span className="mr-1">{icons[facility.type] || '📍'}</span>{facility.name}</p>
        <p className="text-xs capitalize text-slate-500">{label(facility.type)}{facility.distanceKm != null ? ` · ${facility.distanceKm} km away` : ''}</p>
        {facility.address && <p className="truncate text-xs text-slate-400">{facility.address}</p>}
        {!facility.available && <p className="text-xs font-bold text-amber-600">Currently marked unavailable</p>}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 text-xs font-bold">
        {facility.phone && <a href={`tel:${facility.phone}`} className="rounded-lg bg-civic-50 px-3 py-1.5 text-center text-civic-700 hover:bg-civic-100">Call</a>}
        <a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/directions?to=${facility.latitude}%2C${facility.longitude}`} className="rounded-lg bg-slate-100 px-3 py-1.5 text-center text-slate-700 hover:bg-slate-200">Navigate</a>
      </div>
    </article>
  );
}