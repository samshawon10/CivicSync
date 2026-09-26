import { useEffect, useState } from 'react';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import EmergencyAlertCard from '../../components/emergency/EmergencyAlertCard.jsx';
import { ErrorState, LoadingState } from '../../components/emergency/EmergencyCard.jsx';
import { emergencyApi } from '../../services/emergencyService.js';
import { apiMessage } from '../../services/api.js';

const PREF_KEY = 'civicsync_safety_alerts_enabled';

export default function SafetyAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('civicsync_dismissed_alerts') || '[]'); } catch { return []; }
  });

  async function load() {
    setLoading(true);
    try {
      const { data } = await emergencyApi.alerts();
      setAlerts(data.alerts || []);
      setError('');
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function dismiss(alert) {
    const next = [...new Set([...dismissed, alert._id])];
    setDismissed(next);
    localStorage.setItem('civicsync_dismissed_alerts', JSON.stringify(next));
  }

  const visible = alerts
    .filter((alert) => !dismissed.includes(alert._id))
    .filter((alert) => !criticalOnly || alert.severity === 'critical');

  return (
    <CitizenLayout title="Safety Alerts">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-ink dark:text-slate-100">Public safety alerts</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Broadcast by Emergency Command: fire, flood, road closures, weather, and more.</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-4 w-4" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} />
            Critical only
          </label>
        </div>
        <ErrorState message={error} onRetry={load} />
        {loading ? <LoadingState text="Loading alerts…" /> : visible.length ? (
          <div className="space-y-3">
            {visible.map((alert) => <EmergencyAlertCard key={alert._id} alert={alert} onDismiss={dismiss} />)}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {alerts.length ? 'All alerts dismissed for this device.' : 'No active safety alerts. You will see broadcasts here when Emergency Command issues one.'}
          </p>
        )}
      </div>
    </CitizenLayout>
  );
}