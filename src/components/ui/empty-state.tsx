import type { ReactNode } from "react";
import { MaterialIcon } from "./icon";

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid min-h-64 place-items-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-10 text-center ${className ?? ""}`}>
      <div className="max-w-md">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-[var(--ice)] text-[var(--info)]">
          <MaterialIcon name={icon} size={25} />
        </span>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p> : null}
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
