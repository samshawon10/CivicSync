import { cx } from '../../utils/format.js';

/**
 * One skeleton system for the whole product.
 * Every skeleton is a real layout placeholder: no blank screens, no layout
 * jump, no "Loading…" text. Animation is CSS-only and is disabled entirely by
 * `prefers-reduced-motion` (see index.css), where a static state remains.
 */
export function Skeleton({ className = '', width, height, radius = 8, style, ...rest }) {
  return (
    <div
      className={cx('skeleton', className)}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}

export function SkeletonText({ lines = 3, className = '', lastWidth = '60%' }) {
  return (
    <div className={cx('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} height={11} width={index === lines - 1 ? lastWidth : '100%'} />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 36 }) {
  return <Skeleton width={size} height={size} radius={999} />;
}

export function SkeletonCard({ height = 130, className = '' }) {
  return <Skeleton className={cx('w-full', className)} height={height} radius={12} />;
}

export function SkeletonKpiGrid({ count = 4, className = '' }) {
  return (
    <div className={cx('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="civic-card p-4">
          <div className="flex items-center justify-between">
            <Skeleton height={11} width="45%" />
            <Skeleton width={32} height={32} radius={10} />
          </div>
          <Skeleton className="mt-4" height={26} width="38%" />
          <Skeleton className="mt-3" height={10} width="62%" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 5, className = '' }) {
  return (
    <div className={cx('civic-card overflow-hidden', className)} aria-hidden="true">
      <div className="flex gap-4 border-b border-line px-4 py-3">
        {Array.from({ length: columns }).map((_, index) => <Skeleton key={index} height={10} width={index === 0 ? '22%' : '12%'} />)}
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-3.5">
            <SkeletonAvatar size={30} />
            <Skeleton height={11} width="18%" />
            <Skeleton height={11} width="14%" />
            <Skeleton height={11} width="20%" />
            <Skeleton height={11} width="10%" />
            <Skeleton className="ml-auto" height={22} width={70} radius={999} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart({ height = 220, className = '' }) {
  return (
    <div className={cx('civic-card p-5', className)} aria-hidden="true">
      <Skeleton height={12} width="30%" />
      <div className="mt-5 flex items-end gap-2" style={{ height }}>
        {[42, 68, 30, 84, 52, 74, 38, 60, 46, 78, 34, 56].map((value, index) => (
          <Skeleton key={index} className="flex-1" height={`${value}%`} radius={6} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 5, className = '' }) {
  return (
    <div className={cx('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl border border-line p-3.5">
          <SkeletonAvatar size={34} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton height={11} width="38%" />
            <Skeleton height={10} width="66%" />
          </div>
          <Skeleton height={10} width={62} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonMap({ height = 380, className = '' }) {
  return (
    <div className={cx('civic-card overflow-hidden p-3', className)} aria-hidden="true">
      <Skeleton height={height} radius={10} />
      <div className="mt-3 flex flex-wrap gap-3 px-1">
        {[70, 58, 64, 52].map((width, index) => <Skeleton key={index} height={10} width={width} />)}
      </div>
    </div>
  );
}

export function SkeletonForm({ fields = 4, className = '' }) {
  return (
    <div className={cx('civic-card space-y-5 p-5', className)} aria-hidden="true">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton height={10} width="24%" />
          <Skeleton height={40} radius={10} />
        </div>
      ))}
      <Skeleton height={40} width={140} radius={10} />
    </div>
  );
}

/** Full-page placeholder: header, KPI row and content blocks. */
export function SkeletonPage({ title = true, kpis = 4, blocks = 2 }) {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Loading content">
      {title && (
        <div className="space-y-3">
          <Skeleton height={12} width={160} />
          <Skeleton height={28} width={320} />
          <Skeleton height={12} width={420} />
        </div>
      )}
      <SkeletonKpiGrid count={kpis} />
      {Array.from({ length: blocks }).map((_, index) => (
        <div key={index} className="grid gap-4 lg:grid-cols-2">
          <SkeletonChart height={180} />
          <SkeletonList rows={4} />
        </div>
      ))}
      <span className="sr-only">Loading CivicSync data…</span>
    </div>
  );
}

export default Skeleton;
