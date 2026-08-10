import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const tones: Record<BadgeTone, string> = {
  neutral: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  info: "border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--info)]",
  success: "border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--success)]",
  warning: "border-[var(--badge-warning-border)] bg-[var(--badge-warning-bg)] text-[var(--warning)]",
  danger: "border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--danger)]",
  brand: "border-[var(--badge-brand-border)] bg-[var(--badge-brand-bg)] text-[var(--brand)]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn("inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none", tones[tone], className)}
      {...props}
    >
      {children}
    </span>
  );
}
