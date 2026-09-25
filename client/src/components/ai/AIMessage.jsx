/**
 * CivicSync Intelligence — message rendering.
 *
 * Renders the gateway's validated response contract (server/ai/security/
 * outputValidator.js). Because the backend has already stripped model output
 * into a closed type set and intersected citations with authorized records, this
 * component can render defensively without re-implementing any validation.
 */
import { Button } from '../ui/primitives.jsx';
import { cx } from '../../utils/format.js';
import { AISourceBadge, AIToolExecution, AIActionCard } from './AIBlocks.jsx';

const BULLET = /^\s*[-•]\s+/;

/**
 * Renders assistant prose into paragraphs and bullets. The backend strips code
 * fences, so a simple line split is sufficient and avoids pulling in a markdown
 * dependency (and any XSS surface that comes with one).
 */
function Prose({ text }) {
  const lines = String(text || '').split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        if (!line.trim()) return null;
        if (BULLET.test(line)) {
          return (
            <div key={index} className="flex gap-2">
              <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-civic-400" />
              <span className="min-w-0 flex-1">{line.replace(BULLET, '')}</span>
            </div>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap break-words leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function UserMessage({ text }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-civic-600 px-3.5 py-2.5 text-[14px] leading-relaxed text-white shadow-sm">
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({ response, toolSteps, onNavigate, onPrompt, onConfirm, onReject, actionBusy }) {
  const citations = response?.citations || [];
  const verified = response?.grounding?.verified !== false && !response?.degraded;
  const suggestions = response?.suggestedActions || [];

  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-civic-500/10 text-sm text-civic-600 dark:text-civic-300"
      >
        ✦
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[12px] font-semibold text-fg">CivicSync Intelligence</p>

        {toolSteps?.length > 0 && <AIToolExecution steps={toolSteps} done />}

        <div className="rounded-2xl rounded-tl-md border border-line bg-surface-2 px-3.5 py-3 text-[14px] text-fg">
          <Prose text={response?.message} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AISourceBadge verified={verified} count={citations.length} />

          {response?.degraded && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              Reduced-detail mode
            </span>
          )}
        </div>

        {citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {citations.map((citation) => (
              <button
                key={`${citation.type}-${citation.id}`}
                type="button"
                disabled={!citation.path}
                onClick={() => citation.path && onNavigate?.(citation.path)}
                className={cx(
                  'rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-fg-muted transition',
                  citation.path ? 'hover:border-civic-400 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic-500' : 'cursor-default'
                )}
              >
                {citation.path ? '↗ ' : ''}
                {citation.label}
              </button>
            ))}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {suggestions.map((item, index) => {
              const label = item?.label || '';
              if (!label) return null;
              return (
                <Button
                  key={`${label}-${index}`}
                  size="sm"
                  variant="outline"
                  onClick={() => (item.prompt ? onPrompt?.(item.prompt) : onConfirm?.(item))}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        )}

        {response?.action?.token && (
          <AIActionCard
            action={response.action}
            busy={actionBusy}
            onConfirm={onConfirm}
            onReject={onReject}
          />
        )}
      </div>
    </div>
  );
}

export default function AIMessage(props) {
  if (props.role === 'user') return <UserMessage text={props.text} />;
  return <AssistantMessage {...props} />;
}
