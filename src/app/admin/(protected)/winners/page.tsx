import type { Metadata } from "next";
import Link from "next/link";
import { AdminWinnersTable, type WinnerRecord } from "@/components/admin-winners-table";
import { emailStatusLabel } from "@/components/admin/presentation";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MaterialIcon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { getAdminWinnersData } from "@/server/services/admin-data";

export const metadata: Metadata = { title: { absolute: "获奖记录 - 冰云抽奖" } };

export default async function AdminWinnersPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; issue?: string; emailStatus?: string }> }) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const search = params.search ?? "";
  const issue = Number(params.issue ?? "");
  const emailStatus = params.emailStatus ?? "";
  const data = await getAdminWinnersData(Number.isFinite(page) ? page : 1, search, Number.isFinite(issue) ? issue : undefined, emailStatus || undefined);
  const items: WinnerRecord[] = data.items.map((winner: Record<string, unknown>) => ({
    id: String(winner.id),
    issueNo: Number(winner.issue_no),
    campaignName: String(winner.campaign_name),
    email: String(winner.original_email_snapshot),
    prizeName: String(winner.prize_name),
    publicDescription: String(winner.public_description),
    prizeContent: winner.prize_content ? String(winner.prize_content) : null,
    codeCount: Number(winner.code_count_snapshot),
    totalFaceValue: Number(winner.total_face_value_snapshot),
    wonAt: new Date(winner.won_at as string | Date).toISOString(),
    emailStatus: String(winner.email_status),
    emailJobId: winner.email_job_id ? String(winner.email_job_id) : null,
  }));
  const query = `search=${encodeURIComponent(search)}&issue=${Number.isFinite(issue) && issue > 0 ? issue : ""}&emailStatus=${encodeURIComponent(emailStatus)}`;
  return <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-9 lg:py-9"><PageHeader title="获奖记录" /><form action="/admin/winners" className="mb-5 grid gap-3 rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,1fr)_150px_160px_auto]"><label className="relative min-w-0"><span className="sr-only">搜索邮箱或活动</span><MaterialIcon name="search" size={19} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input name="search" defaultValue={search} className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(199,57,50,0.10)]" placeholder="搜索邮箱或活动" /></label><label><span className="sr-only">期号</span><input name="issue" type="number" min="1" defaultValue={Number.isFinite(issue) && issue > 0 ? issue : undefined} className="h-10 w-full rounded-lg border border-[var(--border-strong)] px-3 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(199,57,50,0.10)]" placeholder="期号" /></label><label><span className="sr-only">邮件状态</span><select name="emailStatus" defaultValue={emailStatus} className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(199,57,50,0.10)]"><option value="">全部邮件状态</option>{["PENDING", "SENDING", "SENT", "FAILED", "NOT_CREATED"].map((status) => <option key={status} value={status}>{emailStatusLabel(status)}</option>)}</select></label><button className={buttonClassName("dark")}>筛选记录</button></form>{items.length ? <AdminWinnersTable winners={items} /> : <EmptyState icon="emoji_events" title="暂无获奖记录" description="完成一次开奖后，真实中奖记录会显示在这里。" />}<Pagination page={data.page} pageSize={data.pageSize} total={data.total} query={query} /></main>;
}

function Pagination({ page, pageSize, total, query }: { page: number; pageSize: number; total: number; query: string }) { const base = `/admin/winners?${query}&page=`; return <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-[var(--text-muted)]">第 {page} 页，共 {total} 条</span><div className="flex gap-2">{page > 1 ? <Link href={`${base}${page - 1}`} className={buttonClassName("secondary", "sm")}><MaterialIcon name="arrow_back" size={18} />上一页</Link> : null}{page * pageSize < total ? <Link href={`${base}${page + 1}`} className={buttonClassName("secondary", "sm")}>下一页<MaterialIcon name="arrow_forward" size={18} /></Link> : null}</div></div>; }
