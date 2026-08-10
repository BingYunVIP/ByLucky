import Image from "next/image";

type BrandMarkProps = {
  compact?: boolean;
  label?: string;
  subtitle?: string;
};

export function BrandMark({ compact = false, label = "冰云抽奖", subtitle }: BrandMarkProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
        <Image src="/brand/logo.png" width={44} height={44} alt="" className="size-10 object-contain" priority />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-5 text-[var(--text-primary)]" style={{ fontWeight: 600 }}>{label}</span>
        {!compact && subtitle ? <span className="block truncate text-xs leading-4 text-[var(--text-secondary)]">{subtitle}</span> : null}
      </span>
    </div>
  );
}
