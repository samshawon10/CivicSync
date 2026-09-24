import { useEffect, useState } from 'react';
import { emergencyApi, label } from '../../services/emergencyService.js';
import { apiMessage } from '../../services/api.js';
import EmergencyMap from './EmergencyMap.jsx';
import { EmptyState, ErrorState, LoadingState } from './EmergencyCard.jsx';

const ranges = [[1, '24 Hours'], [7, '7 Days'], [30, '30 Days'], [90, '3 Months'], [180, '6 Months'], [365, '1 Year']];
const categoryFilters = ['', 'road_traffic', 'security_crime', 'women_safety', 'medical', 'fire_disaster', 'missing_person', 'infrastructure'];

/**
 * Safety heatmap backed by real aggregate data. Shows a proper empty state
 * when the selected period has insufficient reports — never fake density.
 */
export default function SafetyHeatmap({ height = 'h-[28rem]' }) {
  const [days, setDays] = useState(30);
  const [category, setCategory] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: result } = await emergencyApi.hotspots({ days, category, minCount: 1 });
      setData(result);
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [days, category]);

  const hotspots = (data?.areas || []).map((area) => ({ ...area, _id: { latitude: area._id.latitude, longitude: area._id.longitude, category: area._id.category } }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Date range" className="w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {ranges.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
        <select aria-label="Incident category" className="w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All incident types</option>
          {categoryFilters.filter(Boolean).map((key) => <option key={key} value={key}>{label(key)}</option>)}
        </select>
        {data && <span className="text-xs font-semibold text-slate-500">{data.totalReports ?? 0} report(s) in the last {data.dateRangeDays} day(s)</span>}
      </div>
      <ErrorState message={error} onRetry={load} />
      {loading ? <LoadingState text="Loading safety density data…" />
        : data?.insufficientData ? (
          <EmptyState title="No safety data available for the selected period." hint="Try a longer date range or a different incident type. Density is only shown when real reports exist." />
        ) : (
          <>
            <EmergencyMap height={height} hotspots={hotspots} emergencies={[]} facilities={[]} responders={[]} showControls={false} />
            <p className="text-xs text-slate-500">{data?.label || 'Reported Incident Area'} — {data?.note}</p>
          </>
        )}
    </div>
  );
}