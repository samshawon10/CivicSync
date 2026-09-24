const tones = {
  critical: 'border-red-200 bg-red-50 text-red-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  neutral: 'border-slate-200 bg-white text-ink'
};

export default function EmergencyStats({ stats = [], loading }) {
  if (loading && !stats.length) return <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />)}</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => (
        <article key={stat.label} className={`rounded-xl border p-4 ${tones[stat.tone] || tones.neutral}`}>
          <p className="text-2xl font-black">{stat.loading ? '—' : stat.value}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-80">{stat.label}</p>
        </article>
      ))}
    </div>
  );
}