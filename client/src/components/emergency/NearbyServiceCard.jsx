import { Navigation, Phone } from 'lucide-react';
import { directionsUrl, label } from '../../services/emergencyService.js';
import { FacilityIcon } from './mapVisuals.jsx';

export default function NearbyServiceCard({ facility, origin }) {
  if (!facility) return null;
  const directions = directionsUrl(facility, origin);
  return (
    <article className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-civic-50 text-civic-700"><FacilityIcon type={facility.type} size={19} /></span>
        <div className="min-w-0">
          <p className="font-bold text-ink dark:text-slate-100">{facility.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label(facility.type)}{facility.distanceKm != null ? ` · ${facility.distanceKm} km away` : ''}</p>
          {facility.address ? <p className="truncate text-xs text-slate-400 dark:text-slate-500">{facility.address}</p> : null}
          {facility.active === false ? <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Inactive listing</p> : facility.available === false ? <p className="text-xs font-bold text-amber-600 dark:text-amber-300">Currently marked unavailable</p> : <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Available</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 text-xs font-bold">
        {facility.phone ? <a href={`tel:${facility.phone}`} className="inline-flex items-center justify-center gap-1 rounded-lg bg-civic-50 px-3 py-1.5 text-center text-civic-700 hover:bg-civic-100"><Phone size={13} /> Call</a> : null}
        {directions ? <a target="_blank" rel="noreferrer" href={directions} className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-center text-slate-700 hover:bg-slate-200 dark:bg-surface-2 dark:text-slate-200 dark:hover:bg-slate-800"><Navigation size={13} /> Directions</a> : null}
      </div>
    </article>
  );
}
