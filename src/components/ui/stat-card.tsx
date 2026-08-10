import type { ReactNode } from "react";
import { cn } from "./cn";
import { MaterialIcon } from "./icon";

export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "ice",
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: string;
  tone?: "ice" | "brand" | "success" | "warning" | "neutral";
  className?: string;
}) {
  const tones = {
    ice: "bg-[#edf6fb] text-[#28617f]",
    brand: "bg-[#fff1f0] text-[var(--brand)]",
    success: "bg-[#effaf3] text-[#24734d]",
    warning: "bg-[#fff8e8] text-[#946017]",
    neutral: "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  };
  return (
    <article className={cn("min-h-36 rounded-xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)]", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-[var(--text-primary)]">{value}</p>
        </div>
        {icon ? <span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}><MaterialIcon name={icon} size={21} /></span> : null}
      </div>
      {detail ? <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">{detail}</p> : null}
    </article>
  );
}
