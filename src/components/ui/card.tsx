import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section
      className={cn("rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6", className)}>
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
