import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-8">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-[var(--brand)]">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold leading-tight text-[var(--text-primary)] sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
