import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import api, { apiMessage } from '../../services/api.js';
import { notificationsApi } from '../../services/notificationService.js';
import { profilePhotoUrl } from '../../services/profilePhoto.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { SkeletonCard, SkeletonList } from '../../components/ui/Skeleton.jsx';
import { useToast } from '../../components/ui/Toaster.jsx';

const date = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';

function ErrorNotice({ message, onRetry }) {
  if (!message) return null;
  return <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">{message}{onRetry && <button type="button" onClick={onRetry} className="ml-3 font-bold underline">Try again</button>}</div>;
}

export default function CitizenAccount() {
  const { section } = useParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const { mode, setMode } = useTheme();
  const toast = useToast();
  const isNotifications = section === 'notifications';
  const isSettings = section === 'settings';
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isNotifications) {
        const { data } = await notificationsApi.list();
        setNotifications(data.notifications || []);
      } else {
        const { data } = await api.get('/users/me');
        setProfile(data);
      }
    } catch {
      setError(isNotifications ? "We couldn't load your notifications." : "We couldn't load your account details.");
    } finally {
      setLoading(false);
    }
  }, [isNotifications]);

  useEffect(() => { load(); }, [load]);

  const applyUser = (user) => {
    if (!user) return;
    setProfile((current) => current ? { ...current, user } : current);
    updateUser(user);
  };

  async function saveProfile(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true); setError('');
    try {
      const { data } = await api.patch('/users/me', { name: form.get('name'), phone: form.get('phone') });
      applyUser(data.user);
      toast.success('Your profile has been saved.');
    } catch (saveError) { setError(apiMessage(saveError)); } finally { setSaving(false); }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Choose a JPG, PNG, or WebP image for your profile photo.');
    if (file.size > 5 * 1024 * 1024) return setError('Profile images must be 5 MB or smaller.');
    const form = new FormData(); form.append('photo', file);
    setPhotoBusy(true); setError('');
    try {
      const { data } = await api.post('/users/me/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      applyUser(data.user);
      toast.success('Profile photo updated.');
    } catch (uploadError) { setError(apiMessage(uploadError)); } finally { setPhotoBusy(false); }
  }

  async function removePhoto() {
    setPhotoBusy(true); setError('');
    try {
      const { data } = await api.patch('/users/me', { photoURL: '' });
      applyUser(data.user);
      toast.success('Profile photo removed.');
    } catch (removeError) { setError(apiMessage(removeError)); } finally { setPhotoBusy(false); }
  }

  async function savePreference(event) {
    const emailNotifications = event.target.checked;
    setSaving(true); setError('');
    try {
      const { data } = await api.patch('/users/me/preferences', { emailNotifications });
      setProfile((current) => ({ ...current, preferences: data.preferences }));
      toast.success('Notification preference saved.');
    } catch (preferenceError) {
      event.target.checked = !emailNotifications;
      setError(apiMessage(preferenceError));
    } finally { setSaving(false); }
  }

  async function markAllRead() {
    setSaving(true); setError('');
    try {
      await notificationsApi.readAll();
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      toast.success('All notifications marked as read.');
    } catch (markError) { setError(apiMessage(markError)); } finally { setSaving(false); }
  }

  async function openNotification(item) {
    if (!item.readAt) {
      try {
        await notificationsApi.read(item._id);
        setNotifications((items) => items.map((current) => current._id === item._id ? { ...current, readAt: new Date().toISOString() } : current));
      } catch (readError) { setError(apiMessage(readError)); return; }
    }
    const reportId = item.relatedType === 'report' ? item.relatedId : item.report;
    if (reportId) navigate(`/dashboard/citizen/reports/${reportId}`);
    else if (item.relatedType === 'emergency' && item.relatedId) navigate(`/dashboard/citizen/emergency/${item.relatedId}`);
  }

  if (isNotifications) return <CitizenLayout title="Notifications">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-ink dark:text-slate-100">Your updates</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Case, emergency, and CivicSync updates in one place.</p></div><button type="button" disabled={saving || !notifications.some((item) => !item.readAt)} onClick={markAllRead} className="civic-secondary disabled:opacity-50">Mark all as read</button></div>
    <ErrorNotice message={error} onRetry={load} />
    {loading ? <SkeletonList rows={5} /> : notifications.length ? <div className="space-y-3">{notifications.map((item) => <button key={item._id} type="button" onClick={() => openNotification(item)} className={`block w-full rounded-xl border p-4 text-left transition hover:border-civic-300 ${item.readAt ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900' : 'border-civic-200 bg-civic-50 dark:border-civic-800 dark:bg-civic-500/10'}`}><p className={`text-sm ${item.readAt ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-ink dark:text-slate-100'}`}>{item.message}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(item.createdAt).toLocaleString()}{!item.readAt && ' · Unread'}</p></button>)}</div> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-600 dark:bg-slate-900"><p className="font-bold text-ink dark:text-slate-100">You're all caught up 🎉</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No notifications right now.</p></div>}
  </CitizenLayout>;

  const user = profile?.user;
  return <CitizenLayout title={isSettings ? 'Settings' : 'My profile'}>
    <ErrorNotice message={error} onRetry={load} />
    {loading ? <SkeletonCard height={420} className="max-w-2xl" /> : !user ? null : isSettings ? <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="text-lg font-bold text-ink dark:text-slate-100">Preferences</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">These settings are saved to your CivicSync account where supported.</p><label className="mt-6 flex items-center justify-between gap-4"><span><span className="block font-semibold text-ink dark:text-slate-100">Email notifications</span><span className="text-sm text-slate-500 dark:text-slate-400">Receive email when your report status changes.</span></span><input className="h-5 w-5" type="checkbox" disabled={saving} checked={profile.preferences?.emailNotifications ?? true} onChange={savePreference} /></label><label className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-6 dark:border-slate-800"><span><span className="block font-semibold text-ink dark:text-slate-100">Appearance</span><span className="text-sm text-slate-500 dark:text-slate-400">Choose how CivicSync looks on this device.</span></span><select value={mode} onChange={(event) => setMode(event.target.value)} className="w-32"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></section> : <div className="grid max-w-4xl gap-6 lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-civic-100 text-3xl font-bold text-civic-700 dark:bg-civic-500/10 dark:text-civic-300">{user.photoURL ? <img src={profilePhotoUrl(user.photoURL)} alt="Your profile" className="h-full w-full object-cover" /> : user.name?.slice(0, 1).toUpperCase()}</div><p className="mt-4 font-bold text-ink dark:text-slate-100">{user.name}</p><p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{user.email}</p><label className="civic-secondary mt-5 cursor-pointer"><input className="sr-only" type="file" accept="image/*" disabled={photoBusy} onChange={uploadPhoto} />{photoBusy ? 'Uploading…' : user.photoURL ? 'Replace photo' : 'Upload photo'}</label>{user.photoURL && <button type="button" disabled={photoBusy} onClick={removePhoto} className="mt-3 text-sm font-semibold text-red-700 underline disabled:opacity-50 dark:text-red-300">Remove photo</button>}</aside><form onSubmit={saveProfile} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="text-lg font-bold text-ink dark:text-slate-100">Personal information</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep your contact details up to date so CivicSync can reach you about your reports.</p><label className="mt-6 block text-sm font-semibold text-ink dark:text-slate-100">Full name<input name="name" defaultValue={user.name} required minLength={2} maxLength={80} /></label><label className="mt-4 block text-sm font-semibold text-ink dark:text-slate-100">Phone number <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span><input name="phone" type="tel" defaultValue={user.phone || ''} maxLength={30} placeholder="e.g. +880 1XXX-XXXXXX" /></label><div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2 dark:border-slate-800"><p><span className="text-slate-500 dark:text-slate-400">Email</span><br /><span className="font-medium text-ink dark:text-slate-100">{user.email}</span></p><p><span className="text-slate-500 dark:text-slate-400">Account status</span><br /><span className="font-medium capitalize text-ink dark:text-slate-100">{user.status}</span></p><p><span className="text-slate-500 dark:text-slate-400">Role</span><br /><span className="font-medium text-ink dark:text-slate-100">Citizen</span></p><p><span className="text-slate-500 dark:text-slate-400">Member since</span><br /><span className="font-medium text-ink dark:text-slate-100">{date(user.createdAt)}</span></p></div><div className="mt-6 flex flex-wrap gap-3"><button disabled={saving} className="civic-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button><Link to="/dashboard/citizen/settings" className="civic-secondary">Preferences</Link></div></form></div>}
  </CitizenLayout>;
}
