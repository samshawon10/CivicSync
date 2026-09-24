import { label } from '../../services/emergencyService.js';

const tone = (value = '') => {
  if (['resolved', 'closed'].includes(value)) return 'bg-emerald-100 text-emerald-700';
  if (['reported', 'received', 'assessing'].includes(value)) return 'bg-blue-100 text-blue-700';
  if (['dispatched', 'en_route'].includes(value)) return 'bg-indigo-100 text-indigo-700';
  if (['on_scene', 'responding'].includes(value)) return 'bg-cyan-100 text-cyan-700';
  if (['requires_backup', 'escalated'].includes(value)) return 'bg-red-100 text-red-700';
  if (['cancelled', 'false_report'].includes(value)) return 'bg-slate-200 text-slate-600';
  return 'bg-slate-100 text-slate-700';
};

export default function EmergencyStatusBadge({ value = 'reported', className = '' }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${tone(value)} ${className}`}>{label(value)}</span>;
}