import { label } from '../../services/emergencyService.js';

export default function SeverityBadge({ value = 'high', className = '' }) {
  const tone = {
    critical: 'bg-red-100 text-red-700 ring-1 ring-red-200',
    high: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
    medium: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    low: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
  }[value] || 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ${tone} ${className}`}>{label(value)}</span>;
}