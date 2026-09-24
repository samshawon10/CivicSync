import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmergencyLayout from '../../components/emergency/EmergencyLayout.jsx';
import EmergencyMap from '../../components/emergency/EmergencyMap.jsx';
import { ErrorState, LoadingState } from '../../components/emergency/EmergencyCard.jsx';
import { emergencyApi, label } from '../../services/emergencyService.js';
import { apiMessage } from '../../services/api.js';

const compact = (value) => value == null ? '—' : `${Math.round(value * 10) / 10} min`;
function Stat({ label: name, value, tone = 'neutral' }) {
  const tones = { neutral: 'border-slate-200 bg-white text-ink', critical: 'border-red-200 bg-red-50 text-red-700', success: 'border-emerald-200 bg-emerald-50 text-emerald-700', info: 'border-blue-200 bg-blue-50 text-blue-700' };
  return <article className={`rounded-xl border p-4 ${tones[tone] || tones.neutral}`}><p className="text-2xl font-black">{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-80">{name}</p></article>;
}
function Bars({ rows = [], valueKey = 'count', empty = 'No data available.' }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey]) || 0));
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return <div className="space-y-2">{rows.map((row) => <div key={String(row._id ?? row.hour ?? row.label)} className="grid grid-cols-[minmax(7rem,1fr)_2fr_auto] items-center gap-2 text-xs"><span className="truncate font-semibold text-slate-600">{row.label || label(row._id ?? row.hour)}</span><span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-civic-600" style={{ width: `${((Number(row[valueKey]) || 0) / max) * 100}%` }} /></span><span className="font-black text-ink">{row[valueKey]}</span></div>)}</div>;
}

export default function EmergencyAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [mapItems, setMapItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true);
    try { const [analyticsResult, mapResult] = await Promise.all([emergencyApi.analytics(), emergencyApi.map()]); setAnalytics(analyticsResult.data.analytics || {}); setMapItems(mapResult.data.emergencies || []); setError(''); }
    catch (err) { setError(apiMessage(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  if (loading) return <EmergencyLayout title="Emergency analytics"><LoadingState text="Loading real emergency analytics…" /></EmergencyLayout>;
  if (error) return <EmergencyLayout title="Emergency analytics"><ErrorState message={error} onRetry={load} /></EmergencyLayout>;
  if (!analytics) return <EmergencyLayout title="Emergency analytics"><ErrorState message="Analytics are unavailable." onRetry={load} /></EmergencyLayout>;
  return <EmergencyLayout title="Emergency analytics"><div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black text-ink">Emergency Command analytics</h2><p className="text-sm text-slate-500">Real database aggregates. Missing milestones remain unreported rather than estimated.</p></div><Link to="/dashboard/emergency-head" className="civic-secondary">Back to command center</Link></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Total emergencies" value={analytics.total ?? 0} /><Stat label="Active" value={analytics.active ?? 0} tone="critical" /><Stat label="Resolved" value={analytics.resolved ?? 0} tone="success" /><Stat label="Closed" value={analytics.closed ?? 0} tone="info" /></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Stat label="Avg dispatch" value={compact(analytics.averageDispatchMinutes)} /><Stat label="Avg acknowledgement" value={compact(analytics.averageAcknowledgeMinutes)} /><Stat label="Avg arrival" value={compact(analytics.averageArrivalMinutes)} /><Stat label="Avg response" value={compact(analytics.averageResponseMinutes)} /><Stat label="Avg resolution" value={compact(analytics.averageResolutionMinutes)} /></div>
    <div className="grid gap-5 lg:grid-cols-2"><section className="civic-card p-5"><h3 className="text-lg font-black text-ink">Category distribution</h3><div className="mt-4"><Bars rows={analytics.byCategory} /></div></section><section className="civic-card p-5"><h3 className="text-lg font-black text-ink">Severity distribution</h3><div className="mt-4"><Bars rows={analytics.bySeverity} /></div></section><section className="civic-card p-5"><h3 className="text-lg font-black text-ink">Hourly emergency trend</h3><div className="mt-4"><Bars rows={(analytics.hourly || []).map((row) => ({ ...row, label: `${String(row.hour).padStart(2, '0')}:00` }))} empty="No hourly reports available." /></div></section><section className="civic-card p-5"><h3 className="text-lg font-black text-ink">Daily trend</h3><div className="mt-4 max-h-72 overflow-y-auto"><Bars rows={(analytics.trend || []).slice().reverse()} empty="No daily reports available." /></div></section></div>
    <section className="civic-card p-5"><h3 className="text-lg font-black text-ink">Status breakdown</h3><p className="text-sm text-slate-500">Operational status counts from the emergency collection.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{(analytics.byStatus || []).map((row) => <div key={row._id} className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-bold text-slate-500">{label(row._id)}</p><p className="mt-1 text-xl font-black text-ink">{row.count}</p></div>)}</div></section>
    <section className="civic-card p-5"><h3 className="text-lg font-black text-ink">Geographic distribution</h3><p className="text-sm text-slate-500">Active incident locations from the live emergency map. Use this for operational awareness; do not infer risk for individuals.</p><div className="mt-3"><EmergencyMap height="h-96" emergencies={mapItems} showControls={true} autoFit /></div></section>
  </div></EmergencyLayout>;
}
