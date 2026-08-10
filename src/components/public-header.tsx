"use client";

import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { usePublicPreferences } from "@/components/public-preferences";
import { MaterialIcon } from "@/components/ui/icon";

export function PublicHeader() {
  const { locale, setLocale, theme, setTheme, copy } = usePublicPreferences();
  const nextLocale = locale === "zh" ? "en" : "zh";
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex min-h-[72px] max-w-[1480px] flex-wrap items-center gap-3 px-5 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4 sm:px-7 lg:px-8">
        <Link href="/" aria-label={copy.brand} className="inline-flex h-10 min-w-0 items-center rounded-lg px-1 font-semibold focus-visible:outline-none" style={{ fontWeight: 600 }}>
          <BrandMark label={copy.brand} />
        </Link>

        <nav className="order-3 flex h-10 min-w-0 basis-full items-center justify-center gap-1 overflow-x-auto sm:order-none sm:basis-auto sm:gap-2" aria-label={copy.brand}>
          <a href="https://api.bingyun.vip" target="_blank" rel="noopener noreferrer" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]">
            <Image src="/brand/chatgpt_logo.svg" width={20} height={20} alt="" className="size-5" />
            <span>{copy.bingyunAi}</span>
          </a>
          <a href="https://shop.bingyun.vip" target="_blank" rel="noopener noreferrer" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]">
            <MaterialIcon name="storefront" size={20} />
            <span>{copy.bingyunStore}</span>
          </a>
          <a href="https://docs.bingyun.vip" target="_blank" rel="noopener noreferrer" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]">
            <MaterialIcon name="description" size={20} />
            <span>{copy.bingyunDocs}</span>
          </a>
        </nav>

        <div className="flex h-10 items-center justify-end gap-2">
          <button type="button" className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]" style={{ fontWeight: 600 }} aria-label={nextLocale === "en" ? copy.switchToEnglish : copy.switchToChinese} onClick={() => setLocale(nextLocale)}>
            {nextLocale === "en" ? "EN" : "中文"}
          </button>
          <button type="button" className="grid size-10 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]" aria-label={nextTheme === "dark" ? copy.switchToDark : copy.switchToLight} title={nextTheme === "dark" ? copy.switchToDark : copy.switchToLight} onClick={() => setTheme(nextTheme)}>
            <MaterialIcon name={theme === "light" ? "dark_mode" : "light_mode"} size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
