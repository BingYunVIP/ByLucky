"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/components/ui/cn";
import { MaterialIcon } from "@/components/ui/icon";

type NavItem = { href: string; label: string; icon: string; dividerBefore?: boolean };

const navigation: NavItem[] = [
  { href: "/admin", label: "管理总览", icon: "dashboard" },
  { href: "/admin/campaigns", label: "活动列表", icon: "event_note", dividerBefore: true },
  { href: "/admin/campaigns/new", label: "创建活动", icon: "add_circle" },
  { href: "/admin/winners", label: "获奖记录", icon: "emoji_events", dividerBefore: true },
  { href: "/admin/email", label: "邮件配置", icon: "mail", dividerBefore: true },
  { href: "/admin/settings", label: "系统设置", icon: "settings", dividerBefore: true },
  { href: "/admin/logs", label: "运维记录", icon: "history" },
];

function isCurrent(pathname: string, href: string) {
  if (pathname === "/admin/campaigns/new") return href === "/admin/campaigns/new";
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/settings") return pathname === "/admin/settings";
  if (href === "/admin/campaigns/new") return pathname === "/admin/campaigns/new";
  if (href === "/admin/campaigns") return pathname === "/admin/campaigns" || /^\/admin\/campaigns\/[^/]+(?:\/edit)?$/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <nav className="space-y-1 px-3 py-5" aria-label="后台导航">
    {navigation.map((item) => {
      const current = isCurrent(pathname, item.href);
      return <div key={item.href} className={item.dividerBefore ? "mt-3 border-t border-[var(--border-subtle)] pt-3" : ""}>
        <Link href={item.href} onClick={onNavigate} aria-current={current ? "page" : undefined} className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition", current ? "bg-[#fff0ef] text-[var(--brand)] shadow-[inset_0_0_0_1px_rgba(199,57,50,0.10)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]")}>
          <MaterialIcon name={item.icon} size={20} filled={current} />
          <span>{item.label}</span>
        </Link>
      </div>;
    })}
  </nav>;
}

function SidebarFooter() {
  return <div className="border-t border-[var(--border-subtle)] p-4"><div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-subtle)] px-3 py-3"><div className="min-w-0"><p className="truncate text-xs text-[var(--text-muted)]">当前账号</p><p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">系统管理员</p></div><AdminLogoutButton /></div></div>;
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false);

  return <>
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex"><div className="flex h-[76px] items-center border-b border-[var(--border-subtle)] px-5"><BrandMark /></div><div className="min-h-0 flex-1 overflow-y-auto"><NavigationContent /></div><SidebarFooter /></aside>
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur lg:hidden"><BrandMark compact /><button type="button" className="grid size-10 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]" aria-label="打开后台导航" aria-expanded={open} onClick={() => setOpen(true)}><MaterialIcon name="menu" size={22} /></button></header>
    {open ? <div className="fixed inset-0 z-50 lg:hidden" role="presentation"><button type="button" className="absolute inset-0 bg-[#17242d]/30" aria-label="关闭后台导航" onClick={() => setOpen(false)} /><aside className="relative flex h-full w-[284px] max-w-[88vw] flex-col bg-[var(--surface)] shadow-[18px_0_42px_rgba(23,36,45,0.18)]" role="dialog" aria-modal="true" aria-label="后台导航"><div className="flex h-[76px] items-center justify-between border-b border-[var(--border-subtle)] px-5"><BrandMark /><button type="button" className="grid size-10 place-items-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]" aria-label="关闭后台导航" onClick={() => setOpen(false)}><MaterialIcon name="close" size={21} /></button></div><div className="min-h-0 flex-1 overflow-y-auto"><NavigationContent onNavigate={() => setOpen(false)} /></div><SidebarFooter /></aside></div> : null}
  </>;
}
