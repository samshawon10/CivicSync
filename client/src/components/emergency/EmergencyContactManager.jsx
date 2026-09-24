import { useEffect, useState } from 'react';
import { apiMessage } from '../../services/api.js';
import { confirmAction, showSuccess } from '../../utils/sweetAlert.js';
import { emergencyApi } from '../../services/emergencyService.js';
import { ErrorState, LoadingState } from './EmergencyCard.jsx';

const blank = { name: '', phone: '', relationship: '', enabledForSos: true };

/** Citizen emergency contact manager (name / phone / relationship / SOS toggle). */
export default function EmergencyContactManager() {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data } = await emergencyApi.contacts();
      setContacts(data.contacts || []);
      setError('');
    } catch (err) { setError(apiMessage(err)); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { setError('Name and phone are required.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (editingId) {
        const { data } = await emergencyApi.updateContact(editingId, form);
        setContacts((items) => items.map((item) => item._id === editingId ? data.contact : item));
        setNotice('Contact updated.');
      } else {
        const { data } = await emergencyApi.createContact(form);
        setContacts((items) => [data.contact, ...items]);
        setNotice('Contact added. It will be recorded with your SOS so command can reach them.');
      }
      setForm(blank); setEditingId(null);
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); }
  }

  async function remove(id) {
    const contact = contacts.find((item) => item._id === id);
    if (!await confirmAction({ title: 'Delete emergency contact?', text: `Remove ${contact?.name || 'this contact'} from your SOS list?`, confirmLabel: 'Delete contact' })) return;
    setError('');
    try {
      await emergencyApi.deleteContact(id);
      setContacts((items) => items.filter((item) => item._id !== id));
      if (editingId === id) { setEditingId(null); setForm(blank); }
      showSuccess('Emergency contact removed', 'The contact is no longer included in SOS records.');
    } catch (err) { setError(apiMessage(err)); }
  }

  if (loading) return <LoadingState text="Loading emergency contacts…" />;

  return (
    <div className="space-y-4">
      <ErrorState message={error} />
      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</p>}
      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-black text-ink">{editingId ? 'Edit contact' : 'Add emergency contact'}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-bold">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} required /></label>
          <label className="text-sm font-bold">Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} required placeholder="+880…" /></label>
          <label className="text-sm font-bold">Relationship<input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} maxLength={60} placeholder="Sibling, friend…" /></label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="h-4 w-4" checked={form.enabledForSos} onChange={(e) => setForm({ ...form, enabledForSos: e.target.checked })} />
          Record this contact when I send an SOS
        </label>
        <div className="mt-3 flex gap-2">
          <button disabled={busy} className="civic-primary">{busy ? 'Saving…' : editingId ? 'Save contact' : 'Add contact'}</button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(blank); }} className="civic-secondary">Cancel</button>}
        </div>
      </form>

      <div className="space-y-2">
        {contacts.length ? contacts.map((contact) => (
          <article key={contact._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-bold text-ink">{contact.name} <span className="text-sm font-semibold text-slate-500">· {contact.phone}</span></p>
              <p className="text-xs text-slate-500">{contact.relationship || 'Relationship not set'} · {contact.enabledForSos ? 'Included in SOS' : 'Excluded from SOS'}</p>
            </div>
            <div className="flex gap-3 text-sm font-bold">
              <button onClick={() => { setEditingId(contact._id); setForm({ name: contact.name, phone: contact.phone, relationship: contact.relationship || '', enabledForSos: contact.enabledForSos !== false }); }} className="text-civic-600">Edit</button>
              <button onClick={() => remove(contact._id)} className="text-red-600">Delete</button>
            </div>
          </article>
        )) : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No emergency contacts yet. Add someone we can reference during an SOS.</p>}
      </div>
      <p className="text-xs text-slate-500">Contact details are private. Note: this deployment has no SMS gateway configured, so contacts are recorded for Emergency Command — they are not auto-messaged.</p>
    </div>
  );
}