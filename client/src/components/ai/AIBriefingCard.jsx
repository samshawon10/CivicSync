/**
 * CivicSync Intelligence — inline contextual entry point.
 *
 * Used on dashboards and record detail pages to offer page-aware AI without
 * duplicating the copilot. It opens the SAME global drawer pre-scoped to the
 * page's preset, so there is exactly one conversation engine in the product.
 *
 * All figures shown come from props that the page already fetched through its
 * authorized API call. Nothing here invents, estimates or caches numbers.
 */
import { Button, Card, CardBody, Spinner } from '../ui/primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCivicAIContext } from './CivicAIProvider.jsx';
import { presetFor } from './aiPrompts.js';

/**
 * @param {string}   presetKey  key into PAGE_PRESETS (case, emergency, service…)
 * @param {object}   context    extra pageContext (ids/labels only)
 * @param {Array}    stats      [{ label, value }] real values from the page's data
 */
export default function AIBriefingCard({
  presetKey,
  context = {},
  title,
  subtitle,
  description,
  stats = [],
  actionLabel = 'Ask CivicSync AI',
  loading = false,
  className = ''
}) {
  const { user } = useAuth();
  const ai = useCivicAIContext();
  const preset = presetFor(presetKey, context);

  if (!ai || !user) return null;

  const open = () => ai.openCopilot({ ...preset, title: title || preset.title });

  return (
    <Card className={className}>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-civic-500/10 text-civic-600 dark:text-civic-300"
          >
            ✦
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-fg">{title || preset.title}</h3>
            {subtitle && <p className="mt-0.5 text-[13px] text-fg-muted">{subtitle}</p>}
            {description && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{description}</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-fg-muted">
            <Spinner size={14} /> Loading your CivicSync data…
          </div>
        ) : (
          stats.length > 0 && (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <dt className="text-[11px] text-fg-muted">{stat.label}</dt>
                  <dd className="mt-0.5 text-[16px] font-semibold text-fg">{stat.value}</dd>
                </div>
              ))}
            </dl>
          )
        )}

        <Button onClick={open} iconRight="arrowRight">
          {actionLabel}
        </Button>
      </CardBody>
    </Card>
  );
}
