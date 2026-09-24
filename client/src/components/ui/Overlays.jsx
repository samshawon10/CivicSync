import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { confirmAction } from '../../utils/sweetAlert.js';
import { Button } from './primitives.jsx';
import { cx } from '../../utils/format.js';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function useOverlay(open, onClose) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const node = panelRef.current;
    (node?.querySelector(FOCUSABLE) || node)?.focus?.();
    function onKeyDown(event) {
      if (event.key === 'Escape') { event.stopPropagation(); onClose?.(); return; }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter((element) => element.offsetParent !== null);
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);
  return panelRef;
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  const panelRef = useOverlay(open, onClose);
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 py-10 sm:items-center" role="presentation">
      <button type="button" aria-label="Close dialog" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx('modal-panel relative w-full rounded-2xl border border-line bg-surface shadow-2xl', widths[size] || widths.md)}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="civic-section-title">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-fg-muted">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" icon="close" onClick={onClose} aria-label="Close dialog" />
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'sm:max-w-xl' }) {
  const panelRef = useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45" role="presentation">
      <button type="button" aria-label="Close panel" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default" />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx('drawer-panel relative flex h-full w-full flex-col border-l border-line bg-surface shadow-2xl', width)}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="civic-section-title truncate">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-fg-muted">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" icon="close" onClick={onClose} aria-label="Close panel" />
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</footer>}
      </aside>
    </div>
  );
}

/**
 * Destructive-action confirmation. `requireText` forces an explicit typed
 * confirmation for the most sensitive operations.
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = true, requireText = '' }) {
  const callbacks = useRef({ onConfirm, onClose });
  callbacks.current = { onConfirm, onClose };
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    confirmAction({ title, text: message, confirmLabel, danger, requireText }).then((confirmed) => {
      if (!active) return;
      if (confirmed) { callbacks.current.onConfirm?.(); callbacks.current.onClose?.(); }
      else callbacks.current.onClose?.();
    });
    return () => { active = false; };
  }, [open, title, message, confirmLabel, danger, requireText]);
  return null;
}

export function DropdownMenu({ label, icon, items = [], align = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) { if (!wrapper.current?.contains(event.target)) close(); }
    function onKey(event) { if (event.key === 'Escape') close(); }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open, close]);
  return (
    <div ref={wrapper} className={cx('relative', className)}>
      <Button size="sm" icon={icon} iconRight="chevronDown" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{label}</Button>
      {open && (
        <div role="menu" className={cx('menu-panel absolute z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl', align === 'right' ? 'right-0' : 'left-0')}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { close(); item.onSelect?.(); }}
              className={cx('flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition', item.danger ? 'text-red-600 hover:bg-red-50' : 'text-fg hover:bg-surface-2')}
            >
              {item.icon ? <Icon name={item.icon} size={15} /> : null}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

