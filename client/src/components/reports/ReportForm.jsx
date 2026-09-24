import { useEffect, useState } from 'react';
import { reportsApi } from '../../services/reportService.js';

const maxFiles = 5;
const maxFileSize = 25 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']);

const blank = {
  title: '',
  category: 'road_infrastructure',
  departmentName: 'Roads & Infrastructure',
  description: '',
  priority: 'medium', area: '', address: '', landmark: '', latitude: '', longitude: '', additionalInfo: ''
};

const categories = [
  ['road_infrastructure', 'Road & Infrastructure'], ['street_light', 'Street Light'], ['garbage_waste', 'Garbage & Waste'], ['drainage', 'Drainage'], ['water_supply', 'Water Supply'], ['sewerage', 'Sewerage'], ['traffic', 'Traffic'], ['public_transport', 'Public Transport'], ['footpath', 'Footpath'], ['illegal_parking', 'Illegal Parking'],
  ['public_health', 'Public Health'],
  ['electricity', 'Electricity'], ['public_safety', 'Public Safety'], ['noise_pollution', 'Noise Pollution'], ['air_pollution', 'Air Pollution'], ['water_pollution', 'Water Pollution'], ['public_property_damage', 'Public Property Damage'], ['parks_recreation', 'Parks & Recreation'], ['mosquito_pest_control', 'Mosquito / Pest Control'], ['tree_environment', 'Tree / Environment'], ['illegal_construction', 'Illegal Construction'],
  ['other', 'Other']
];

const departments = [
  'Roads & Infrastructure', 'Waste Management', 'Water & Sewerage', 'Electricity', 'Traffic Management', 'Public Health', 'Environment', 'Parks & Recreation', 'Public Safety', 'Urban Planning', 'Other'
];

export default function ReportForm({ report, onSave, onCancel, busy }) {
  const [values, setValues] = useState(blank);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [liveDepartments, setLiveDepartments] = useState([]);

  useEffect(() => {
    reportsApi.departments().then(({ data }) => setLiveDepartments(data.departments || [])).catch(() => setLiveDepartments([]));
  }, []);

  const departmentOptions = liveDepartments.length ? liveDepartments.map((d) => d.name) : departments;

  useEffect(() => {
    if (departmentOptions.length && !departmentOptions.includes(values.departmentName) && departmentOptions[0]) {
      setValues((prev) => ({ ...prev, departmentName: departmentOptions[0] }));
    }
  }, [departmentOptions, values.departmentName]);

  useEffect(() => {
    setValues(report ? {
      title: report.title,
      category: report.category,
      departmentName: report.departmentName || blank.departmentName,
      description: report.description,
      priority: report.priority
      , area: report.location?.area || '', address: report.location?.address || '', landmark: report.location?.landmark || '', latitude: report.location?.latitude ?? '', longitude: report.location?.longitude ?? '', additionalInfo: report.additionalInfo || ''
    } : blank);
    setFiles([]);
    setError('');
  }, [report]);

  function change(e) {
    setValues({ ...values, [e.target.name]: e.target.value });
  }

  function changeFiles(e) {
    setFiles(Array.from(e.target.files || []));
  }

  function submit(e) {
    e.preventDefault();
    if (values.title.trim().length < 3 || values.description.trim().length < 10) return setError('Use a title of at least 3 characters and a description of at least 10 characters.');
    if (!values.departmentName.trim()) return setError('Choose the responsible department.');
    const hasLatitude = String(values.latitude).trim() !== '';
    const hasLongitude = String(values.longitude).trim() !== '';
    if (hasLatitude !== hasLongitude) return setError('Provide both latitude and longitude, or leave both blank.');
    if (hasLatitude) {
      const latitude = Number(values.latitude); const longitude = Number(values.longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return setError('Enter valid latitude and longitude values.');
    }
    if (files.length > maxFiles) return setError(`Upload up to ${maxFiles} files per report.`);
    if (files.some((file) => !allowedTypes.has(file.type))) return setError('Only JPG, PNG, WebP, MP4, WebM, and MOV files are allowed.');
    if (files.some((file) => file.size > maxFileSize)) return setError('Each media file must be 25 MB or smaller.');
    setError('');
    const { area, address, landmark, latitude, longitude, ...payload } = values;
    onSave({ ...payload, location: JSON.stringify({ area, address, landmark, latitude, longitude }), media: files });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
        <div><p className="text-xs font-bold tracking-[.14em] text-civic-600">CIVIC SERVICE REQUEST</p><h2 className="mt-1 text-lg font-bold text-ink">{report ? 'Edit report' : 'Report an issue'}</h2></div>
        {report && <button type="button" onClick={onCancel} className="text-sm font-bold text-slate-500">Cancel</button>}
      </div>
      <div className="space-y-3">
        <p className="text-sm font-bold text-ink">Basic information</p><label className="block text-sm font-semibold">
          Issue title
          <input name="title" value={values.title} onChange={change} required maxLength="140" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Category
            <select name="category" value={values.category} onChange={change}>
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Department name
            <select name="departmentName" value={values.departmentName} onChange={change}>
              {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
          </label>
        </div>
        <p className="pt-2 text-sm font-bold text-ink">Evidence and description</p><label className="block text-sm font-semibold">
          Priority
          <select name="priority" value={values.priority} onChange={change}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Photo or video
          <input key={report?._id || 'new-report'} type="file" multiple accept="image/*,video/*" onChange={changeFiles} />
          <span className="mt-1 block text-xs font-normal text-slate-500">Up to 5 files. JPG, PNG, WebP, MP4, WebM, or MOV. Max 25 MB each.</span>
        </label>
        {report?.attachments?.length ? <p className="text-xs text-slate-500">{report.attachments.length} existing media file{report.attachments.length === 1 ? '' : 's'} will be kept.</p> : null}
        <label className="block text-sm font-semibold">
          Description
          <textarea name="description" rows="4" value={values.description} onChange={change} required maxLength="2000" />
        </label>
        <fieldset className="grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2"><legend className="pr-2 text-sm font-bold text-ink">Location <span className="font-normal text-slate-500">(optional)</span></legend><input name="area" value={values.area} onChange={change} placeholder="Area" /><input name="landmark" value={values.landmark} onChange={change} placeholder="Landmark" /><input className="sm:col-span-2" name="address" value={values.address} onChange={change} placeholder="Address or location details" /><input name="latitude" type="number" step="any" value={values.latitude} onChange={change} placeholder="Latitude" /><input name="longitude" type="number" step="any" value={values.longitude} onChange={change} placeholder="Longitude" /></fieldset>
        <label className="block text-sm font-semibold">Additional information<textarea name="additionalInfo" rows="2" value={values.additionalInfo} onChange={change} maxLength="1000" /></label>
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="civic-primary w-full sm:w-auto">{busy ? 'Saving...' : report ? 'Save changes' : 'Submit report'}</button>
      </div>
    </form>
  );
}
