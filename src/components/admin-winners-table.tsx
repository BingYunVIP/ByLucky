"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { emailStatusLabel, emailStatusTone, formatAdminDate } from "@/components/admin/presentation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/icon";

export type WinnerRecord = {
  id: string;
  issueNo: number;
  campaignName: string;
  email: string;
  prizeName: string;
  publicDescription: string;
  prizeContent: string | null;
  codeCount: number;
  totalFaceValue: number;
  wonAt: string;
  emailStatus: string;
  emailJobId: string | null;
};

export function AdminWinnersTable({ winners }: { winners: WinnerRecord[] }) {
  const [selected, setSelected] = useState<WinnerRecord | null>(null);
  return <>
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]"><table className="w-full min-w-[1060px] text-left text-sm"><thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]"><tr><th className="px-5 py-3.5 font-semibold sm:px-6">期号 / 活动</th><th className="px-5 py-3.5 font-semibold">完整邮箱</th><th className="px-5 py-3.5 font-semibold">奖项</th><th className="px-5 py-3.5 font-semibold">参与快照</th><th className="px-5 py-3.5 font-semibold">开奖时间</th><th className="px-5 py-3.5 font-semibold">邮件状态</th><th className="px-5 py-3.5 text-right font-semibold sm:px-6">操作</th></tr></thead><tbody>{winners.map((winner) => <tr key={winner.id} className="border-b border-[var(--border-subtle)] last:border-b-0"><td className="px-5 py-4 sm:px-6"><p className="font-semibold text-[var(--text-primary)]">第 {winner.issueNo} 期</p><p className="mt-1 max-w-[200px] truncate text-xs text-[var(--text-secondary)]" title={winner.campaignName}>{winner.campaignName}</p></td><td className="px-5 py-4 font-medium text-[var(--text-primary)]">{winner.email}</td><td className="px-5 py-4"><p className="font-semibold text-[var(--text-primary)]">{winner.prizeName}</p><p className="mt-1 max-w-[180px] truncate text-xs text-[var(--text-secondary)]" title={winner.publicDescription}>{winner.publicDescription}</p></td><td className="px-5 py-4 text-[var(--text-secondary)]">{winner.codeCount} 张 · {winner.totalFaceValue} 元</td><td className="px-5 py-4 whitespace-nowrap text-xs text-[var(--text-muted)]">{formatAdminDate(winner.wonAt)}</td><td className="px-5 py-4">{winner.emailJobId ? <Link href={`/admin/email?tab=queue&jobId=${encodeURIComponent(winner.emailJobId)}`} title="查看发送任务" aria-label={`查看 ${emailStatusLabel(winner.emailStatus)} 邮件任务`} className="inline-flex cursor-pointer rounded-full focus-visible:outline-none"><Badge tone={emailStatusTone(winner.emailStatus)}>{emailStatusLabel(winner.emailStatus)}</Badge></Link> : <Badge tone={emailStatusTone(winner.emailStatus)}>{emailStatusLabel(winner.emailStatus)}</Badge>}</td><td className="px-5 py-4 text-right sm:px-6"><Button type="button" variant="ghost" size="sm" onClick={() => setSelected(winner)}>查看详情</Button></td></tr>)}</tbody></table></div>
    <WinnerDetailDialog key={selected?.id ?? "none"} winner={selected} onClose={() => setSelected(null)} />
  </>;
}

function WinnerDetailDialog({ winner, onClose }: { winner: WinnerRecord | null; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [showSensitive, setShowSensitive] = useState(false);
  useEffect(() => {
    if (!winner) return;
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEscape);
    window.setTimeout(() => closeButton.current?.focus(), 0);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, winner]);
  if (!winner) return null;
  return <div className="fixed inset-0 z-[70] flex justify-end bg-[#17242d]/35" role="presentation"><button type="button" className="absolute inset-0 cursor-default" aria-label="关闭获奖详情" onClick={onClose} /><aside role="dialog" aria-modal="true" aria-labelledby="winner-detail-title" className="relative flex h-full w-full max-w-[480px] flex-col bg-white shadow-[-18px_0_48px_rgba(23,36,45,0.20)]"><div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] p-5"><div><p className="text-xs font-semibold tracking-[0.08em] text-[var(--brand)]">获奖详情</p><h2 id="winner-detail-title" className="mt-2 text-xl font-semibold text-[var(--text-primary)]">第 {winner.issueNo} 期 · {winner.prizeName}</h2></div><button ref={closeButton} type="button" aria-label="关闭获奖详情" className="grid size-10 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]" onClick={onClose}><MaterialIcon name="close" size={21} /></button></div><div className="flex-1 overflow-y-auto p-5"><dl className="space-y-4"><Detail label="活动" value={winner.campaignName} /><Detail label="获奖邮箱" value={winner.email} /><Detail label="奖项" value={`${winner.prizeName} · ${winner.publicDescription}`} /><Detail label="开奖快照" value={`${winner.codeCount} 张兑换码 · ${winner.totalFaceValue} 元`} /><Detail label="开奖时间" value={formatAdminDate(winner.wonAt)} /><div><dt className="text-xs font-medium text-[var(--text-muted)]">邮件状态</dt><dd className="mt-2">{winner.emailJobId ? <Link href={`/admin/email?tab=queue&jobId=${encodeURIComponent(winner.emailJobId)}`} title="查看发送任务" className="inline-flex cursor-pointer"><Badge tone={emailStatusTone(winner.emailStatus)}>{emailStatusLabel(winner.emailStatus)}</Badge></Link> : <Badge tone={emailStatusTone(winner.emailStatus)}>{emailStatusLabel(winner.emailStatus)}</Badge>}</dd></div></dl><div className="mt-7 rounded-xl border border-[#efdbc0] bg-[#fff9ee] p-4"><div className="flex items-start gap-3"><MaterialIcon name="visibility_lock" size={21} className="text-[var(--warning)]" /><div><p className="text-sm font-semibold text-[var(--text-primary)]">敏感获奖内容</p><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">内容仅供管理员处理中奖通知使用，请勿在公开渠道展示。</p></div></div>{showSensitive ? <pre className="mt-4 max-h-56 overflow-auto rounded-lg border border-[#eeddbf] bg-white p-3 font-mono text-xs leading-6 text-[var(--text-primary)]">{winner.prizeContent ?? "该中奖记录没有可读取的获奖内容。"}</pre> : <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => setShowSensitive(true)}><MaterialIcon name="visibility" size={18} />显示敏感内容</Button>}</div></div><div className="border-t border-[var(--border-subtle)] p-5"><Button type="button" variant="secondary" className="w-full" onClick={onClose}>关闭</Button></div></aside></div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium text-[var(--text-muted)]">{label}</dt><dd className="mt-1.5 text-sm font-semibold leading-6 text-[var(--text-primary)]">{value}</dd></div>; }
