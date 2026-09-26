import { CheckCircle2, LocateFixed, Siren } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Hold-to-confirm SOS button (3 seconds).
 * - Requires a completed GPS attempt before activation when possible,
 *   and clearly reports when location is unavailable.
 * - Refuses to pretend anything was sent while the device is offline.
 *
 * onActivate({ location, locationStatus }) must perform the real creation
 * request; this component never claims success on its own.
 */
export default function SOSButton({ onActivate, captureLocation, label = 'SOS\nHOLD', title = 'HOLD TO SEND SOS', busy = false }) {
  const [holding, setHolding] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState(0);
  const timer = useRef(null);
  const raf = useRef(null);
  const startedAt = useRef(0);
  const duration = 3000;

  function tick() {
    const elapsed = Date.now() - startedAt.current;
    setProgress(Math.min(100, Math.round((elapsed / duration) * 100)));
    if (elapsed < duration) raf.current = requestAnimationFrame(tick);
  }

  async function begin(event) {
    event.preventDefault();
    if (busy || holding) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      onActivate?.(null, { offline: true });
      return;
    }
    setHolding(true);
    setPhase('holding');
    setProgress(0);
    startedAt.current = Date.now();
    raf.current = requestAnimationFrame(tick);
    timer.current = setTimeout(async () => {
      setHolding(false);
      setProgress(0);
      setPhase('locating');
      cancelAnimationFrame(raf.current);
      const result = captureLocation ? await captureLocation() : { ok: false, location: null, error: 'Location service not attached.' };
      setPhase(result.ok ? 'located' : 'error');
      await onActivate?.(result.location, { offline: false, locationStatus: result });
      setPhase('idle');
    }, duration);
  }

  function cancel() {
    clearTimeout(timer.current);
    cancelAnimationFrame(raf.current);
    setHolding(false);
    setPhase('idle');
    setProgress(0);
  }

  useEffect(() => () => { clearTimeout(timer.current); cancelAnimationFrame(raf.current); }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-black uppercase tracking-[.18em] text-red-700 dark:text-red-200">{title}</p>
      <button
        type="button"
        onPointerDown={begin}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') begin(e); }}
        onKeyUp={cancel}
        disabled={busy}
        aria-label={title}
        className={`sos-pulse relative grid h-36 w-36 select-none place-items-center rounded-full border-8 border-red-300 bg-white text-center text-xl font-black whitespace-pre-line text-red-700 shadow-2xl transition dark:border-red-800 dark:bg-surface dark:text-red-300 ${holding ? 'scale-95 bg-red-100 dark:bg-red-950/70' : ''}`}
        style={holding ? { background: `conic-gradient(#ef4444 ${progress * 3.6}deg, var(--surface-2) 0deg)` } : undefined}
      >
        {busy ? <><Siren size={28} /> SENDING…</> : holding ? `HOLD ${Math.ceil((duration - (Date.now() - startedAt.current)) / 1000) || 1}` : <><Siren size={30} />{label.split('\n').map((line) => <span key={line} className="block">{line}</span>)}</>}
      </button>
      <p className="text-[11px] font-semibold text-red-700 dark:text-red-200" aria-live="polite">
        {phase === 'locating' ? <span className="inline-flex items-center gap-1"><LocateFixed size={13} /> Requesting location permission…</span> : phase === 'located' ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> Location detected · submitting emergency</span> : phase === 'error' ? 'Location unavailable · enter an address below' : 'Press and hold for 3 seconds'}
      </p>
    </div>
  );
}
