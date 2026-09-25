/**
 * CivicSync Intelligence — loading, empty and error states.
 *
 * Composed entirely from existing CivicSync design tokens (`bg-surface`,
 * `border-line`, `text-fg-muted`, `civic-*`) so these surfaces inherit
 * light/dark theming instead of hard-coding a palette.
 */
import { Button } from '../ui/primitives.jsx';
import { cx } from '../../utils/format.js';

/** Premium skeleton lines. The user never stares at a blank panel. */
export function AILoadingState({ label = 'CivicSync Intelligence is thinking' }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label={label}>
      <div className="flex items-center gap-2 text-[12px] font-medium text-civic-600 dark:text-civic-300">
        <span aria-hidden="true" className="animate-pulse">✦</span>
        {label}…
      </div>
      <div aria-hidden="true" className="space-y-2">
        <div className="h-3 w-11/12 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-8/12 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-10/12 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}

export function AIEmptyState({ groups = [], suggestions = [], userName = '', onPick }) {
  const firstName = String(userName || '').trim().split(' ')[0];
  return (
    <div className="flex h-full flex-col justify-center gap-5 px-1 py-6">
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-civic-500/10 text-xl text-civic-600 dark:text-civic-300">
          <span aria-hidden="true">✦</span>
        </div>
        <h3 className="text-[15px] font-semibold text-fg">CivicSync Intelligence</h3>
        <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-fg-muted">
          {firstName ? `Hello ${firstName} 👋` : 'Hello 👋'} Your intelligent civic assistant. Ask about your cases,
          services, safety, community information, or CivicSync data.
        </p>
      </div>

      {groups.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {groups.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => onPick?.(group)}
              className="rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-[13px] font-medium text-fg transition hover:border-civic-400 hover:bg-civic-500/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-500"
            >
              {group}
            </button>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
            What needs your attention?
          </p>
          {suggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPick?.(prompt)}
              className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-[13px] text-fg transition hover:border-civic-400 hover:bg-civic-500/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-500"
            >
              <span aria-hidden="true" className="text-civic-500">✦</span>
              <span className="min-w-0 flex-1">{prompt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Maps a transport error code to copy a resident can actually act on. */
const ERROR_COPY = {
  UNAUTHENTICATED: {
    title: 'Please sign in again to continue.',
    hint: 'Your session expired. Sign in and reopen CivicSync Intelligence.'
  },
  NOT_AUTHORIZED: {
    title: 'You do not have permission to access that CivicSync information.',
    hint: 'Ask an administrator if you believe you should have access.'
  },
  ROLE_NOT_PERMITTED: {
    title: 'Your role cannot perform that CivicSync action.',
    hint: 'The assistant only proposes actions your role is allowed to run.'
  },
  NETWORK: {
    title: "You're offline.",
    hint: 'AI requires an internet connection. Your existing CivicSync data remains available where supported.'
  },
  RATE_LIMITED: {
    title: 'You have reached your CivicSync Intelligence limit.',
    hint: 'Please pause for a moment and try again.'
  }
};

export function AIErrorState({ error, onRetry }) {
  const code = error?.code || 'DEFAULT';
  const copy = ERROR_COPY[code] || {
    title: 'AI temporarily unavailable',
    hint: 'Your CivicSync services are still working normally.'
  };
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" role="alert">
      <p className="text-[14px] font-semibold text-fg">{copy.title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
        {error?.message || copy.hint}
      </p>
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}

/**
 * Small helper shared by the message + dashboard cards: a "generated by AI"
 * header strip. Kept here so the visual language stays in one place.
 */
export function AIHeading({ title, subtitle, tone = 'civic' }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className={cx(
          'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm',
          tone === 'civic' ? 'bg-civic-500/10 text-civic-600 dark:text-civic-300' : 'bg-surface-2 text-fg-muted'
        )}
      >
        ✦
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-fg">{title}</p>
        {subtitle && <p className="text-[12px] text-fg-muted">{subtitle}</p>}
      </div>
    </div>
  );
}
