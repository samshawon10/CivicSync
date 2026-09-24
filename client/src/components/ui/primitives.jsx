import Icon from './Icon.jsx';
import { cx } from '../../utils/format.js';

/* ------------------------------------------------------------------ Buttons */

export function Spinner({ size = 16, className = '' }) {
  return (
    <span
      className={cx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function Button({ variant = 'secondary', size = 'md', icon, iconRight, loading = false, className = '', children, ...rest }) {
  const variants = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger' };
  const sizes = { sm: 'btn-sm', md: '', icon: 'btn-icon' };
  return (
    <button
      type={rest.type || 'button'}
      className={cx('btn', variants[variant] || variants.secondary, sizes[size], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={16} /> : null}
    </button>
  );
}

export function IconButton({ icon, label, variant = 'ghost', size = 'icon', ...rest }) {
  return (
    <Button variant={variant} size={size} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={17} />
    </Button>
  );
}

/* -------------------------------------------------------------------- Cards */

export function Card({ as: Tag = 'section', className = '', children, ...rest }) {
  return <Tag className={cx('civic-card', className)} {...rest}>{children}</Tag>;
}

export function CardHeader({ title, subtitle, action, icon, className = '', dense = false }) {
  return (
    <header className={cx('flex flex-wrap items-start justify-between gap-3 border-b border-line', dense ? 'px-4 py-3' : 'px-5 py-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg" style={{ backgroundColor: 'color-mix(in oklab, var(--color-civic-500) 14%, var(--surface))', color: 'var(--color-civic-600)' }}>
            <Icon name={icon} size={18} />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="civic-section-title truncate">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={cx('px-5 py-4', className)}>{children}</div>;
}

/* ------------------------------------------------------------------- Badges */

const toneClass = {
  critical: 'status-danger', high: 'status-high', medium: 'status-medium', success: 'status-success',
  info: 'status-info', neutral: 'status-neutral', muted: 'status-muted'
};

export function Badge({ tone = 'neutral', children, icon, className = '', title }) {
  return (
    <span className={cx('chip', toneClass[tone] || toneClass.neutral, className)} title={title}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

export function StatusDot({ tone = 'neutral', label }) {
  const dot = {
    success: 'bg-emerald-500', critical: 'bg-red-500', medium: 'bg-amber-500',
    high: 'bg-orange-500', info: 'bg-blue-500', neutral: 'bg-slate-400', muted: 'bg-slate-400'
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cx('h-2 w-2 rounded-full', dot[tone] || dot.neutral)} aria-hidden="true" />
      {label ? <span className="text-[13px] font-semibold text-fg-muted">{label}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------- Inputs */

export function Field({ label, hint, error, required, children, className = '', htmlFor }) {
  return (
    <label className={cx('block space-y-1.5', className)} htmlFor={htmlFor}>
      {label && (
        <span className="flex items-center gap-1 text-[13px] font-semibold text-fg">
          {label}
          {required && <span className="text-red-600" aria-hidden="true">*</span>}
        </span>
      )}
      {children}
      {error ? <span className="block text-xs font-semibold text-red-600">{error}</span> : hint ? <span className="block text-xs text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled = false }) {
  return (
    <div className={cx('flex items-start gap-3', disabled && 'opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className="mt-0.5 h-5 w-9 shrink-0 rounded-full border transition"
        style={{ backgroundColor: checked ? 'var(--color-civic-600)' : 'var(--line)', borderColor: checked ? 'var(--color-civic-600)' : 'var(--line-strong)' }}
      >
        <span className="block h-4 w-4 rounded-full bg-white shadow transition" style={{ transform: `translateX(${checked ? 18 : 2}px)` }} />
      </button>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-fg">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-fg-subtle">{hint}</span>}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------------- Tabs */

export function Tabs({ tabs = [], value, onChange, className = '', size = 'md' }) {
  function onKeyDown(event) {
    const index = tabs.findIndex((tab) => tab.key === value);
    if (index < 0) return;
    if (event.key === 'ArrowRight') onChange?.(tabs[(index + 1) % tabs.length].key);
    if (event.key === 'ArrowLeft') onChange?.(tabs[(index - 1 + tabs.length) % tabs.length].key);
  }
  return (
    <div role="tablist" aria-label="Sections" onKeyDown={onKeyDown} className={cx('flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1', className)}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange?.(tab.key)}
            className={cx('flex items-center gap-2 whitespace-nowrap rounded-lg font-semibold transition', size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-3.5 py-2 text-sm', active ? 'text-white' : 'text-fg-muted hover:text-fg')}
            style={active ? { backgroundColor: 'var(--color-civic-600)' } : undefined}
          >
            {tab.icon ? <Icon name={tab.icon} size={15} /> : null}
            {tab.label}
            {tab.count != null && (
              <span className={cx('tabular rounded-full px-1.5 py-0.5 text-[11px] font-bold', active ? 'bg-white/20 text-white' : 'bg-surface-2 text-fg-subtle')}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented({ options = [], value, onChange, className = '', ariaLabel = 'View' }) {
  return (
    <div role="group" aria-label={ariaLabel} className={cx('inline-flex rounded-lg border border-line bg-surface p-0.5', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(option.value)}
            className={cx('rounded-md px-3 py-1.5 text-[13px] font-semibold transition', active ? 'text-white' : 'text-fg-muted hover:text-fg')}
            style={active ? { backgroundColor: 'var(--color-civic-600)' } : undefined}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------- States & utilities */

export function EmptyState({ icon = 'inbox', title, hint, action, className = '' }) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-10 text-center', className)}>
      <span className="grid h-11 w-11 place-items-center rounded-full" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--fg-subtle)' }}>
        <Icon name={icon} size={20} />
      </span>
      <p className="mt-3 text-sm font-semibold text-fg">{title}</p>
      {hint && <p className="mt-1 max-w-md text-[13px] text-fg-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, details, className = '', title = 'Unable to load this section' }) {
  if (!message) return null;
  return (
    <div role="alert" className={cx('rounded-xl border p-4', className)} style={{ borderColor: 'color-mix(in oklab, #ef4444 40%, var(--line))', backgroundColor: 'color-mix(in oklab, #ef4444 10%, var(--surface))' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="text-red-600"><Icon name="alertTriangle" size={18} /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">{title}</p>
            <p className="mt-0.5 break-words text-[13px] text-fg-muted">{message}</p>
            {details && <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-fg-subtle">Technical details</summary><p className="mt-1 break-all text-xs text-fg-subtle">{details}</p></details>}
          </div>
        </div>
        {onRetry && <Button size="sm" icon="refresh" onClick={onRetry}>Retry</Button>}
      </div>
    </div>
  );
}

export function Pagination({ page = 1, pages = 1, total = 0, limit = 20, onPage, className = '' }) {
  if (pages <= 1) return <p className={cx('text-[13px] text-fg-subtle', className)}>{total} record{total === 1 ? '' : 's'}</p>;
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-[13px] text-fg-subtle">
        Page <span className="tabular font-semibold text-fg">{page}</span> of <span className="tabular font-semibold text-fg">{pages}</span> · <span className="tabular">{total}</span> records · up to {limit} per page
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" icon="chevronLeft" onClick={() => onPage?.(page - 1)} disabled={page <= 1}>Previous</Button>
        <Button size="sm" iconRight="chevronRight" onClick={() => onPage?.(page + 1)} disabled={page >= pages}>Next</Button>
      </div>
    </div>
  );
}

export function Progress({ value = 0, tone = 'info', label, className = '' }) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  const colors = { info: 'var(--color-civic-600)', success: '#10b981', high: '#f97316', critical: '#ef4444', medium: '#eab308', neutral: 'var(--line-strong)' };
  return (
    <div className={className}>
      {label && <div className="mb-1 flex justify-between text-xs text-fg-subtle"><span>{label}</span><span className="tabular">{percent}%</span></div>}
      <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--surface-2)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: colors[tone] || colors.info }} />
      </div>
    </div>
  );
}

export function KeyValue({ items = [], className = '', columns = 2 }) {
  return (
    <dl className={cx('grid gap-x-6 gap-y-3 text-sm', columns === 3 ? 'sm:grid-cols-3' : columns === 1 ? '' : 'sm:grid-cols-2', className)}>
      {items.filter(Boolean).map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{item.label}</dt>
          <dd className="mt-0.5 break-words font-medium text-fg">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionHeading({ title, subtitle, action, className = '' }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h2 className="civic-section-title">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-fg-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** KPI card used across the Super Admin overview and analytics pages. */
export function StatCard({ label, value, icon, hint, trend, tone = 'info', loading = false, className = '' }) {
  const tones = {
    info: 'var(--color-civic-600)', success: '#10b981', high: '#f97316', critical: '#ef4444', medium: '#eab308', neutral: 'var(--fg-subtle)'
  };
  return (
    <article className={cx('civic-card interactive p-4 hover:-translate-y-0.5', className)} aria-busy={loading}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-fg-muted">{label}</p>
        {icon && (
          <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: `color-mix(in oklab, ${tones[tone] || tones.info} 14%, var(--surface))`, color: tones[tone] || tones.info }}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <p className="tabular mt-3 text-[1.75rem] font-bold leading-none text-fg">{loading ? '—' : value}</p>
      {(trend || hint) && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle">
          {trend ? (
            <span className={cx('inline-flex items-center gap-1 font-semibold', trend.tone === 'up' ? 'text-emerald-600' : trend.tone === 'down' ? 'text-red-600' : 'text-fg-subtle')}>
              {trend.tone === 'up' || trend.tone === 'down' ? <Icon name="trendingUp" size={12} /> : null}
              {trend.text}
            </span>
          ) : null}
          {hint ? <span>{hint}</span> : null}
        </p>
      )}
    </article>
  );
}


