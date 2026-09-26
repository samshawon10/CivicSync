import { labelize, formatNumber } from '../../utils/format.js';

/**
 * Dependency-free, theme-aware SVG charts. Every chart exposes the same data
 * as text (accessibility + honesty): the visual is never the only source of
 * information, and no value is invented.
 */
const toneColor = {
  info: 'var(--color-civic-600)', civic: 'var(--color-civic-600)', success: '#10b981', critical: '#ef4444',
  high: '#f97316', medium: '#eab308', neutral: 'var(--line-strong)'
};

function ChartTable({ data, valueLabel = 'Value' }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-semibold text-fg-subtle">View data as table</summary>
      <table className="mt-2 w-full text-left text-[13px]">
        <thead><tr><th className="py-1 font-semibold text-fg-subtle">Item</th><th className="py-1 text-right font-semibold text-fg-subtle">{valueLabel}</th></tr></thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.key}><td className="py-0.5 text-fg-muted">{row.label}</td><td className="tabular py-0.5 text-right font-medium text-fg">{formatNumber(row.count)}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function HBarChart({ data = [], toneBy, valueLabel = 'Count', emptyText = 'No data recorded for this period.' }) {
  if (!data.length) return <p className="py-4 text-[13px] text-fg-muted">{emptyText}</p>;
  const max = Math.max(1, ...data.map((row) => Number(row.count) || 0));
  return (
    <div>
      <div className="space-y-2.5" role="img" aria-label={`${valueLabel} by item: ${data.map((row) => `${row.label} ${row.count}`).join(', ')}`}>
        {data.map((row) => {
          const value = Number(row.count) || 0;
          const color = toneColor[toneBy ? toneBy(row) : row.tone] || toneColor.info;
          return (
            <div key={row.key} className="grid grid-cols-[minmax(7rem,1.1fr)_2fr_auto] items-center gap-2.5 text-[13px]" title={`${row.label}: ${formatNumber(value)}`}>
              <span className="truncate font-medium text-fg-muted">{row.label}</span>
              <span className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--surface-2)' }}>
                <span className="block h-full rounded-full transition-all" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
              </span>
              <span className="tabular font-semibold text-fg">{formatNumber(value)}</span>
            </div>
          );
        })}
      </div>
      <ChartTable data={data} valueLabel={valueLabel} />
    </div>
  );
}

export function ColumnChart({ data = [], height = 200, valueLabel = 'Count', tone = 'info', emptyText = 'No records in this period.' }) {
  if (!data.length) return <p className="py-4 text-[13px] text-fg-muted">{emptyText}</p>;
  const max = Math.max(1, ...data.map((row) => Number(row.count) || 0));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label={`${valueLabel} per period`}>
        {data.map((row) => {
          const value = Number(row.count) || 0;
          return (
            <div key={row.key} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${row.label}: ${formatNumber(value)}`}>
              <span className="tabular text-[10px] font-semibold text-fg-subtle opacity-0 transition group-hover:opacity-100">{formatNumber(value)}</span>
              <span
                className="w-full rounded-t-md transition-all"
                style={{ height: `${Math.max(2, (value / max) * 100)}%`, backgroundColor: toneColor[tone] || toneColor.info }}
              />
              <span className="w-full truncate text-center text-[10px] text-fg-subtle">{row.label}</span>
            </div>
          );
        })}
      </div>
      <ChartTable data={data} valueLabel={valueLabel} />
    </div>
  );
}

export function LineChart({ data = [], height = 180, valueLabel = 'Count', tone = 'info', emptyText = 'Not enough data to plot a trend.' }) {
  if (data.length < 2) return <p className="py-4 text-[13px] text-fg-muted">{emptyText}</p>;
  const values = data.map((row) => Number(row.count) || 0);
  const max = Math.max(1, ...values);
  const step = 100 / (data.length - 1);
  const points = values.map((value, index) => `${index * step},${100 - (value / max) * 92}`).join(' ');
  const areaPoints = `0,100 ${points} 100,100`;
  const color = toneColor[tone] || toneColor.info;
  return (
    <div>
      <div className="overflow-hidden rounded-xl border px-2 pt-2" style={{ height, borderColor: 'var(--line)', background: 'linear-gradient(180deg, color-mix(in oklab, var(--surface-2) 72%, transparent), transparent)' }} role="img" aria-label={`${valueLabel} trend across ${data.length} periods`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <line x1="0" y1="25" x2="100" y2="25" stroke="var(--line)" strokeWidth=".5" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="var(--line)" strokeWidth=".5" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="var(--line)" strokeWidth=".5" vectorEffect="non-scaling-stroke" />
          <polygon points={areaPoints} fill={`color-mix(in oklab, ${color} 16%, transparent)`} />
          <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          {values.map((value, index) => (
            <circle key={index} cx={index * step} cy={100 - (value / max) * 92} r="1.6" fill="var(--surface)" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke">
              <title>{`${data[index].label}: ${formatNumber(value)}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-fg-subtle">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      <ChartTable data={data} valueLabel={valueLabel} />
    </div>
  );
}

export function DonutChart({ data = [], size = 168, thickness = 22, centerLabel = 'total', emptyText = 'No distribution data.' }) {
  const total = data.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  if (!total) return <p className="py-4 text-[13px] text-fg-muted">{emptyText}</p>;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`Distribution: ${data.map((row) => `${row.label} ${row.count}`).join(', ')}`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {data.map((row) => {
            const value = Number(row.count) || 0;
            const length = (value / total) * circumference;
            const circle = (
              <circle
                key={row.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={toneColor[row.tone] || toneColor.info}
                strokeWidth={thickness}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
              >
                <title>{`${row.label}: ${formatNumber(value)}`}</title>
              </circle>
            );
            offset += length;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <p className="tabular text-xl font-bold text-fg">{formatNumber(total)}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{centerLabel}</p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: toneColor[row.tone] || toneColor.info }} aria-hidden="true" />
              <span className="truncate text-fg-muted">{row.label}</span>
            </span>
            <span className="tabular shrink-0 font-semibold text-fg">{formatNumber(row.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Convert MongoDB `[{ _id, count }]` aggregates into chart rows. */
export const toChartRows = (rows = [], mapKey = (key) => labelize(key)) => rows
  .filter((row) => row && (row._id !== undefined || row.key !== undefined))
  .map((row) => {
    const key = row._id ?? row.key;
    return { key: String(key ?? 'unknown'), label: row.label || mapKey(key), count: Number(row.count) || 0 };
  });

