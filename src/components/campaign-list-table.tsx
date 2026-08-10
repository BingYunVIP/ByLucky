"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { campaignStatusLabel, campaignStatusTone, drawMethodLabel, drawTriggerLabel, formatAdminDate } from "@/components/admin/presentation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MaterialIcon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

type CampaignRow = {
  id: string;
  issue_no: number;
  name: string;
  status: string;
  target_unique_emails: number;
  draw_method: string;
  draw_trigger: string;
  draw_at: string | Date | null;
  created_at: string | Date;
  participant_count: number | string;
  used_code_count: number | string;
  total_face_value: number | string;
};

type Filter = "ALL" | "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED" | "FAILED";
type Confirmation = { id: string; path: "start" | "draw" | "cancel" | "delete"; title: string; description: string; confirmLabel: string; danger?: boolean };

const filters: Array<{ id: Filter; label: string }> = [
  { id: "ALL", label: "全部" },
  { id: "DRAFT", label: "草稿" },
  { id: "ACTIVE", label: "进行中" },
  { id: "COMPLETED", label: "已完成" },
  { id: "ARCHIVED", label: "已归档" },
  { id: "FAILED", label: "异常" },
];

function matchesFilter(status: string, filter: Filter) {
  if (filter === "ALL") return true;
  if (filter === "ACTIVE") return ["ACTIVE", "LOCKED", "DRAWING"].includes(status);
  if (filter === "ARCHIVED") return ["ARCHIVED", "CANCELED", "CANCELLED"].includes(status);
  if (filter === "FAILED") return status === "DRAW_FAILED";
  return status === filter;
}

export function CampaignListTable({ campaigns }: { campaigns: CampaignRow[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const filtered = useMemo(() => campaigns.filter((campaign) => matchesFilter(campaign.status, filter)), [campaigns, filter]);

  async function runConfirmation() {
    if (!confirmation) return;
    const current = confirmation;
    setConfirmation(null);
    setBusyId(current.id);
    try {
      const isDelete = current.path === "delete";
      const response = await fetch(isDelete ? `/api/admin/campaigns/${current.id}` : `/api/admin/campaigns/${current.id}/${current.path}`, { method: isDelete ? "DELETE" : "POST" });
      const payload = await response.json() as { ok: boolean; error?: { message: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "操作失败。" );
      showToast({ tone: "success", title: current.path === "delete" ? "草稿已删除" : current.path === "start" ? "活动已启动" : current.path === "draw" ? "开奖任务已提交" : "活动已取消", description: "页面正在刷新最新数据。" });
      router.refresh();
    } catch (error) {
      showToast({ tone: "error", title: "操作失败", description: error instanceof Error ? error.message : "请稍后重试。" });
    } finally {
      setBusyId(null);
    }
  }

  return <>
    <div className="mb-5 flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-white p-2 shadow-[var(--shadow-card)]" role="tablist" aria-label="活动状态筛选">
      {filters.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold transition ${filter === item.id ? "bg-[var(--text-primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"}`}><span>{item.label}</span>{item.id === "ARCHIVED" ? <span className="ml-1 inline-flex cursor-help" title="已归档：活动已经完成，且开奖后的未使用核实码清理工作已经结束。历史开奖结果仍会保留。" aria-label="已归档说明"><MaterialIcon name="info" size={15} /></span> : null}<span className="ml-1.5 text-xs opacity-70">{campaigns.filter((campaign) => matchesFilter(campaign.status, item.id)).length}</span></button>)}
    </div>
    {filtered.length ? <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]"><tr><th className="px-5 py-3.5 font-semibold sm:px-6">期号 / 活动</th><th className="px-5 py-3.5 font-semibold">状态</th><th className="px-5 py-3.5 font-semibold">参与进度</th><th className="px-5 py-3.5 font-semibold">已用兑换码</th><th className="px-5 py-3.5 font-semibold">累计面值</th><th className="hidden px-5 py-3.5 font-semibold 2xl:table-cell">开奖方式</th><th className="px-5 py-3.5 font-semibold">开奖条件</th><th className="px-5 py-3.5 font-semibold">创建时间</th><th className="px-5 py-3.5 text-right font-semibold sm:px-6">操作</th></tr></thead><tbody>{filtered.map((campaign) => <tr key={campaign.id} className="border-b border-[var(--border-subtle)] align-top last:border-b-0"><td className="px-5 py-4 sm:px-6"><p className="font-semibold text-[var(--text-primary)]">第 {campaign.issue_no} 期</p><p className="mt-1 max-w-[210px] truncate text-xs text-[var(--text-secondary)]" title={campaign.name}>{campaign.name}</p></td><td className="px-5 py-4"><Badge tone={campaignStatusTone(campaign.status)}>{campaignStatusLabel(campaign.status)}</Badge></td><td className="px-5 py-4 font-semibold text-[var(--text-primary)]">{Number(campaign.participant_count)} / {campaign.target_unique_emails}</td><td className="px-5 py-4 text-[var(--text-secondary)]">{Number(campaign.used_code_count)} 张</td><td className="px-5 py-4 text-[var(--text-secondary)]">{Number(campaign.total_face_value)} 元</td><td className="hidden px-5 py-4 text-xs text-[var(--text-secondary)] 2xl:table-cell">{drawMethodLabel(campaign.draw_method)}</td><td className="px-5 py-4 text-xs leading-5 text-[var(--text-secondary)]">{drawTriggerLabel(campaign.draw_trigger, campaign.draw_at)}</td><td className="px-5 py-4 whitespace-nowrap text-xs text-[var(--text-muted)]">{formatAdminDate(campaign.created_at)}</td><td className="px-5 py-4 sm:px-6"><div className="flex min-w-[120px] flex-wrap justify-end gap-2">{busyId === campaign.id ? <MaterialIcon name="progress_activity" size={20} className="animate-spin text-[var(--brand)]" /> : <CampaignRowActions campaign={campaign} request={setConfirmation} />}</div></td></tr>)}</tbody></table></div> : <EmptyState icon={filter === "ALL" ? "event_note" : "filter_alt_off"} title={filter === "ALL" ? "还没有创建活动" : "当前筛选下没有活动"} description={filter === "ALL" ? "创建第一期抽奖后，草稿、进行中和历史活动都会显示在这里。" : "可以切换筛选条件查看其他活动。"} action={filter === "ALL" ? <Link href="/admin/campaigns/new" className={buttonClassName("primary")}><MaterialIcon name="add_circle" size={19} />创建第一期活动</Link> : undefined} />}
    <ConfirmDialog open={confirmation !== null} title={confirmation?.title ?? "确认操作"} description={confirmation?.description ?? ""} confirmLabel={confirmation?.confirmLabel ?? "确认"} danger={confirmation?.danger} pending={busyId === confirmation?.id} onCancel={() => setConfirmation(null)} onConfirm={() => void runConfirmation()} />
  </>;
}

function CampaignRowActions({ campaign, request }: { campaign: CampaignRow; request: (value: Confirmation) => void }) {
  return <>
    <Link href={`/admin/campaigns/${campaign.id}`} className={buttonClassName("ghost", "sm")}>查看详情</Link>
    {campaign.status === "DRAFT" ? <Link href={`/admin/campaigns/${campaign.id}/edit`} className={buttonClassName("secondary", "sm")}>编辑草稿</Link> : null}
    {campaign.status === "DRAFT" ? <Button type="button" size="sm" onClick={() => request({ id: campaign.id, path: "start", title: "确认启动本期活动？", description: "启动后会开始接受真实用户参与。", confirmLabel: "确认启动" })}>启动活动</Button> : null}
    {campaign.status === "DRAFT" ? <Button type="button" variant="ghost" size="sm" className="text-[var(--danger)] hover:bg-[#fff2f1] hover:text-[var(--danger)]" onClick={() => request({ id: campaign.id, path: "delete", title: "确认删除这个草稿活动？", description: "已导入但未使用的核实码也会随草稿删除。", confirmLabel: "确认删除", danger: true })}>删除</Button> : null}
    {campaign.status === "ACTIVE" ? <Button type="button" variant="dark" size="sm" onClick={() => request({ id: campaign.id, path: "draw", title: "确认立即开奖？", description: `当前参与人数：${Number(campaign.participant_count)} / ${campaign.target_unique_emails}。开奖后不可重新随机。`, confirmLabel: "确认开奖", danger: true })}>立即开奖</Button> : null}
    {campaign.status === "ACTIVE" && Number(campaign.participant_count) === 0 ? <Button type="button" variant="ghost" size="sm" className="text-[var(--danger)] hover:bg-[#fff2f1] hover:text-[var(--danger)]" onClick={() => request({ id: campaign.id, path: "cancel", title: "确认取消本期活动？", description: "取消后用户将无法继续参与。", confirmLabel: "确认取消", danger: true })}>取消活动</Button> : null}
  </>;
}
