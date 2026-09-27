import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { confirmAction } from '../../utils/sweetAlert.js';
import { Button } from './primitives.jsx';
import { cx } from '../../utils/format.js';

const FORM_CONTROL = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';
const FOCUSABLE = `a[href], button:not([disabled]), ${FORM_CONTROL}, [tabindex]:not([tabindex="-1"])`;
/** Above the admin shell (z-40/z-50) and the command palette (z-60), below toasts (z-70). */
const OVERLAY_Z = 'z-[65]';

function useOverlay(open, onClose) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const node = panelRef.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog once, after the panel has painted.
    const initialFocus = node?.querySelector('[data-autofocus]')
      || node?.querySelector(FORM_CONTROL)
      || node?.querySelector(FOCUSABLE)
      || node;
    const frame = window.requestAnimationFrame(() => initialFocus?.focus?.());

    function onKeyDown(event) {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current?.(); return; }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter((element) => element.offsetParent !== null);
      if (!items.length) { event.preventDefault(); node.focus?.(); return; }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === node)) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      // Return focus to whatever opened the dialog.
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [open]);

  return panelRef;
}

export function ModalHeader({ icon, title, subtitle, onClose }) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-civic-500 to-civic-700 text-white shadow-lg">
            <Icon name={icon} size={22} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className={cx('truncate', icon ? 'text-lg font-bold text-fg' : 'civic-section-title')}>{title}</h2>
          {subtitle && <p className={cx('text-[13px]', icon ? 'text-fg-subtle' : 'mt-0.5 text-fg-muted')}>{subtitle}</p>}
        </div>
      </div>
      <Button variant="ghost" size="icon" icon="close" onClick={onClose} aria-label="Close dialog" />
    </header>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', icon }) {
  const panelRef = useOverlay(open, onClose);
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

  return createPortal(
    <div className={cx('fixed inset-0 flex items-end justify-center bg-slate-950/55 backdrop-blur-[2px] sm:items-center sm:p-4', OVERLAY_Z)} role="presentation">
      <button type="button" aria-label="Close dialog" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'modal-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-2xl sm:pb-0',
          widths[size] || widths.md
        )}
      >
        <ModalHeader icon={icon} title={title} subtitle={subtitle} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-5 py-3.5">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'sm:max-w-xl' }) {
  const panelRef = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className={cx('fixed inset-0 flex justify-end bg-slate-950/55 backdrop-blur-[2px]', OVERLAY_Z)} role="presentation">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}

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

