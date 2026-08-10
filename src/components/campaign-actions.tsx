"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

type Action = "start" | "draw" | "cancel" | "retry-draw";

export function CampaignActions({ campaignId, status, participantCount, prizeCount }: { campaignId: string; status: string; participantCount: number; prizeCount: number }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState<Action | null>(null);
  const [confirmation, setConfirmation] = useState<Action | null>(null);

  async function run(action: Action) {
    setPending(action);
    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}/${action}`, { method: "POST" });
      const payload = await response.json() as { ok: boolean; error?: { message: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "操作失败。" );
      showToast({ tone: "success", title: action === "start" ? "活动已启动" : action === "draw" ? "开奖任务已提交" : action === "retry-draw" ? "开奖重试任务已提交" : "活动已取消", description: action === "start" ? "现在可以接受真实用户参与。" : action === "draw" || action === "retry-draw" ? "Worker 会继续处理真实开奖结果。" : "该活动不再接受参与。" });
      window.setTimeout(() => router.refresh(), 450);
    } catch (error) {
      showToast({ tone: "error", title: "操作失败", description: error instanceof Error ? error.message : "请稍后重试。" });
    } finally {
      setPending(null);
    }
  }

  const confirm = confirmation === "start"
    ? { title: "确认启动本期活动？", description: "启动后会开始接受真实用户参与。", label: "确认启动", danger: false }
    : confirmation === "draw"
    ? { title: "确认立即开奖？", description: `当前参与人数：${participantCount} 人；中奖名额：${prizeCount} 个。开奖后不能重新随机。`, label: "确认开奖", danger: true }
    : confirmation === "cancel"
      ? { title: "确认取消本期活动？", description: "取消后用户将无法继续参与。", label: "确认取消", danger: true }
      : { title: "确认重试开奖？", description: "系统只会为当前失败活动创建新的开奖尝试。", label: "确认重试", danger: false };

  return <>
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status === "DRAFT" ? <Button type="button" onClick={() => setConfirmation("start")} disabled={pending !== null}>{pending === "start" ? <MaterialIcon name="progress_activity" size={18} className="animate-spin" /> : <MaterialIcon name="play_circle" size={19} />}启动活动</Button> : null}
      {status === "ACTIVE" ? <Button type="button" variant="dark" onClick={() => setConfirmation("draw")} disabled={pending !== null}>{pending === "draw" ? <MaterialIcon name="progress_activity" size={18} className="animate-spin" /> : <MaterialIcon name="casino" size={19} />}立即开奖</Button> : null}
      {status === "ACTIVE" && participantCount === 0 ? <Button type="button" variant="ghost" className="text-[var(--danger)] hover:bg-[#fff2f1] hover:text-[var(--danger)]" onClick={() => setConfirmation("cancel")} disabled={pending !== null}><MaterialIcon name="cancel" size={19} />取消活动</Button> : null}
      {status === "DRAW_FAILED" ? <Button type="button" onClick={() => setConfirmation("retry-draw")} disabled={pending !== null}>{pending === "retry-draw" ? <MaterialIcon name="progress_activity" size={18} className="animate-spin" /> : <MaterialIcon name="refresh" size={19} />}重试开奖</Button> : null}
    </div>
    <ConfirmDialog open={confirmation !== null} title={confirm.title} description={confirm.description} confirmLabel={confirm.label} danger={confirm.danger} pending={pending !== null} onCancel={() => setConfirmation(null)} onConfirm={() => { if (confirmation) { const action = confirmation; setConfirmation(null); void run(action); } }} />
  </>;
}
