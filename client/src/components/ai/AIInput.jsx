/**
 * CivicSync Intelligence — composer.
 *
 * Enter submits, Shift+Enter inserts a newline, and the textarea grows with
 * content up to a cap so it never pushes the message list off screen.
 */
import { useEffect, useRef } from 'react';
import { Button } from '../ui/primitives.jsx';
import { cx } from '../../utils/format.js';

const MAX_ROWS_PX = 120;

export default function AIInput({ value, onChange, onSubmit, disabled, busy, placeholder = 'Ask CivicSync anything...', flush = false }) {
  const ref = useRef(null);

  // Keep focus in the composer after a message is sent, and on open.
  useEffect(() => {
    if (!busy) ref.current?.focus?.();
  }, [busy]);

  function autoGrow(event) {
    const node = event.target;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, MAX_ROWS_PX)}px`;
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && !busy && value.trim()) onSubmit?.(value.trim());
    }
  }

  return (
    <div className={cx('bg-surface px-3 pb-3 pt-2.5 sm:px-4', flush ? '' : 'border-t border-line')}>
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2 px-3 py-2 transition focus-within:border-civic-400 focus-within:ring-2 focus-within:ring-civic-500/15">
        <label htmlFor="civic-ai-input" className="sr-only">
          Ask CivicSync Intelligence
        </label>
        <textarea
          id="civic-ai-input"
          ref={ref}
          rows={1}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          onInput={autoGrow}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={6000}
          className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[14px] leading-relaxed text-fg outline-none placeholder:text-fg-muted"
        />
        <Button
          size="icon"
          onClick={() => onSubmit?.(value.trim())}
          disabled={disabled || busy || !value.trim()}
          aria-label="Send message"
        >
          ➤
        </Button>
      </div>
      <p className="mt-1.5 px-1 text-[10.5px] text-fg-muted">
        Answers are grounded in CivicSync records you are authorized to view.
      </p>
    </div>
  );
}
