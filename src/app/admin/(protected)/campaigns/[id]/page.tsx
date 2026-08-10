import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { actorLabel, campaignStatusLabel, campaignStatusTone, drawMethodLabel, drawTriggerLabel, formatAdminDate, operationPresentation, operationSummary } from "@/components/admin/presentation";
import { CampaignActions } from "@/components/campaign-actions";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MaterialIcon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getCampaignDetailData } from "@/server/services/admin-data";
import { isBusinessError } from "@/server/services/errors";

export const metadata: Metadata = { title: { absolute: "活动详情 - 冰云抽奖" } };

type DetailTab = "overview" | "participants" | "codes" | "prizes" | "records";
const tabs: Array<{ id: DetailTab; label: string; icon: string }> = [
  { id: "overview", label: "概览", icon: "dashboard" },
  { id: "participants", label: "参与者", icon: "groups" },
  { id: "codes", label: "兑换码", icon: "confirmation_number" },
  { id: "prizes", label: "奖项", icon: "emoji_events" },
  { id: "records", label: "开奖与记录", icon: "history" },
];

function validTab(value: string | undefined): DetailTab {
  return tabs.some((item) => item.id === value) ? value as DetailTab : "overview";
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; search?: string; tab?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const page = Number(query.page ?? "1");
  const search = query.search ?? "";
  const tab = validTab(query.tab);
  let detail;
  try {
    detail = await getCampaignDetailData(id, Number.isFinite(page) ? page : 1, search);
  } catch (error) {
    if (isBusinessError(error) && error.code === "CAMPAIGN_NOT_FOUND") notFound();
    throw error;
  }

  const { campaign, stats } = detail;
  const tabHref = (next: DetailTab) => `/admin/campaigns/${campaign.id}?tab=${next}${next === "participants" && search ? `&search=${encodeURIComponent(search)}` : ""}`;

  return <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
    <PageHeader
      eyebrow={`第 ${campaign.issue_no} 期`}
      title={campaign.name}
      actions={<><>{campaign.status === "DRAFT" ? <Link href={`/admin/campaigns/${campaign.id}/edit`} className={buttonClassName("secondary")}><MaterialIcon name="edit" size={19} />编辑草稿</Link> : null}</><CampaignActions campaignId={campaign.id} status={campaign.status} participantCount={stats.participantCount} prizeCount={stats.prizeItemCount} /></>}
    >
      <Badge tone={campaignStatusTone(campaign.status)} className="mt-3">{campaignStatusLabel(campaign.status)}</Badge>
    </PageHeader>
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-white p-2 shadow-[var(--shadow-card)]" aria-label="活动详情标签页">
      {tabs.map((item) => <Link key={item.id} href={tabHref(item.id)} aria-current={tab === item.id ? "page" : undefined} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${tab === item.id ? "bg-[var(--text-primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"}`}><MaterialIcon name={item.icon} size={19} filled={tab === item.id} />{item.label}</Link>)}
    </nav>
    {tab === "overview" ? <Overview campaign={campaign} stats={stats} /> : null}
    {tab === "participants" ? <Participants detail={detail} campaignId={campaign.id} search={search} /> : null}
    {tab === "codes" ? <Codes stats={stats} /> : null}
    {tab === "prizes" ? <Prizes tiers={detail.prizeTiers} prizeCount={stats.prizeItemCount} /> : null}
    {tab === "records" ? <Records detail={detail} /> : null}
  </main>;
}

function Overview({ campaign, stats }: { campaign: Awaited<ReturnType<typeof getCampaignDetailData>>["campaign"]; stats: Awaited<ReturnType<typeof getCampaignDetailData>>["stats"] }) {
  const percent = Math.min(100, Math.round((stats.participantCount / campaign.target_unique_emails) * 100));
  const remaining = Math.max(0, campaign.target_unique_emails - stats.participantCount);
  const codeCount = stats.codeStats.reduce((sum, item) => sum + item.imported, 0);
  const usedCount = stats.codeStats.reduce((sum, item) => sum + item.used, 0);
  return <div className="space-y-6"><Card className="overflow-hidden"><div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div><p className="text-sm font-medium text-[var(--text-secondary)]">参与进度</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><p className="text-3xl font-semibold text-[var(--text-primary)]">{stats.participantCount}<span className="ml-1.5 text-lg font-medium text-[var(--text-muted)]">/ {campaign.target_unique_emails} 人</span></p><span className="text-sm font-semibold text-[var(--brand)]">{percent}%</span></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${percent}%` }} /></div><p className="mt-3 text-sm text-[var(--text-secondary)]">{campaign.draw_trigger === "PARTICIPANT_TARGET" ? remaining > 0 ? `还差 ${remaining} 个不同邮箱自动开奖。` : "已达到自动开奖条件。" : drawTriggerLabel(campaign.draw_trigger, campaign.draw_at)}</p></div><div className="rounded-xl border border-[#cfe2f1] bg-[#f3faff] p-5"><div className="flex items-center gap-2 text-sm font-semibold text-[#28617f]"><MaterialIcon name="rule" size={20} />本期规则</div><dl className="mt-4 space-y-3 text-sm"><Rule label="抽奖方式" value={drawMethodLabel(campaign.draw_method)} /><Rule label="开奖条件" value={drawTriggerLabel(campaign.draw_trigger, campaign.draw_at)} /><Rule label="最低兑换码面值" value={`${campaign.min_code_face_value} 元`} /><Rule label="中奖冷却期" value={`${campaign.winner_cooldown_periods} 期`} /><Rule label="核实码清理" value={`开奖完成 ${campaign.cleanup_delay_minutes} 分钟后`} /></dl></div></div></Card><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="参与人数" value={stats.participantCount} detail="按不同邮箱统计" icon="groups" tone="ice" /><StatCard label="兑换码数量" value={usedCount} detail={`已使用 / 共导入 ${codeCount}`} icon="confirmation_number" tone="brand" /><StatCard label="剩余核实码" value={codeCount - usedCount} detail="未使用的本期核实兑换码" icon="inventory_2" tone="success" /><StatCard label="中奖名额" value={stats.prizeItemCount} detail="由奖项中的获奖内容决定" icon="emoji_events" tone="warning" /></section></div>;
}

function Rule({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4"><dt className="shrink-0 text-[var(--text-muted)]">{label}</dt><dd className="text-right font-semibold leading-5 text-[var(--text-primary)]">{value}</dd></div>; }

function Participants({ detail, campaignId, search }: { detail: Awaited<ReturnType<typeof getCampaignDetailData>>; campaignId: string; search: string }) {
  const participants = detail.participants;
  const previous = `/admin/campaigns/${campaignId}?tab=participants&search=${encodeURIComponent(search)}&page=${Math.max(1, participants.page - 1)}`;
  const next = `/admin/campaigns/${campaignId}?tab=participants&search=${encodeURIComponent(search)}&page=${participants.page + 1}`;
  return (
    <Card>
      <CardHeader
        title="参与者"
        description={"每页 25 条，当前筛选共有 " + participants.total + " 位参与者。中奖资格按当前冷却状态判断。"}
      />
      <div className="border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
        <form action={"/admin/campaigns/" + campaignId} className="flex max-w-xl flex-wrap gap-2">
          <input type="hidden" name="tab" value="participants" />
          <label className="relative min-w-0 flex-1">
            <MaterialIcon name="search" size={19} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              name="search"
              defaultValue={search}
              className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-white pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(199,57,50,0.10)]"
              placeholder="搜索邮箱"
            />
          </label>
          <button className={buttonClassName("dark")}>搜索</button>
        </form>
      </div>
      {participants.items.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1010px] text-left text-sm">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold sm:px-6">邮箱</th>
                  <th className="px-5 py-3.5 font-semibold">兑换码数量</th>
                  <th className="px-5 py-3.5 font-semibold">累计面值</th>
                  <th className="px-5 py-3.5 font-semibold">首次参与</th>
                  <th className="px-5 py-3.5 font-semibold">最后参与</th>
                  <th className="px-5 py-3.5 font-semibold">中奖资格</th>
                  <th className="px-5 py-3.5 font-semibold sm:px-6">中奖状态</th>
                </tr>
              </thead>
              <tbody>
                {participants.items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                    <td className="px-5 py-4 font-medium text-[var(--text-primary)] sm:px-6">{item.email}</td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">{item.codeCount} 张</td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">{item.totalFaceValue} 元</td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-[var(--text-muted)]">{formatAdminDate(item.firstSubmittedAt)}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-[var(--text-muted)]">{formatAdminDate(item.lastSubmittedAt)}</td>
                    <td className="px-5 py-4">
                      {item.isCooldown ? (
                        <Badge tone="warning" title="最近中奖，本期可以参与但不能中奖。">冷却中</Badge>
                      ) : (
                        <Badge tone="info">可中奖</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 sm:px-6">
                      {item.isWinner ? <Badge tone="success">已中奖</Badge> : <span className="text-xs text-[var(--text-muted)]">未中奖</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-5 py-4 text-sm sm:px-6">
            <span className="text-[var(--text-muted)]">第 {participants.page} 页，共 {participants.total} 条</span>
            <div className="flex gap-2">
              {participants.page > 1 ? <Link href={previous} className={buttonClassName("secondary", "sm")}>上一页</Link> : null}
              {participants.page * participants.pageSize < participants.total ? <Link href={next} className={buttonClassName("secondary", "sm")}>下一页</Link> : null}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon="group_off"
          title="还没有符合条件的参与者"
          description={search ? "没有找到匹配的邮箱，请尝试其他关键词。" : "用户成功参与后会显示在这里。"}
          className="m-5"
        />
      )}
    </Card>
  );
}

function Codes({ stats }: { stats: Awaited<ReturnType<typeof getCampaignDetailData>>["stats"] }) { const imported = stats.codeStats.reduce((sum, row) => sum + row.imported, 0); const used = stats.codeStats.reduce((sum, row) => sum + row.used, 0); return <div className="space-y-6"><section className="grid gap-4 sm:grid-cols-3"><StatCard label="总导入" value={imported.toLocaleString("zh-CN")} detail="本期安全保存的核实码" icon="inventory_2" tone="ice" /><StatCard label="已使用" value={used.toLocaleString("zh-CN")} detail="已成功参与的兑换码" icon="check_circle" tone="success" /><StatCard label="剩余" value={(imported - used).toLocaleString("zh-CN")} detail="不会显示兑换码原文" icon="confirmation_number" tone="brand" /></section><Card><CardHeader title="按面值统计" description="为了安全，后台仅显示数量和使用率，不显示未使用兑换码原文。" /><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]"><tr><th className="px-5 py-3.5 font-semibold sm:px-6">面值</th><th className="px-5 py-3.5 font-semibold">导入数</th><th className="px-5 py-3.5 font-semibold">使用数</th><th className="px-5 py-3.5 font-semibold">剩余数</th><th className="px-5 py-3.5 font-semibold sm:px-6">使用率</th></tr></thead><tbody>{stats.codeStats.map((row) => { const rate = row.imported ? Math.round((row.used / row.imported) * 100) : 0; return <tr key={row.faceValue} className="border-b border-[var(--border-subtle)] last:border-b-0"><td className="px-5 py-4 font-semibold text-[var(--text-primary)] sm:px-6">{row.faceValue} 元</td><td className="px-5 py-4 text-[var(--text-secondary)]">{row.imported}</td><td className="px-5 py-4 text-[var(--text-secondary)]">{row.used}</td><td className="px-5 py-4 font-semibold text-[var(--success)]">{row.remaining}</td><td className="px-5 py-4 sm:px-6"><div className="flex min-w-[150px] items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--info)]" style={{ width: `${rate}%` }} /></div><span className="w-8 text-xs text-[var(--text-muted)]">{rate}%</span></div></td></tr>; })}</tbody></table></div></Card></div>; }

function Prizes({ tiers, prizeCount }: { tiers: Awaited<ReturnType<typeof getCampaignDetailData>>["prizeTiers"]; prizeCount: number }) { return <section><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-[var(--text-primary)]">奖项设置</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">公开页面只读取公开展示名称，实际获奖内容仅对管理员开放。</p></div><Badge tone="brand">共 {prizeCount} 个中奖名额</Badge></div>{tiers.length ? <div className="space-y-4">{tiers.map((tier, index) => <article key={tier.id} className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#fff1f0] text-[var(--brand)]"><MaterialIcon name={index === 0 ? "workspace_premium" : "emoji_events"} size={21} filled={index === 0} /></span><div><p className="text-base font-semibold text-[var(--text-primary)]">{tier.name}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">公开展示：{tier.publicDescription}</p></div></div><Badge tone="neutral">{tier.itemCount} 个名额</Badge></div><details className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--text-primary)]"><span className="flex items-center gap-2"><MaterialIcon name="visibility" size={19} />显示敏感获奖内容</span><MaterialIcon name="expand_more" size={19} /></summary><pre className="max-h-72 overflow-auto border-t border-[var(--border-subtle)] bg-white p-4 font-mono text-xs leading-6 text-[var(--text-primary)]">{tier.rawContents ?? "该草稿创建于敏感内容字段启用前，无法恢复原始多行文本。"}</pre></details></article>)}</div> : <EmptyState icon="emoji_events" title="该活动尚未配置奖项" description="编辑草稿后可以添加奖项和获奖内容。" />}</section>; }

function Records({ detail }: { detail: Awaited<ReturnType<typeof getCampaignDetailData>> }) { return <div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader title="中奖结果" description="展示开奖时保存的参与快照。" />{detail.winners.length ? <div className="divide-y divide-[var(--border-subtle)]">{detail.winners.map((winner) => <div key={String(winner.id)} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6"><div><p className="text-sm font-semibold text-[var(--text-primary)]">{String(winner.prize_name)} · {String(winner.public_description)}</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{String(winner.original_email_snapshot)} · {String(winner.code_count_snapshot)} 张兑换码 · {String(winner.total_face_value_snapshot)} 元</p></div><span className="text-xs text-[var(--text-muted)]">{formatAdminDate(winner.won_at as string | Date)}</span></div>)}</div> : <EmptyState icon="emoji_events" title="尚未产生中奖记录" description="开奖完成后，真实结果会显示在这里。" className="m-5" />}</Card><Card><CardHeader title="开奖批次" description="每一期的开奖任务和执行结果。" />{detail.drawRuns.length ? <div className="divide-y divide-[var(--border-subtle)]">{detail.drawRuns.map((run) => <div key={String(run.id)} className="px-5 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-[var(--text-primary)]">第 {String(run.attempt_no)} 次 · {drawRunLabel(String(run.status))}</p><span className="text-xs text-[var(--text-muted)]">{formatAdminDate(run.completed_at as string | Date | null)}</span></div><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">候选 {String(run.eligible_count)} 人 · 奖品 {String(run.prize_item_count)} 个 · 中奖 {String(run.winner_count)} 人</p>{run.error_code ? <p className="mt-2 text-xs text-[var(--danger)]">{String(run.error_code)}</p> : null}</div>)}</div> : <EmptyState icon="history" title="尚未创建开奖批次" description="达到条件或管理员手动开奖后会创建记录。" className="m-5" />}</Card><Card className="xl:col-span-2"><CardHeader title="相关运维记录" description="只显示安全摘要，不展示兑换码、密码或密钥。" />{detail.logs.length ? <div className="divide-y divide-[var(--border-subtle)]">{detail.logs.map((log) => { const presentation = operationPresentation(String(log.action)); return <div key={String(log.id)} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 sm:px-6"><div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[var(--surface-muted)] text-[var(--text-secondary)]"><MaterialIcon name={presentation.icon} size={19} /></span><div><p className="text-sm font-semibold text-[var(--text-primary)]">{presentation.title}</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{operationSummary(log.metadata)} · {actorLabel(String(log.actor_type))}</p></div></div><span className="text-xs text-[var(--text-muted)]">{formatAdminDate(log.created_at as string | Date)}</span></div>; })}</div> : <EmptyState icon="history" title="尚无相关运维记录" description="管理员操作和系统任务会自动记录在这里。" className="m-5" />}</Card></div>; }

function drawRunLabel(status: string) { return ({ PENDING: "等待执行", RUNNING: "正在执行", SUCCEEDED: "已完成", FAILED: "失败" } as Record<string, string>)[status] ?? status; }
