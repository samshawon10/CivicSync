import { label } from '../../services/emergencyService.js';

/**
 * Response timer with honest missing timestamps: stages without a recorded
 * time render as "—" and are never fabricated.
 */
const stages = [
  ['Reported', (e) => e.createdAt],
  ['Dispatched', (e) => e.dispatchedAt],
  ['Accepted', (e) => e.acknowledgedAt],
  ['En Route', (e) => e.enRouteAt],
  ['Arrived', (e) => e.arrivalAt],
  ['Resolved', (e) => e.resolvedAt],
  ['Closed', (e) => e.closedAt]
];

function minutesBetween(from, to) {
  if (!from || !to) return null;
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}

export default function EmergencyTimeline({ emergency, compact = false }) {
  if (!emergency) return null;
  return (
    <div className="space-y-4">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map(([name, getter]) => {
          const at = getter(emergency);
          const delta = name === 'Reported' ? null : minutesBetween(emergency.createdAt, at);
          return (
            <li key={name} className={`rounded-lg border p-3 ${at ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">{name}</p>
              <p className={`mt-1 text-sm font-bold ${at ? 'text-emerald-700' : 'text-slate-400'}`}>{at ? new Date(at).toLocaleString() : '— pending —'}</p>
              {delta !== null && at && <p className="text-xs text-slate-500">+{delta} min from report</p>}
            </li>
          );
        })}
      </ol>
      {!compact && (
        <section>
          <h4 className="text-sm font-black text-ink">Activity log</h4>
          <ul className="mt-2 space-y-2">
            {(emergency.activity || []).slice().reverse().map((entry, index) => (
              <li key={`${entry.timestamp}-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-bold text-ink">{entry.action}</p>
                <p className="text-xs text-slate-500">{label(entry.actorRole)} · {new Date(entry.timestamp).toLocaleString()}{entry.note ? ` · ${entry.note}` : ''}</p>
              </li>
            ))}
            {!emergency.activity?.length && <li className="text-sm text-slate-500">No activity recorded yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}