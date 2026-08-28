"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
  /** Optional second line, e.g. why a coupon was refused. */
  detail?: string;
};

type ToastApi = {
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
  info: (message: string, detail?: string) => void;
  dismiss: (id: number) => void;
};

const NOOP: ToastApi = {
  success: () => {},
  error: () => {},
  info: () => {},
  dismiss: () => {},
};

const ToastContext = createContext<ToastApi>(NOOP);

/**
 * Returns the toast API.
 *
 * Falls back to a no-op outside the provider so a component can announce
 * something without caring whether it happens to be rendered inside the
 * storefront shell, the dashboard, or a test.
 */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

/** How long each tone stays on screen. Errors linger — they are worth reading. */
const LIFETIME: Record<ToastTone, number> = {
  success: 4000,
  info: 5000,
  error: 8000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((tone: ToastTone, message: string, detail?: string) => {
    setToasts((current) => {
      // Repeating an identical message (a double click, a retried action)
      // should not stack up duplicates.
      if (current.some((toast) => toast.tone === tone && toast.message === message)) return current;
      return [...current, { id: nextId.current++, tone, message, detail }].slice(-4);
    });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, detail) => push("success", message, detail),
      error: (message, detail) => push("error", message, detail),
      info: (message, detail) => push("info", message, detail),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext>
  );
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), LIFETIME[toast.tone]);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.tone, onDismiss]);

  return (
    <div
      className={`toast toast-${toast.tone}`}
      // Errors interrupt; the rest wait for a pause in what the reader is doing.
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
    >
      <span className="toast-icon" aria-hidden="true">
        {toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}
      </span>
      <div className="toast-body">
        <p className="toast-message">{toast.message}</p>
        {toast.detail ? <p className="toast-detail">{toast.detail}</p> : null}
      </div>
      <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
