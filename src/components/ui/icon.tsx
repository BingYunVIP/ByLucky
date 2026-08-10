import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "./cn";

type MaterialIconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: string;
  size?: number;
  filled?: boolean;
  label?: string;
};

/** A single local icon surface for the entire product. */
export function MaterialIcon({
  name,
  size = 20,
  filled = false,
  label,
  className,
  style,
  ...props
}: MaterialIconProps) {
  const iconStyle: CSSProperties = {
    fontSize: size,
    width: size,
    height: size,
    lineHeight: 1,
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
    ...style,
  };

  return (
    <span
      {...props}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn("material-symbols-rounded inline-flex shrink-0 select-none items-center justify-center", className)}
      style={iconStyle}
    >
      {name}
    </span>
  );
}
