import type { Metadata } from "next";
import Link from "next/link";
import { campaignStatusLabel, campaignStatusTone, drawMethodLabel, drawTriggerLabel, formatAdminDate } from "@/components/admin/presentation";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MaterialIcon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getDashboardData } from "@/server/services/admin-data";

export const metadata: Metadata = { title: { absolute: "管理总览 - 冰云抽奖" } };

export default async function AdminDashboardPage() {
  const dashboard = await getDashboardData();
  const active = dashboard.activeCampaign;

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
      <PageHeader title="管理总览" actions={<Link href="/admin/campaigns/new" className={buttonClassName("primary")}><MaterialIcon name="add_circle" size={19} />创建活动</Link>} />

      {active ? <>
        <section aria-labelledby="current-campaign-heading">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-[var(--brand)]">当前活动</p>
              <h2 id="current-campaign-heading" className="mt-1 text-lg font-semibold text-[var(--text-primary)]">活动运行情况</h2>
            </div>
            <Link href={`/admin/campaigns/${active.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-hover)]">查看活动详情<MaterialIcon name="arrow_forward" size={18} /></Link>
          </div>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="text-lg font-semibold text-[var(--text-primary)]">第 {active.issueNo} 期 · {active.name}</p><Badge tone={campaignStatusTone(active.status)}>{campaignStatusLabel(active.status)}</Badge></div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{drawMethodLabel(active.drawMethod)} · {drawTriggerLabel(active.drawTrigger, active.drawAt)}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-lg border border-[#cfe2f1] bg-[#f3faff] px-3 py-2 text-xs font-medium text-[#28617f]"><MaterialIcon name="schedule" size={17} />{active.drawTrigger === "PARTICIPANT_TARGET" ? active.remainingParticipantCount > 0 ? `还差 ${active.remainingParticipantCount} 个不同邮箱` : "已达到自动开奖条件" : active.drawTrigger === "SCHEDULED" ? active.drawAt ? formatAdminDate(active.drawAt) : "等待指定时间" : "等待管理员操作"}</span>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
              <StatCard label="参与人数" value={`${active.participantCount} / ${active.targetUniqueEmails}`} detail="按不同邮箱统计" icon="groups" tone="ice" className="min-h-32 shadow-none" />
              <StatCard label="已用兑换码" value={active.usedCodeCount} detail={`共导入 ${active.importedCodeCount} 张`} icon="confirmation_number" tone="brand" className="min-h-32 shadow-none" />
              <StatCard label="累计参与面值" value={`${active.totalFaceValue} 元`} detail="已成功参与的兑换码累计值" icon="payments" tone="success" className="min-h-32 shadow-none" />
              <StatCard label="中奖名额" value={active.prizeItemCount} detail="按奖项中的获奖内容统计" icon="emoji_events" tone="warning" className="min-h-32 shadow-none" />
            </div>
          </Card>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.7fr)]">
          <Inventory data={dashboard.inventory} total={active.importedCodeCount} used={active.usedCodeCount} />
          <EmailQueue pending={dashboard.emailStatus.pending} sent={dashboard.emailStatus.sent} failed={dashboard.emailStatus.failed} />
        </section>
      </> : <section>
        <EmptyState icon="event_busy" title="当前没有进行中的活动" description="创建活动、配置奖项并导入核实兑换码后，就可以启动新一期抽奖。" action={<Link href="/admin/campaigns/new" className={buttonClassName("primary")}><MaterialIcon name="add_circle" size={19} />创建新活动</Link>} />
      </section>}

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <RecentCampaigns items={dashboard.recentCampaigns} />
        <SystemHealth worker={dashboard.worker} failedJobCount={dashboard.failedJobCount} />
      </section>
    </main>
  );
}

function Inventory({ data, total, used }: { data: Awaited<ReturnType<typeof getDashboardData>>["inventory"]; total: number; used: number }) {
  return <Card><CardHeader title="核实兑换码库存" description={`总导入 ${total.toLocaleString("zh-CN")} 张，已使用 ${used.toLocaleString("zh-CN")} 张，剩余 ${(total - used).toLocaleString("zh-CN")} 张。`} /><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]"><tr><th className="px-5 py-3.5 font-semibold sm:px-6">面值</th><th className="px-5 py-3.5 font-semibold">导入</th><th className="px-5 py-3.5 font-semibold">已使用</th><th className="px-5 py-3.5 font-semibold">剩余</th><th className="px-5 py-3.5 font-semibold sm:px-6">使用率</th></tr></thead><tbody>{data.map((item) => { const rate = item.imported ? Math.round((item.used / item.imported) * 100) : 0; return <tr key={item.faceValue} className="border-b border-[var(--border-subtle)] last:border-b-0"><td className="px-5 py-4 font-semibold text-[var(--text-primary)] sm:px-6">{item.faceValue} 元</td><td className="px-5 py-4 text-[var(--text-secondary)]">{item.imported.toLocaleString("zh-CN")}</td><td className="px-5 py-4 text-[var(--text-secondary)]">{item.used.toLocaleString("zh-CN")}</td><td className="px-5 py-4 font-semibold text-[var(--success)]">{item.remaining.toLocaleString("zh-CN")}</td><td className="px-5 py-4 sm:px-6"><div className="flex min-w-[140px] items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--info)]" style={{ width: `${rate}%` }} /></div><span className="w-8 text-xs text-[var(--text-muted)]">{rate}%</span></div></td></tr>; })}</tbody></table></div></Card>;
}

function EmailQueue({ pending, sent, failed }: { pending: number; sent: number; failed: number }) {
  return <Card className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-[var(--text-primary)]">邮件队列</h2><Link href="/admin/email" className="text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-hover)]">管理</Link></div><div className="mt-5 space-y-3"><QueueRow icon="mail" label="待发送" value={pending} tone="warning" /><QueueRow icon="mark_email_read" label="已发送" value={sent} tone="success" /><QueueRow icon="error" label="发送失败" value={failed} tone="danger" /></div></Card>;
}

function QueueRow({ icon, label, value, tone }: { icon: string; label: string; value: number; tone: "warning" | "success" | "danger" }) { const tones = { warning: "bg-[#fff8e8] text-[var(--warning)]", success: "bg-[#effaf3] text-[var(--success)]", danger: "bg-[#fff2f1] text-[var(--danger)]" }; return <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-3"><span className="flex items-center gap-3 text-sm font-semibold text-[var(--text-primary)]"><span className={`grid size-8 place-items-center rounded-lg ${tones[tone]}`}><MaterialIcon name={icon} size={18} /></span>{label}</span><span className="text-xl font-semibold text-[var(--text-primary)]">{value}</span></div>; }

function RecentCampaigns({ items }: { items: Awaited<ReturnType<typeof getDashboardData>>["recentCampaigns"] }) { return <Card><CardHeader title="最近开奖" action={<Link href="/admin/winners" className="text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-hover)]">查看获奖记录</Link>} />{items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]"><tr><th className="px-5 py-3.5 font-semibold sm:px-6">期号</th><th className="px-5 py-3.5 font-semibold">活动</th><th className="px-5 py-3.5 font-semibold">参与人数</th><th className="px-5 py-3.5 font-semibold">中奖人数</th><th className="px-5 py-3.5 font-semibold sm:px-6">开奖时间</th></tr></thead><tbody>{items.map((item) => <tr key={item.issueNo} className="border-b border-[var(--border-subtle)] last:border-b-0"><td className="px-5 py-4 font-semibold text-[var(--text-primary)] sm:px-6">第 {item.issueNo} 期</td><td className="px-5 py-4 text-[var(--text-secondary)]">{item.name}</td><td className="px-5 py-4 text-[var(--text-secondary)]">{item.participantCount}</td><td className="px-5 py-4 text-[var(--text-secondary)]">{item.winnerCount}</td><td className="px-5 py-4 text-xs text-[var(--text-muted)] sm:px-6">{formatAdminDate(item.completedAt)}</td></tr>)}</tbody></table></div> : <div className="px-6 py-12 text-center"><MaterialIcon name="emoji_events" size={25} className="text-[var(--text-muted)]" /><p className="mt-3 text-sm text-[var(--text-secondary)]">完成一次开奖后，结果会显示在这里。</p></div>}</Card>; }

function SystemHealth({ worker, failedJobCount }: { worker: Awaited<ReturnType<typeof getDashboardData>>["worker"]; failedJobCount: number }) { const items = [{ label: "数据库", detail: "运行正常", icon: "database", tone: "success" as const }, { label: "管理员 Session", detail: "服务端验证已启用", icon: "verified_user", tone: "success" as const }, { label: "Worker", detail: worker?.online ? `运行正常 · ${formatAdminDate(worker.lastSeenAt, true)}` : "暂未连接或心跳超时", icon: "settings_suggest", tone: worker?.online ? "success" as const : "warning" as const }, { label: "失败任务", detail: failedJobCount > 0 ? `${failedJobCount} 个任务需要关注` : "暂无失败任务", icon: failedJobCount > 0 ? "error" : "check_circle", tone: failedJobCount > 0 ? "danger" as const : "success" as const }]; const colors = { success: "text-[var(--success)]", warning: "text-[var(--warning)]", danger: "text-[var(--danger)]" }; return <Card className="p-5 sm:p-6"><h2 className="text-base font-semibold text-[var(--text-primary)]">系统运行状态</h2><div className="mt-5 space-y-4">{items.map((item) => <div key={item.label} className="flex items-start gap-3"><MaterialIcon name={item.icon} size={20} className={colors[item.tone]} filled={item.tone === "success"} /><div><p className="text-sm font-semibold text-[var(--text-primary)]">{item.label}</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{item.detail}</p></div></div>)}</div></Card>; }
