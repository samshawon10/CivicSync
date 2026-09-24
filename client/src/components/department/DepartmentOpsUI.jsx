import { labelize } from '../../utils/format.js';

export const opsLabel = labelize;

const pillTones = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  muted: 'border-slate-200 bg-white text-slate-500',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  progress: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700'
};

export function Pill({ tone = 'neutral', children, className = '', title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${pillTones[tone] || pillTones.neutral} ${className}`}
    >
      {children}
    </span>
  );
}

const priorityTones = { urgent: 'danger', high: 'warning', medium: 'info', low: 'neutral' };
const reportStatusTones = { pending: 'neutral', verified: 'info', assigned: 'progress', in_progress: 'warning', under_review: 'warning', completed: 'success', closed: 'muted' };
const taskStatusTones = { assigned: 'progress', accepted: 'info', traveling: 'info', arrived: 'info', in_progress: 'warning', paused: 'warning', blocked: 'danger', completed: 'success', rejected: 'danger', cancelled: 'muted' };
const teamStatusTones = { available: 'success', busy: 'warning', on_break: 'info', off_duty: 'muted', offline: 'muted', maintenance: 'danger' };
const resourceStatusTones = { available: 'success', reserved: 'info', assigned: 'progress', in_use: 'warning', maintenance: 'danger', unavailable: 'muted' };
const escalationTones = { pending: 'warning', approved: 'success', rejected: 'danger' };

export const toneForStatus = (value, kind = 'report') => {
  const table = { report: reportStatusTones, task: taskStatusTones, team: teamStatusTones, resource: resourceStatusTones, request: escalationTones }[kind] || reportStatusTones;
  return table[value] || 'neutral';
};

export function StatusPill({ value, kind = 'report', className = '' }) {
  return <Pill tone={toneForStatus(value, kind)} className={className}>{labelize(value)}</Pill>;
}

export function PriorityPill({ value }) {
  return <Pill tone={priorityTones[value] || 'neutral'}>{labelize(value || 'medium')}</Pill>;
}

const slaTones = { safe: 'info', met: 'success', warning: 'warning', breached: 'danger', completed: 'success' };

/** Compact SLA state badge driven by calculateDepartmentSla() output. */
export function SlaPill({ sla, className = '' }) {
  if (!sla) return null;
  const overall = sla.overallStatus || 'safe';
  return (
    <Pill tone={slaTones[overall] || 'neutral'} className={className} title={`Response: ${sla.response?.status} · Arrival: ${sla.arrival?.status} · Resolution: ${sla.resolution?.status}`}>
      SLA {labelize(overall)}
    </Pill>
  );
}

function remainingLabel(minutes) {
  if (minutes == null) return 'not set';
  const overdue = minutes < 0;
  const abs = Math.abs(minutes);
  const text = abs < 60 ? `${abs}m` : abs < 1440 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${Math.floor(abs / 1440)}d ${Math.floor((abs % 1440) / 60)}h`;
  return overdue ? `${text} overdue` : `${text} left`;
}

/** Three-milestone SLA readout used inside the case workspace. */
export function SlaBreakdown({ sla }) {
  if (!sla) return null;
  const rows = [
    ['Response', sla.response],
    ['Arrival', sla.arrival],
    ['Resolution', sla.resolution]
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {rows.map(([label, milestone]) => (
        <div key={label} className={`rounded-lg border p-3 ${pillTones[slaTones[milestone?.status] || 'neutral']}`}>
          <p className="text-[11px] font-black uppercase tracking-wider">{label}</p>
          <p className="mt-1 text-sm font-bold">{labelize(milestone?.status || 'unknown')}</p>
          <p className="mt-0.5 text-xs opacity-80">{remainingLabel(milestone?.remainingMinutes)}</p>
        </div>
      ))}
    </div>
  );
}


export function formatOpsDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-xs ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-base font-black text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyPanel({ title: heading, message, action }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-bold text-ink">{heading}</p>
      {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function OpsError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
      <span>{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="font-black underline">Retry</button>}
    </div>
  );
}

export function OpsNotice({ children, tone = 'info' }) {
  if (!children) return null;
  const tones = {
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800'
  };
  return <p className={`rounded-lg border p-3 text-sm font-semibold ${tones[tone] || tones.info}`}>{children}</p>;
}

export function StatTile({ label, value, hint, icon: Icon, tone = 'info' }) {
  const tones = {
    info: 'bg-blue-50 text-blue-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    neutral: 'bg-slate-100 text-slate-600'
  };
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</p>
        {Icon && <span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone] || tones.info}`}><Icon size={15} aria-hidden="true" /></span>}
      </div>
      <p className="mt-2 text-2xl font-black text-ink">{value ?? 0}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </article>
  );
}

export function WorkloadBar({ value = 0, label }) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const tone = percent >= 100 ? 'bg-red-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
        <span>{label || 'Workload'}</span>
        <span className="text-slate-700">{percent}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** "What must happen next" banner sourced from the report.nextAction payload. */
export function NextActionCard({ nextAction, className = '' }) {
  if (!nextAction) return null;
  return (
    <div className={`rounded-lg border border-civic-200 bg-civic-50 p-3 ${className}`}>
      <p className="text-[11px] font-black uppercase tracking-wider text-civic-700">Next required action</p>
      <p className="mt-1 text-sm font-bold text-ink">{nextAction.action}</p>
      {nextAction.reason && <p className="mt-0.5 text-xs text-slate-600">{nextAction.reason}</p>}
      <p className="mt-1 text-xs font-semibold text-civic-700">
        Owner: {labelize(nextAction.responsibleRole || 'unassigned')}
        {nextAction.deadline ? ` · Due ${formatOpsDate(nextAction.deadline)}` : ''}
      </p>
    </div>
  );
}

export function TextField({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-civic-500 focus:outline-hidden focus:ring-2 focus:ring-civic-100';

export const primaryButton = 'rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButton = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-civic-300 hover:text-civic-700 disabled:cursor-not-allowed disabled:opacity-50';
