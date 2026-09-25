/**
 * CivicSync Intelligence — message-level building blocks.
 *
 * The tool trace is deliberately human-readable: raw tool names, database
 * queries and provider internals are never rendered in the browser. The gateway
 * only emits citations for records the caller was authorized to see, so the
 * "verified" badge is a trust signal rather than decoration.
 */
import { Button } from '../ui/primitives.jsx';
import { cx } from '../../utils/format.js';

export function AISourceBadge({ verified = false, label, count = 0 }) {
  const text = label || (verified ? 'Verified from CivicSync' : 'Based on your CivicSync data');
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        verified
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-line bg-surface-2 text-fg-muted'
      )}
    >
      <span aria-hidden="true">🛡</span>
      {text}
      {count > 0 && <span className="text-fg-muted">· {count} source{count === 1 ? '' : 's'}</span>}
    </span>
  );
}

/**
 * Loading-stage copy for the generic progress ticker. These are pacing hints
 * shown while a request is in flight, NOT claims about what the gateway did —
 * the real, sanitized tool trace replaces them once the response arrives.
 */
const STAGE_COPY = {
  auth: 'Authentication verified',
  retrieve: 'Retrieving your CivicSync data',
  check: 'Checking case status',
  generate: 'Generating a grounded response'
};

/** Steps arrive in two shapes: generic string stages, or backend {label, ok} objects. */
function stepText(step) {
  if (typeof step === 'string') return STAGE_COPY[step] || step;
  return step?.label || STAGE_COPY[step?.stage] || '';
}

/** Renders the gateway's tool trace as an accessible activity log. */
export function AIToolExecution({ steps = [], done = false }) {
  if (!steps.length) return null;
  return (
    <div className="mb-3 space-y-1.5" role="status" aria-live="polite">
      {steps.map((step, index) => {
        const complete = done || index < steps.length - 1;
        const text = stepText(step);
        if (!text) return null;
        return (
          <div
            key={`${text}-${index}`}
            className={cx('flex items-center gap-2 text-[12px]', complete ? 'text-fg-muted' : 'text-civic-600 dark:text-civic-300')}
          >
            <span
              aria-hidden="true"
              className={cx(
                'grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                complete ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-civic-500/15'
              )}
            >
              {complete ? '✓' : '•'}
            </span>
            <span>{text}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Structured record cards attached to a grounded answer (cases, services,
 * facilities). Each card is either a navigation affordance — routing to the
 * existing CivicSync page, never a new one — or a static reference.
 */
export function AICards({ items = [], onOpen }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 grid gap-1.5">
      {items.map((item, index) => {
        const body = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-fg">{item.title}</span>
              {item.subtitle && (
                <span className="block truncate text-[12px] text-fg-muted">{item.subtitle}</span>
              )}
            </span>
            {item.badge && (
              <span className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-fg-muted">
                {item.badge}
              </span>
            )}
            {item.path && (
              <span aria-hidden="true" className="shrink-0 text-[13px] text-fg-muted">
                ↗
              </span>
            )}
          </>
        );

        const shell =
          'flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition';

        return (
          <li key={item.id || index}>
            {item.path ? (
              <button
                type="button"
                onClick={() => onOpen?.(item)}
                className={cx(shell, 'hover:border-civic-400 hover:bg-civic-500/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-500')}
              >
                {body}
              </button>
            ) : (
              <div className={cx(shell, 'bg-surface-2')}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Human-in-the-loop confirmation. This card is UX only: the backend re-checks
 * actor, role, scope and payload before executing, and rejects any token not
 * minted for this user.
 */
export function AIActionCard({ action, onConfirm, onReject, busy = false }) {
  if (!action?.token) return null;
  const risky = action.risk === 'high_risk_write' || /emergency|dispatch/i.test(action.name || '');
  return (
    <div
      className={cx(
        'mt-3 rounded-xl border p-3.5',
        risky ? 'border-amber-500/40 bg-amber-500/5' : 'border-civic-400/40 bg-civic-500/5'
      )}
      role="group"
      aria-label="Proposed action awaiting confirmation"
    >
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-fg">
        <span aria-hidden="true">{risky ? '⚠' : '✦'}</span>
        {risky ? 'Human confirmation required' : 'Action requires confirmation'}
      </p>
      <p className="mt-2 text-[14px] font-medium text-fg">{action.label || action.name}</p>
      {action.explanation && (
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
          {risky ? 'Reason: ' : ''}
          {action.explanation}
        </p>
      )}
      {action.expiresAt && (
        <p className="mt-1.5 text-[11px] text-fg-muted">
          Expires{' '}
          {new Date(action.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onReject?.(action.token)}>
          Cancel
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onConfirm?.(action.token)}>
          {busy ? 'Working…' : 'Review'}
        </Button>
      </div>
    </div>
  );
}
