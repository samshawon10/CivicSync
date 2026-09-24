import { useState } from 'react';
import { apiMessage } from '../../services/api.js';
import { emergencyApi, label, mediaUrl } from '../../services/emergencyService.js';
import { ErrorState } from './EmergencyCard.jsx';

const accepted = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/webm,application/pdf';

/**
 * Evidence uploader with real progress tracking. Evidence files are stored
 * privately and served through an authenticated endpoint — never public static URLs.
 */
export default function EvidenceUploader({ emergencyId, evidence = [], canUpload = true, onChanged }) {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!files.length) { setError('Select at least one evidence file.'); return; }
    setBusy(true); setError(''); setNotice(''); setProgress(0);
    try {
      const { data } = await emergencyApi.uploadEvidence(emergencyId, files, setProgress);
      setNotice(`${files.length} file(s) uploaded.`);
      setFiles([]);
      event.target.reset?.();
      if (onChanged) onChanged(data.emergency);
    } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); setProgress(null); }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-black text-ink">Evidence</h3>
      <p className="text-xs text-slate-500">Photos, video, voice notes, or documents. Private — visible only to you and authorized responders.</p>
      {evidence.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {evidence.map((item) => (
            <li key={item.filename} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
              {item.mediaType === 'image'
                ? <img src={mediaUrl(item.url)} alt={item.originalName || 'Evidence'} className="h-12 w-12 rounded object-cover" referrerPolicy="no-referrer" />
                : item.mediaType === 'video'
                  ? <video src={mediaUrl(item.url)} className="h-12 w-16 rounded object-cover" muted preload="metadata" />
                  : <span className="grid h-12 w-12 place-items-center rounded bg-slate-100 text-lg">{item.mediaType === 'audio' ? '🎤' : '📄'}</span>}
              <div className="min-w-0">
                <a href={mediaUrl(item.url)} target="_blank" rel="noreferrer" className="block truncate font-semibold text-civic-700">{item.originalName || item.filename}</a>
                <p className="text-xs text-slate-400">{label(item.mediaType)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-slate-400">No evidence uploaded yet.</p>}

      {canUpload && (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <input type="file" multiple accept={accepted} onChange={(e) => setFiles(Array.from(e.target.files || []))} className="text-sm" />
          <ErrorState message={error} />
          {notice && <p className="rounded bg-emerald-50 p-2 text-sm font-semibold text-emerald-700">{notice}</p>}
          {progress !== null && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-civic-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <button disabled={busy} className="civic-secondary">{busy ? `Uploading ${progress ?? 0}%…` : 'Upload evidence'}</button>
        </form>
      )}
    </section>
  );
}