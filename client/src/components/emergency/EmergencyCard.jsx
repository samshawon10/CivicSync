import { label } from '../../services/emergencyService.js';
import SeverityBadge from './SeverityBadge.jsx';
import EmergencyStatusBadge from './EmergencyStatusBadge.jsx';

export function EmptyState({ title, hint, action }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-bold text-ink">{title}</p>{hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}

export function LoadingState({ text = 'Loading…' }) {
  return <div className="animate-pulse space-y-3 rounded-xl border border-slate-200 bg-white p-5"><div className="h-4 w-1/3 rounded bg-slate-200" /><div className="h-4 w-2/3 rounded bg-slate-100" /><div className="h-4 w-1/2 rounded bg-slate-100" /><p className="sr-only">{text}</p></div>;
}

export function ErrorState({ message, onRetry }) {
  if (!message) return null;
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700"><span>{message}</span>{onRetry && <button onClick={onRetry} className="font-black underline">Retry</button>}</div>;
}

export default function EmergencyCard({ emergency, onOpen, footer }) {
  if (!emergency) return null;
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-civic-300">
      <button onClick={() => onOpen?.(emergency)} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-black text-red-700">{emergency.emergencyId}</p>
          <SeverityBadge value={emergency.severity} />
          <EmergencyStatusBadge value={emergency.status} />
          {emergency.visibility === 'restricted' && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-purple-700">Restricted</span>}
        </div>
        <h3 className="mt-1 truncate font-bold text-ink">{emergency.title}</h3>
        <p className="truncate text-sm text-slate-500">{label(emergency.category)}{emergency.subcategory && emergency.subcategory !== 'other' ? ` · ${label(emergency.subcategory)}` : ''} · {new Date(emergency.createdAt).toLocaleString()}</p>
        <p className="truncate text-xs text-slate-400">{emergency.location?.address || 'Location shared privately'}</p>
      </button>
      {footer || <button onClick={() => onOpen?.(emergency)} className="text-sm font-bold text-civic-600">Open</button>}
    </article>
  );
}