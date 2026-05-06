'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastInput {
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. Default 4000. */
  duration?: number;
}

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

// Beyond this size the oldest entries are dropped to keep the stack readable.
const MAX_TOASTS = 5;

interface ToastContextValue {
  show: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be called within <ToastProvider>');
  return ctx;
}

const variantStyles: Record<ToastVariant, { ring: string; accent: string }> = {
  success: { ring: 'border-accent-mint/40 shadow-glow-mint', accent: 'bg-accent-mint' },
  error: { ring: 'border-warn-coral/40 shadow-glow-coral', accent: 'bg-warn-coral' },
  info: { ring: 'border-accent-cyan/40 shadow-glow-cyan', accent: 'bg-accent-cyan' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => {
      const next = prev.filter((t) => t.id !== id);
      // Same reference when nothing matched — keeps consumers from re-rendering.
      return next.length === prev.length ? prev : next;
    });
  }, []);

  const show = useCallback(({ message, variant = 'info', duration = 4000 }: ToastInput) => {
    idCounter.current += 1;
    const id = `t${idCounter.current}`;
    setToasts((prev) => {
      const next = [...prev, { id, message, variant, duration }];
      return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
    });
    return id;
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-6 sm:items-end"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { ring, accent } = variantStyles[toast.variant];

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="status"
      className={`glass-strong pointer-events-auto relative w-full max-w-sm overflow-hidden border ${ring} animate-fade-up px-5 py-4 motion-reduce:animate-none`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${accent}`} />
        <p className="font-sans text-sm text-white/90">{toast.message}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
          className="-my-1 -mr-1 ml-auto rounded p-1 text-white/40 transition-colors duration-300 ease-premium hover:text-white"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/10">
        <div
          className={`h-full origin-left ${accent} motion-reduce:hidden`}
          style={{ animation: `toast-progress ${toast.duration}ms linear forwards` }}
        />
      </div>
    </div>
  );
}
