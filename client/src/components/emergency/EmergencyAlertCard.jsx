import { label } from '../../services/emergencyService.js';

const tone = { low: 'border-slate-200 bg-white', medium: 'border-amber-300 bg-amber-50', high: 'border-orange-300 bg-orange-50', critical: 'border-red-400 bg-red-50' };

export default function EmergencyAlertCard({ alert, onDismiss, dismissLabel = 'Dismiss' }) {
  if (!alert) return null;
  return (
    <article className={`rounded-xl border p-4 ${tone[alert.severity] || tone.medium}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label(alert.severity)} alert{alert.category ? ` · ${label(alert.category)}` : ''}</p>
          <h3 className="mt-0.5 font-black text-ink">{alert.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-700">{alert.message}</p>
          <p className="mt-2 text-xs text-slate-500">
            {new Date(alert.createdAt).toLocaleString()}
            {alert.location?.address ? ` · ${alert.location.address}` : ''}
            {!alert.active ? ' · Closed' : ''}
          </p>
        </div>
        {onDismiss && <button onClick={() => onDismiss(alert)} className="shrink-0 text-xs font-bold text-slate-500 hover:text-slate-700">{dismissLabel}</button>}
      </div>
    </article>
  );
}