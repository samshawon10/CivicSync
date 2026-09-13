import { useEffect, useState } from 'react';

const blank = { title: '', description: '', category: '' };
export default function ComplaintForm({ complaint, onSubmit, onCancel, busy }) {
  const [values, setValues] = useState(blank);
  useEffect(() => setValues(complaint ? { title: complaint.title, description: complaint.description, category: complaint.category, status: complaint.status } : blank), [complaint]);
  const edit = Boolean(complaint);
  return <form className="rounded-xl border border-slate-200 bg-slate-50 p-5" onSubmit={(e) => { e.preventDefault(); onSubmit(values); }}>
    <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-ink">{edit ? 'Edit complaint' : 'Add a complaint'}</h2>{edit && <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-900">Cancel</button>}</div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium sm:col-span-2">Title<input value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} required maxLength="140" /></label><label className="text-sm font-medium">Category<input value={values.category} onChange={(e) => setValues({ ...values, category: e.target.value })} placeholder="Street Lighting" required maxLength="80" /></label>{edit && <label className="text-sm font-medium">Status<select value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value })}><option>Pending</option><option>In Progress</option><option>Resolved</option></select></label>}<label className="text-sm font-medium sm:col-span-2">Description<textarea rows="3" value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} required maxLength="2000" /></label></div>
    <button disabled={busy} className="mt-4 rounded-lg bg-civic-600 px-4 py-2 text-sm font-semibold text-white hover:bg-civic-500 disabled:opacity-60">{busy ? 'Saving…' : edit ? 'Save changes' : 'Create complaint'}</button>
  </form>;
}

