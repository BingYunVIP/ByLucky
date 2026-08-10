"use client";

import { useState } from "react";
import { ParticipationForm } from "@/components/participation-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MaterialIcon } from "@/components/ui/icon";
import { formatPublicDate, usePublicPreferences } from "@/components/public-preferences";

export type PublicCampaign = {
  id: string;
  issueNo: number;
  name: string;
  status: "ACTIVE" | "LOCKED" | "DRAWING" | string;
  targetUniqueEmails: number;
  currentUniqueEmails: number;
  drawTrigger: string;
  drawAt: string | null;
  timezone: string;
  prizes: Array<{ id: string; name: string; publicDescription: string; quantity: number }>;
};

function statusLabel(status: string, locale: "zh" | "en") {
  const labels = locale === "zh"
    ? { ACTIVE: "进行中", LOCKED: "即将开奖", DRAWING: "开奖中" }
    : { ACTIVE: "Open", LOCKED: "Preparing draw", DRAWING: "Drawing" };
  return labels[status as keyof typeof labels] ?? labels.ACTIVE;
}

export function CurrentCampaignExperience({ campaign }: { campaign: PublicCampaign | null }) {
  const { locale, copy } = usePublicPreferences();
  const [participantCount, setParticipantCount] = useState(campaign?.currentUniqueEmails ?? 0);
  const prizeCount = campaign?.prizes.reduce((total, prize) => total + prize.quantity, 0) ?? 0;
  const progress = campaign ? Math.min(100, Math.round((participantCount / campaign.targetUniqueEmails) * 100)) : 0;
  const remaining = campaign ? Math.max(0, campaign.targetUniqueEmails - participantCount) : 0;
  const schedule = campaign?.drawAt ? formatPublicDate(campaign.drawAt, locale) : null;
  const active = campaign?.status === "ACTIVE";

  const progressMessage = !campaign
    ? copy.noProgress
    : campaign.drawTrigger === "PARTICIPANT_TARGET"
      ? remaining > 0 ? copy.automaticDrawRemaining(remaining) : copy.targetReached
      : campaign.drawTrigger === "SCHEDULED" && schedule
        ? copy.scheduledDraw(schedule)
        : campaign.status === "DRAWING" || campaign.status === "LOCKED"
          ? copy.drawPreparing
          : copy.manualDraw;

  return (
    <Card className="overflow-hidden rounded-[18px]">
      <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
            <MaterialIcon name={campaign ? "confirmation_number" : "event_busy"} size={20} className="text-[var(--brand)]" filled={Boolean(campaign)} />
            {campaign ? `${copy.issue(campaign.issueNo)} · ${copy.currentActivity}` : copy.currentActivity}
          </span>
          {campaign ? <Badge tone={active ? "success" : "warning"}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{statusLabel(campaign.status, locale)}</Badge> : null}
        </div>
        <h1 className="mt-4 text-2xl font-semibold leading-tight text-[var(--text-primary)] sm:text-[30px]">{campaign?.name ?? copy.noOpenActivity}</h1>
      </div>

      <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat label={copy.prizeCount} value={campaign ? String(campaign.prizes.length) : copy.noProgress} icon="emoji_events" />
          <Stat label={copy.participantCount} value={campaign ? `${participantCount} / ${campaign.targetUniqueEmails}` : copy.noProgress} icon="groups" />
          <Stat label={copy.winnerSlots} value={campaign ? String(prizeCount) : copy.noProgress} icon="workspace_premium" />
        </dl>

        <section aria-label={copy.drawProgress}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{copy.drawProgress}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{campaign ? `${participantCount} / ${campaign.targetUniqueEmails}` : copy.noProgress}</p>
            </div>
            {campaign ? <span className="text-sm font-semibold text-[var(--brand)]">{progress}%</span> : null}
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-label={copy.drawProgress}>
            <div className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">{progressMessage}</p>
        </section>

        <section aria-labelledby="public-prizes-title">
          <div className="mb-3 flex items-center gap-2"><MaterialIcon name="emoji_events" size={19} className="text-[var(--brand)]" /><h2 id="public-prizes-title" className="text-base font-semibold text-[var(--text-primary)]">{copy.prizes}</h2></div>
          {campaign?.prizes.length ? <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4">
            {campaign.prizes.map((prize) => <li key={prize.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center sm:gap-4"><span className="font-semibold text-[var(--text-primary)]">{prize.name}</span><span className="text-[var(--text-secondary)]">{prize.publicDescription}</span><span className="text-xs font-semibold text-[var(--text-muted)] sm:text-right">{copy.prizeQuantity(prize.quantity)}</span></li>)}
          </ul> : <p className="rounded-xl border border-dashed border-[var(--border-strong)] px-4 py-4 text-sm text-[var(--text-secondary)]">{copy.noPrizes}</p>}
        </section>

        <div className="border-t border-[var(--border-subtle)] pt-6">
          <ParticipationForm
            campaign={campaign ? { id: campaign.id, issueNo: campaign.issueNo, name: campaign.name, targetUniqueEmails: campaign.targetUniqueEmails, currentUniqueEmails: participantCount, status: campaign.status } : null}
            disabled={!active}
            onParticipantCountChange={setParticipantCount}
          />
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-4 py-3.5"><div className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]"><MaterialIcon name={icon} size={17} />{label}</div><dd className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{value}</dd></div>;
}
