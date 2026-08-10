"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/icon";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => confirmRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActive?.focus();
    };
  }, [onCancel, open, pending]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#17242d]/35 px-5 py-6" role="presentation">
      <button type="button" aria-label="关闭对话框" className="absolute inset-0 cursor-default" onClick={pending ? undefined : onCancel} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-6 shadow-[0_22px_60px_rgba(23,36,45,0.24)]"
      >
        <div className="flex gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${danger ? "bg-[#fff2f1] text-[var(--danger)]" : "bg-[#fff8e8] text-[var(--warning)]"}`}>
            <MaterialIcon name={danger ? "warning" : "info"} size={22} filled />
          </span>
          <div>
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
            <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>返回</Button>
          <Button ref={confirmRef} type="button" variant={danger ? "danger" : "dark"} onClick={onConfirm} disabled={pending}>{pending ? <MaterialIcon name="progress_activity" size={18} className="animate-spin" /> : null}{confirmLabel}</Button>
        </div>
      </section>
    </div>
  );
}
