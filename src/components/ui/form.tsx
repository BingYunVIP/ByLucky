import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export const fieldClassName = "h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] hover:border-[var(--text-muted)] focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(199,57,50,0.10)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-muted)]";
export const textareaClassName = "min-h-28 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-6 text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] hover:border-[var(--text-muted)] focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(199,57,50,0.10)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-muted)]";

export function Field({
  label,
  required,
  help,
  error,
  children,
  className,
}: {
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
        {label}{required ? <span className="ml-1 text-[var(--brand)]" aria-hidden="true">*</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1.5 block text-xs leading-5 text-[var(--danger)]">{error}</span> : null}
      {!error && help ? <span className="mt-1.5 block text-xs leading-5 text-[var(--text-muted)]">{help}</span> : null}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldClassName, className)} {...props} />;
});

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClassName, className)} {...props} />;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(textareaClassName, className)} {...props} />;
});

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[var(--border-subtle)] px-4 py-3.5 transition hover:bg-[var(--surface-subtle)]">
      <span>
        <span className="block text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        {description ? <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="switch-input"
        aria-label={label}
      />
    </label>
  );
}
