import { label } from '../../services/emergencyService.js';

const availabilityTone = {
  available: 'bg-emerald-100 text-emerald-700',
  busy: 'bg-amber-100 text-amber-700',
  offline: 'bg-slate-200 text-slate-600'
};

export default function ResponseTeamCard({ team, onSelect, selected = false, showDistance = true }) {
  return (
    <article className={`rounded-xl border p-3 transition ${selected ? 'border-civic-500 ring-2 ring-civic-200' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{team.type === 'medical' ? '🚑' : team.type === 'fire' ? '🚒' : team.type === 'security' ? '🚓' : team.type === 'traffic' ? '🚗' : '🛡️'} {team.name}</p>
          <p className="text-xs text-slate-500">{label(team.type)} team · {team.members?.length || 0} member(s)</p>
          {team.baseLocation?.address && <p className="truncate text-xs text-slate-400">{team.baseLocation.address}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${availabilityTone[team.availability] || availabilityTone.offline}`}>{label(team.availability)}</span>
          {showDistance && team.distanceKm != null && <span className="text-xs font-bold text-civic-700">{team.distanceKm} km</span>}
          {team.typeMatch && <span className="rounded-full bg-civic-50 px-2 py-0.5 text-[10px] font-black text-civic-700">Type match</span>}
        </div>
      </div>
      {onSelect && <button onClick={() => onSelect(team)} className="mt-2 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-bold text-civic-700 hover:bg-civic-50">{selected ? 'Selected' : 'Use this team'}</button>}
    </article>
  );
}