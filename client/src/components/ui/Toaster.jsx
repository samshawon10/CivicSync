import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Icon from './Icon.jsx';

const ToastContext = createContext(null);

const toneMap = {
  success: { icon: 'checkCircle', className: 'status-success' },
  error: { icon: 'alertCircle', className: 'status-danger' },
  warning: { icon: 'alertTriangle', className: 'status-warning' },
  info: { icon: 'info', className: 'status-info' }
};

/**
 * The single toast system for CivicSync. Nothing else in the product should
 * render its own transient notification UI.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []);

  const push = useCallback((tone, message, options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((items) => [...items.slice(-3), { id, tone, message, title: options.title, action: options.action }]);
    const timeout = options.duration ?? (tone === 'error' ? 8000 : 4500);
    if (timeout) window.setTimeout(() => dismiss(id), timeout);
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({
    toasts,
    dismiss,
    toast: push,
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, options),
    warning: (message, options) => push('warning', message, options),
    info: (message, options) => push('info', message, options)
  }), [toasts, dismiss, push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end" role="region" aria-label="Notifications">
        {toasts.map((item) => {
          const tone = toneMap[item.tone] || toneMap.info;
          return (
            <div key={item.id} className="toast-panel pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-xl" role="status" aria-live="polite">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone.className}`}>
                <Icon name={tone.icon} size={15} />
              </span>
              <div className="min-w-0 flex-1">
                {item.title && <p className="text-[13px] font-semibold text-fg">{item.title}</p>}
                <p className="text-[13px] text-fg-muted">{item.message}</p>
                {item.action ? (
                  <button type="button" onClick={() => { item.action.onClick?.(); dismiss(item.id); }} className="mt-1.5 text-[13px] font-semibold text-civic-600 hover:underline">
                    {item.action.label}
                  </button>
                ) : null}
              </div>
              <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification" className="text-fg-subtle transition hover:text-fg">
                <Icon name="close" size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context) return context;
  // Safe no-op fallback if a component renders outside the provider.
  const noop = () => {};
  return { toasts: [], dismiss: noop, toast: noop, success: noop, error: noop, warning: noop, info: noop };
}
