import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export const buttonStyles: Record<ButtonVariant, string> = {
  primary: "border border-transparent bg-[var(--brand)] text-white shadow-[0_1px_2px_rgba(180,45,53,0.24)] hover:bg-[var(--brand-hover)]",
  secondary: "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-primary)] hover:border-[var(--brand)] hover:text-[var(--brand)]",
  ghost: "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]",
  danger: "border border-transparent bg-[var(--danger)] text-white shadow-[0_1px_2px_rgba(182,49,42,0.24)] hover:bg-[#a82620]",
  dark: "border border-transparent bg-[var(--text-primary)] text-white hover:bg-[#22333e]",
};

export const buttonSizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-lg px-4 text-sm",
  lg: "h-11 gap-2 rounded-lg px-5 text-sm",
  icon: "size-10 rounded-lg p-0",
};

export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap font-semibold transition duration-150 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    buttonStyles[variant],
    buttonSizeStyles[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}>(function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}, ref) {
  return (
    <button ref={ref} className={buttonClassName(variant, size, className)} {...props}>
      {children}
    </button>
  );
});
