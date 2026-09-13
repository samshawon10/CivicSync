import { useEffect, useState } from 'react';

const maxFiles = 5;
const maxFileSize = 25 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']);

const blank = {
  title: '',
  category: 'road',
  departmentName: 'Roads and Transportation',
  description: '',
  priority: 'medium'
};

const categories = [
  ['road', 'Road'],
  ['traffic_management', 'Traffic Management'],
  ['street_lighting', 'Street Lighting'],
  ['waste_management', 'Waste Management'],
  ['water_supply', 'Water Supply'],
  ['drainage', 'Drainage'],
  ['public_infrastructure', 'Public Infrastructure'],
  ['parks_environment', 'Parks and Environment'],
  ['public_health', 'Public Health'],
  ['electricity', 'Electricity'],
  ['public_safety', 'Public Safety'],
  ['noise_pollution', 'Noise Pollution'],
  ['illegal_dumping', 'Illegal Dumping'],
  ['other', 'Other']
];

const departments = [
  'Roads and Transportation',
  'Traffic Management',
  'Street Lighting',
  'Waste Management',
  'Water Supply',
  'Drainage and Sewerage',
  'Public Infrastructure',
  'Parks and Environment',
  'Public Health',
  'Electricity Services',
  'Public Safety',
  'General Services'
];

export default function ReportForm({ report, onSave, onCancel, busy }) {
  const [values, setValues] = useState(blank);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setValues(report ? {
      title: report.title,
      category: report.category,
      departmentName: report.departmentName || blank.departmentName,
      description: report.description,
      priority: report.priority
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
    if (files.length > maxFiles) return setError(`Upload up to ${maxFiles} files per report.`);
    if (files.some((file) => !allowedTypes.has(file.type))) return setError('Only JPG, PNG, WebP, GIF, MP4, WebM, and MOV files are allowed.');
    if (files.some((file) => file.size > maxFileSize)) return setError('Each media file must be 25 MB or smaller.');
    setError('');
    onSave({ ...values, media: files });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-ink">{report ? 'Edit report' : 'Report an issue'}</h2>
        {report && <button type="button" onClick={onCancel} className="text-sm font-bold text-slate-500">Cancel</button>}
      </div>
      <div className="space-y-3">
        <label className="block text-sm font-semibold">
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
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm font-semibold">
          Priority
          <select name="priority" value={values.priority} onChange={change}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Photo or video
          <input key={report?._id || 'new-report'} type="file" multiple accept="image/*,video/*" onChange={changeFiles} />
          <span className="mt-1 block text-xs font-normal text-slate-500">Up to 5 files. JPG, PNG, WebP, GIF, MP4, WebM, or MOV. Max 25 MB each.</span>
        </label>
        {report?.attachments?.length ? <p className="text-xs text-slate-500">{report.attachments.length} existing media file{report.attachments.length === 1 ? '' : 's'} will be kept.</p> : null}
        <label className="block text-sm font-semibold">
          Description
          <textarea name="description" rows="4" value={values.description} onChange={change} required maxLength="2000" />
        </label>
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="rounded-lg bg-civic-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Saving...' : report ? 'Save changes' : 'Submit report'}</button>
      </div>
    </form>
  );
}
