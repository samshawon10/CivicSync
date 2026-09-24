/** Shared formatting + semantic tone helpers for the whole product. */

export const labelize = (value = '') => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString();
}

export function formatDateTime(value, options) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, options);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

/** "3 minutes ago" style output used by activity feeds and tables. */
export function formatRelative(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const units = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month']];
  let amount = seconds;
  let unit = 'second';
  for (const [size, name] of units) {
    if (amount < size) break;
    amount /= size;
    unit = name;
  }
  const rounded = Math.round(amount);
  if (unit === 'second' && rounded < 90) return `${rounded} seconds ago`;
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'} ago`;
}

export function formatMinutes(value) {
  if (value == null || value === '') return 'Not recorded';
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return 'Not recorded';
  if (minutes < 60) return `${Math.round(minutes * 10) / 10} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return `${hours}h ${rest}m`;
}

export function formatPercent(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number.toFixed(digits)}%`;
}

const severityTones = { critical: 'critical', high: 'high', medium: 'medium', low: 'neutral' };
const statusTones = {
  reported: 'critical', received: 'high', assessing: 'high', verified: 'info', dispatched: 'info',
  en_route: 'info', on_scene: 'info', responding: 'high', resolved: 'success', closed: 'success',
  cancelled: 'muted', false_report: 'muted', reassigned: 'medium', escalated: 'critical', requires_backup: 'critical',
  pending: 'medium', assigned: 'info', in_progress: 'info', under_review: 'medium', completed: 'success',
  accepted: 'info', active: 'success', suspended: 'critical', inactive: 'muted', available: 'success',
  busy: 'high', offline: 'muted', archived: 'muted', expired: 'muted', database: 'info', catalog: 'neutral'
};

export const severityTone = (severity) => severityTones[severity] || 'neutral';
export const statusTone = (status) => statusTones[status] || 'neutral';

export const availabilityTone = (availability) => ({ available: 'success', busy: 'high', offline: 'muted' }[availability] || 'neutral');

/** Priority ordering used by sortable tables. */
export const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };

export function trendLabel(trend) {
  if (!trend) return '';
  if (trend.basis === 'no_prior_data' || trend.changePercent === null) return 'No prior-period data';
  const sign = trend.changePercent > 0 ? '+' : '';
  return `${sign}${trend.changePercent}% vs previous period`;
}

export function trendTone(trend) {
  if (!trend || trend.changePercent === null) return 'neutral';
  if (trend.changePercent === 0) return 'neutral';
  return trend.changePercent > 0 ? 'up' : 'down';
}

export function compactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return String(number);
}

export const cx = (...values) => values.filter(Boolean).join(' ');
