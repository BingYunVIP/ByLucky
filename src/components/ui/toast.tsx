"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MaterialIcon } from "./icon";

type ToastTone = "success" | "error" | "info" | "warning";
type ToastInput = { title: string; description?: string; tone?: ToastTone };
type Toast = ToastInput & { id: number; tone: ToastTone };
type ToastContextValue = { showToast: (toast: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, { color: string; iconName: string }> = {
  success: { color: "bg-[var(--toast-success-bg)] text-[var(--success)] border-[var(--toast-success-border)]", iconName: "check_circle" },
  error: { color: "bg-[var(--toast-error-bg)] text-[var(--danger)] border-[var(--toast-error-border)]", iconName: "error" },
  info: { color: "bg-[var(--toast-info-bg)] text-[var(--info)] border-[var(--toast-info-border)]", iconName: "info" },
  warning: { color: "bg-[var(--toast-warning-bg)] text-[var(--warning)] border-[var(--toast-warning-border)]", iconName: "warning" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = nextToastId.current;
    nextToastId.current += 1;
    const toast: Toast = { ...input, id, tone: input.tone ?? "info" };
    setToasts((current) => [...current.slice(-3), toast]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) => window.setTimeout(() => dismiss(toast.id), 4800));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dismiss, toasts]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex max-w-md flex-col gap-3 sm:left-auto sm:right-5" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const tone = toneStyles[toast.tone];
          return (
            <div key={toast.id} className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-[0_16px_42px_rgba(30,48,61,0.16)] ${tone.color}`} role="status">
              <MaterialIcon name={tone.iconName} size={20} filled />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-xs leading-5 opacity-85">{toast.description}</p> : null}
              </div>
              <button type="button" aria-label="关闭提示" className="grid size-7 place-items-center rounded-md opacity-70 transition hover:bg-black/5 hover:opacity-100" onClick={() => dismiss(toast.id)}>
                <MaterialIcon name="close" size={17} />
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
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
