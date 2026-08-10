import type { Metadata } from "next";
import Link from "next/link";
import { OperationLogsTable, type OperationLogRecord } from "@/components/operation-logs-table";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MaterialIcon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { getOperationLogsData, type OperationLogCategory } from "@/server/services/admin-data";

const categories: Array<{ id: OperationLogCategory; label: string }> = [
  { id: "ALL", label: "全部" },
  { id: "AUTH", label: "登录与安全" },
  { id: "CAMPAIGN", label: "活动" },
  { id: "DRAW", label: "开奖" },
  { id: "CODES", label: "兑换码" },
  { id: "EMAIL", label: "邮件" },
  { id: "SETTINGS", label: "系统设置" },
  { id: "BACKGROUND", label: "后台任务" },
];

export const metadata: Metadata = { title: { absolute: "运维记录 - 冰云抽奖" } };

export default async function OperationLogsPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; category?: string }> }) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const search = params.search ?? "";
  const data = await getOperationLogsData(Number.isFinite(page) ? page : 1, search, params.category);
  const logs: OperationLogRecord[] = data.items.map((entry) => ({ id: String(entry.id), createdAt: new Date(entry.created_at as string | Date).toISOString(), actorType: String(entry.actor_type), action: String(entry.action), entityType: entry.entity_type ? String(entry.entity_type) : null, entityId: entry.entity_id ? String(entry.entity_id) : null, metadata: entry.metadata }));
  const buildHref = (category: OperationLogCategory, targetPage?: number) => `/admin/logs?category=${category}&search=${encodeURIComponent(search)}${targetPage ? `&page=${targetPage}` : ""}`;
  return <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-9 lg:py-9"><PageHeader title="运维记录" /><nav className="mb-4 flex gap-2 overflow-x-auto" aria-label="运维记录分类">{categories.map((item) => <Link key={item.id} href={buildHref(item.id)} aria-current={data.category === item.id ? "page" : undefined} className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-sm font-semibold transition ${data.category === item.id ? "bg-[var(--text-primary)] text-white" : "border border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"}`}>{item.label}</Link>)}</nav><form action="/admin/logs" className="mb-5 flex max-w-xl gap-2"><input type="hidden" name="category" value={data.category} /><label className="relative min-w-0 flex-1"><span className="sr-only">搜索操作或资源类型</span><MaterialIcon name="search" size={19} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input name="search" defaultValue={search} className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(199,57,50,0.10)]" placeholder="搜索操作或资源类型" /></label><button className={buttonClassName("dark")}>搜索</button></form>{logs.length ? <OperationLogsTable logs={logs} /> : <EmptyState icon="history" title="当前筛选条件下没有运维记录" />}<div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-[var(--text-muted)]">第 {data.page} 页，共 {data.total} 条</span><div className="flex gap-2">{data.page > 1 ? <Link href={buildHref(data.category, data.page - 1)} className={buttonClassName("secondary", "sm")}><MaterialIcon name="arrow_back" size={18} />上一页</Link> : null}{data.page * data.pageSize < data.total ? <Link href={buildHref(data.category, data.page + 1)} className={buttonClassName("secondary", "sm")}>下一页<MaterialIcon name="arrow_forward" size={18} /></Link> : null}</div></div></main>;
}
