import { useCallback, useEffect, useRef, useState } from 'react';
import { reportsApi } from '../../services/reportService.js';
import { subscribeToDepartmentCatalogue, subscribeToReportCategories } from '../../services/emergencySocket.js';

const maxFiles = 5;
const maxFileSize = 25 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']);

const FALLBACK_DEPARTMENTS = [
  'Roads & Infrastructure', 'Waste Management', 'Water & Sewerage', 'Electricity',
  'Traffic Management', 'Public Health', 'Environment', 'Parks & Recreation',
  'Public Safety', 'Urban Planning', 'Other'
];

const CATEGORIES = [
  ['road_infrastructure', 'Road & Infrastructure'], ['street_light', 'Street Light'],
  ['garbage_waste', 'Garbage & Waste'], ['drainage', 'Drainage'],
  ['water_supply', 'Water Supply'], ['sewerage', 'Sewerage'],
  ['traffic', 'Traffic'], ['public_transport', 'Public Transport'],
  ['footpath', 'Footpath'], ['illegal_parking', 'Illegal Parking'],
  ['public_health', 'Public Health'], ['electricity', 'Electricity'],
  ['public_safety', 'Public Safety'], ['noise_pollution', 'Noise Pollution'],
  ['air_pollution', 'Air Pollution'], ['water_pollution', 'Water Pollution'],
  ['public_property_damage', 'Public Property Damage'], ['parks_recreation', 'Parks & Recreation'],
  ['mosquito_pest_control', 'Mosquito / Pest Control'], ['tree_environment', 'Tree / Environment'],
  ['illegal_construction', 'Illegal Construction'], ['other', 'Other']
];

const FALLBACK_CATEGORIES = CATEGORIES.map(([key, label]) => ({ key, label, defaultDepartment: '', description: '', departmentAvailable: false }));

const BLANK = {
  title: '',
  category: 'road_infrastructure',
  departmentName: '',
  description: '',
  priority: 'medium',
  area: '',
  address: '',
  landmark: '',
  latitude: '',
  longitude: '',
  additionalInfo: ''
};

/* Small helper: icon string → emoji approximation for the select.
   Falls back to a building emoji for unknown icon names. */
const ICON_EMOJI = {
  building2: '🏛️', hospital: '🏥', siren: '🚨', flame: '🔥', shield: '🛡️',
  trash2: '🗑️', zap: '⚡', droplets: '💧', leaf: '🌿', car: '🚗',
  treeDeciduous: '🌳', wrench: '🔧'
};
function deptEmoji(icon) { return ICON_EMOJI[icon] || '🏛️'; }

/* ------------------------------------------------------------------ */

export default function ReportForm({ report, onSave, onCancel, busy, prefilledDepartment = '' }) {
  const [values, setValues] = useState(BLANK);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [catalogueUpdated, setCatalogueUpdated] = useState(false);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError] = useState('');
  const mounted = useRef(true);

  // ── Fetch the live department list from the backend
  const loadDepartments = useCallback(async () => {
    setDeptLoading(true);
    setDeptError('');
    try {
      const { data } = await reportsApi.departments();
      if (!mounted.current) return;
      const list = data.departments || [];
      setDepartments(list);
      // If current selection is no longer valid, move to first department
      setValues((prev) => {
        // Prefilled department from URL takes priority on first load
        if (!prev.departmentName && prefilledDepartment) {
          const match = list.find((d) => d.name === prefilledDepartment);
          if (match) return { ...prev, departmentName: match.name };
        }
        // A retired department is no longer selectable, so fall back to the
        // first available one. An *empty* selection is left alone here — the
        // effect below fills it from the chosen category's default owner.
        if (prev.departmentName && !list.find((d) => d.name === prev.departmentName)) {
          return { ...prev, departmentName: list[0]?.name || '' };
        }
        return prev;
      });
    } catch {
      if (!mounted.current) return;
      // Graceful fallback: use static list
      const fallback = FALLBACK_DEPARTMENTS.map((name) => ({ name, icon: 'building2', color: '#2563eb', description: '' }));
      setDepartments(fallback);
      setDeptError('Could not load departments from server. Showing a default list.');
    } finally {
      if (mounted.current) setDeptLoading(false);
    }
  }, []);

  // Live category catalogue. Falls back to the compiled list if the request
  // fails, so the form is never empty.
  const loadCategories = useCallback(async () => {
    try {
      const { data } = await reportsApi.categories();
      if (!mounted.current) return;
      const list = data.categories || [];
      if (list.length) {
        setCategories(list);
        // Keep the current selection valid if the admin retired it.
        setValues((prev) => (
          list.some((category) => category.key === prev.category)
            ? prev
            : { ...prev, category: list[0].key }
        ));
      }
    } catch {
      if (mounted.current) setCategories(FALLBACK_CATEGORIES);
    }
  }, []);

  // Initial load
  useEffect(() => {
    mounted.current = true;
    loadDepartments();
    loadCategories();
    return () => { mounted.current = false; };
  }, [loadDepartments, loadCategories]);

  // Real-time: reload when admin creates/updates/activates/deactivates a dept
  useEffect(() => {
    const unsubscribe = subscribeToDepartmentCatalogue(() => {
      loadDepartments();
    });
    return unsubscribe;
  }, [loadDepartments]);

  // Real-time: a new or re-routed category shows up here without a reload.
  useEffect(() => {
    const unsubscribe = subscribeToReportCategories(() => {
      loadCategories();
      loadDepartments();
      if (mounted.current) {
        setCatalogueUpdated(true);
        setTimeout(() => mounted.current && setCatalogueUpdated(false), 4000);
      }
    });
    return unsubscribe;
  }, [loadCategories, loadDepartments]);

  // Populate form from an existing report (edit mode)
  useEffect(() => {
    if (report) {
      setValues({
        title: report.title,
        category: report.category,
        departmentName: report.departmentName || '',
        description: report.description,
        priority: report.priority,
        area: report.location?.area || '',
        address: report.location?.address || '',
        landmark: report.location?.landmark || '',
        latitude: report.location?.latitude ?? '',
        longitude: report.location?.longitude ?? '',
        additionalInfo: report.additionalInfo || ''
      });
    } else {
      setValues(BLANK);
    }
    setFiles([]);
    setError('');
  }, [report]);

  function defaultDepartmentFor(categoryKey) {
    const category = categories.find((item) => item.key === categoryKey);
    const preferred = category?.defaultDepartment;
    if (!preferred) return '';
    return departments.some((department) => department.name === preferred) ? preferred : '';
  }

  // Fill an untouched department from the default owner of the current category.
  useEffect(() => {
    if (deptLoading || report) return;
    setValues((prev) => {
      if (prev.departmentName) return prev;
      const preferred = defaultDepartmentFor(prev.category);
      return preferred ? { ...prev, departmentName: preferred } : prev;
    });
  }, [categories, departments, deptLoading, report]);

  function change(e) {
    const { name, value } = e.target;
    setValues((prev) => {
      if (name !== 'category') return { ...prev, [name]: value };
      const preferred = defaultDepartmentFor(value);
      return { ...prev, category: value, ...(preferred ? { departmentName: preferred } : {}) };
    });
  }
  function changeFiles(e) { setFiles(Array.from(e.target.files || [])); }

  function submit(e) {
    e.preventDefault();
    if (values.title.trim().length < 3 || values.description.trim().length < 10) {
      return setError('Use a title of at least 3 characters and a description of at least 10 characters.');
    }
    if (!values.departmentName.trim()) return setError('Choose the responsible department.');
    const hasLat = String(values.latitude).trim() !== '';
    const hasLon = String(values.longitude).trim() !== '';
    if (hasLat !== hasLon) return setError('Provide both latitude and longitude, or leave both blank.');
    if (hasLat) {
      const lat = Number(values.latitude); const lon = Number(values.longitude);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        return setError('Enter valid latitude and longitude values.');
      }
    }
    if (files.length > maxFiles) return setError(`Upload up to ${maxFiles} files per report.`);
    if (files.some((f) => !allowedTypes.has(f.type))) return setError('Only JPG, PNG, WebP, MP4, WebM, and MOV files are allowed.');
    if (files.some((f) => f.size > maxFileSize)) return setError('Each media file must be 25 MB or smaller.');
    setError('');
    const { area, address, landmark, latitude, longitude, ...payload } = values;
    onSave({ ...payload, location: JSON.stringify({ area, address, landmark, latitude, longitude }), media: files });
  }

  const selectedDept = departments.find((d) => d.name === values.departmentName);
  const activeCategory = categories.find((category) => category.key === values.category);

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
      {/* Form header */}
      <div className="mb-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <p className="text-xs font-bold tracking-[.14em] text-civic-600">CIVIC SERVICE REQUEST</p>
          <h2 className="mt-1 text-lg font-bold text-ink dark:text-slate-100">{report ? 'Edit report' : 'Report an issue'}</h2>
        </div>
        {report && (
          <button type="button" onClick={onCancel} className="text-sm font-bold text-slate-500 dark:text-slate-400">
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* ── Basic information ── */}
        <p className="text-sm font-bold text-ink dark:text-slate-100">Basic information</p>

        <label className="block text-sm font-semibold text-ink dark:text-slate-200">
          Issue title <span className="text-red-500">*</span>
          <input
            name="title"
            value={values.title}
            onChange={change}
            required
            maxLength={140}
            placeholder="Brief description of the issue"
            className="mt-1"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-ink dark:text-slate-200">
            Category
            <select name="category" value={values.category} onChange={change} className="mt-1">
              {categories.map((category) => (
                <option key={category.key} value={category.key}>{category.label}</option>
              ))}
            </select>
            {activeCategory?.description && (
              <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                {activeCategory.description}
              </span>
            )}
            {activeCategory?.defaultDepartment && (
              <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                Routed to <strong className="font-semibold">{activeCategory.defaultDepartment}</strong> by default.
              </span>
            )}
          </label>

          <label className="text-sm font-semibold text-ink dark:text-slate-200">
            Department <span className="text-red-500">*</span>
            {deptLoading ? (
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5">
                <svg className="h-4 w-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-slate-400">Loading departments…</span>
              </div>
            ) : (
              <select name="departmentName" value={values.departmentName} onChange={change} className="mt-1">
                {!values.departmentName && <option value="">— Select a department —</option>}
                {departments.map((dept) => (
                  <option key={dept.name} value={dept.name}>
                    {deptEmoji(dept.icon)} {dept.name}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>

        {/* Department info card — shown when a department is selected */}
        {selectedDept && (selectedDept.description || selectedDept.contactNumber || selectedDept.email) && (
          <div
            className="flex items-start gap-3 rounded-xl border p-3"
            style={{
              borderColor: `color-mix(in oklab, ${selectedDept.color || '#2563eb'} 35%, transparent)`,
              backgroundColor: `color-mix(in oklab, ${selectedDept.color || '#2563eb'} 8%, var(--surface, white))`
            }}
          >
            <span
              className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg"
              style={{
                backgroundColor: `color-mix(in oklab, ${selectedDept.color || '#2563eb'} 18%, white)`,
                color: selectedDept.color || '#2563eb'
              }}
            >
              {deptEmoji(selectedDept.icon)}
            </span>
            <div className="min-w-0 text-[13px]">
              <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedDept.name}</p>
              {selectedDept.description && (
                <p className="mt-0.5 text-slate-600 dark:text-slate-400 line-clamp-2">{selectedDept.description}</p>
              )}
              {(selectedDept.contactNumber || selectedDept.email) && (
                <p className="mt-1 text-slate-500 dark:text-slate-500">
                  {[selectedDept.contactNumber, selectedDept.email].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        )}

        {deptError && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            ⚠ {deptError}
            <button type="button" onClick={loadDepartments} className="ml-2 underline">Retry</button>
          </p>
        )}

        {/* ── Evidence & description ── */}
        <p className="pt-2 text-sm font-bold text-ink dark:text-slate-100">Evidence and description</p>

        <label className="block text-sm font-semibold text-ink dark:text-slate-200">
          Priority
          <select name="priority" value={values.priority} onChange={change} className="mt-1">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>

        <label className="block text-sm font-semibold text-ink dark:text-slate-200">
          Photo or video
          <input
            key={report?._id || 'new-report'}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={changeFiles}
            className="mt-1"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
            Up to {maxFiles} files. JPG, PNG, WebP, MP4, WebM, or MOV. Max 25 MB each.
          </span>
        </label>

        {report?.attachments?.length ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {report.attachments.length} existing media file{report.attachments.length === 1 ? '' : 's'} will be kept.
          </p>
        ) : null}

        <label className="block text-sm font-semibold text-ink dark:text-slate-200">
          Description <span className="text-red-500">*</span>
          <textarea
            name="description"
            rows={4}
            value={values.description}
            onChange={change}
            required
            maxLength={2000}
            placeholder="Describe the issue in detail — what, where, and how long it has been ongoing."
            className="mt-1"
          />
        </label>

        <fieldset className="grid gap-3 border-t border-slate-100 dark:border-slate-800 pt-5 sm:grid-cols-2">
          <legend className="pr-2 text-sm font-bold text-ink dark:text-slate-100">
            Location <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
          </legend>
          <input name="area" value={values.area} onChange={change} placeholder="Area or district" />
          <input name="landmark" value={values.landmark} onChange={change} placeholder="Nearby landmark" />
          <input className="sm:col-span-2" name="address" value={values.address} onChange={change} placeholder="Full address or location description" />
          <input name="latitude" type="number" step="any" value={values.latitude} onChange={change} placeholder="Latitude" />
          <input name="longitude" type="number" step="any" value={values.longitude} onChange={change} placeholder="Longitude" />
        </fieldset>

        <label className="block text-sm font-semibold text-ink dark:text-slate-200">
          Additional information
          <textarea
            name="additionalInfo"
            rows={2}
            value={values.additionalInfo}
            onChange={change}
            maxLength={1000}
            placeholder="Any other context the department should know"
            className="mt-1"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <button disabled={busy} className="civic-primary w-full sm:w-auto">
          {busy ? 'Saving…' : report ? 'Save changes' : 'Submit report'}
        </button>
      </div>
    </form>
  );
}
