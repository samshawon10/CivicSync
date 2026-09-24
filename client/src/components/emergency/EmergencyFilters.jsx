import { label } from '../../services/emergencyService.js';

const categoryOptions = ['medical', 'fire_disaster', 'security_crime', 'women_safety', 'child_safety', 'missing_person', 'road_traffic', 'infrastructure', 'environmental_disaster', 'other', 'not_sure'];

export default function EmergencyFilters({ value, onChange, categories = categoryOptions }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-wrap gap-2">
      <select aria-label="Filter by severity" value={value.severity || ''} onChange={(e) => set({ severity: e.target.value })} className="w-auto">
        <option value="">All severities</option>
        {['critical', 'high', 'medium', 'low'].map((item) => <option key={item} value={item}>{label(item)}</option>)}
      </select>
      <select aria-label="Filter by category" value={value.category || ''} onChange={(e) => set({ category: e.target.value })} className="w-auto">
        <option value="">All categories</option>
        {categories.map((item) => <option key={item} value={item}>{label(item)}</option>)}
      </select>
      <select aria-label="Filter by status" value={value.status || ''} onChange={(e) => set({ status: e.target.value })} className="w-auto">
        <option value="">All statuses</option>
        {['reported', 'received', 'assessing', 'verified', 'dispatched', 'en_route', 'on_scene', 'responding', 'requires_backup', 'escalated', 'resolved', 'closed'].map((item) => <option key={item} value={item}>{label(item)}</option>)}
      </select>
      <select aria-label="Sort order" value={value.sort || 'newest'} onChange={(e) => set({ sort: e.target.value })} className="w-auto">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="severity">By severity</option>
      </select>
      <input aria-label="Search emergencies" placeholder="Search ID, title, address…" value={value.search || ''} onChange={(e) => set({ search: e.target.value })} className="w-auto min-w-40" />
    </div>
  );
}