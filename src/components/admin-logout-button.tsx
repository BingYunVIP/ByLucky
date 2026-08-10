"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/icon";
import { cn } from "@/components/ui/cn";

export function AdminLogoutButton({ compact = true }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:opacity-50",
        compact && "size-10 p-0",
      )}
      type="button"
      onClick={logout}
      disabled={pending}
      aria-label="退出登录"
      title="退出登录"
    >
      <MaterialIcon name={pending ? "progress_activity" : "logout"} size={20} className={pending ? "animate-spin" : ""} />
      {!compact ? <span>退出登录</span> : null}
    </button>
  );
}
