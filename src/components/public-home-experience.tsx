"use client";

import { CurrentCampaignExperience, type PublicCampaign } from "@/components/current-campaign-experience";
import { formatPublicDate, PublicPreferencesProvider, usePublicPreferences } from "@/components/public-preferences";
import { PublicHeader } from "@/components/public-header";
import { Card } from "@/components/ui/card";
import { MaterialIcon } from "@/components/ui/icon";

type RecentWinner = {
  id: string;
  issueNo: number;
  campaignName: string;
  prizeName: string;
  publicDescription: string;
  maskedEmail: string;
  wonAt: string;
};

type RecentCampaign = {
  issueNo: number;
  name: string;
  participantCount: number;
  winnerCount: number;
  completedAt: string | null;
};

export function PublicHomeExperience({ campaign, winners, recentCampaigns }: { campaign: PublicCampaign | null; winners: RecentWinner[]; recentCampaigns: RecentCampaign[] }) {
  return <PublicPreferencesProvider><PublicHomeContent campaign={campaign} winners={winners.slice(0, 5)} recentCampaigns={recentCampaigns.slice(0, 5)} /></PublicPreferencesProvider>;
}

function PublicHomeContent({ campaign, winners, recentCampaigns }: { campaign: PublicCampaign | null; winners: RecentWinner[]; recentCampaigns: RecentCampaign[] }) {
  const { locale } = usePublicPreferences();
  return <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
    <PublicHeader />
    <main className="mx-auto w-full max-w-[1480px] px-5 py-6 sm:px-7 sm:py-8 lg:px-8 lg:py-10">
      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.75fr)]">
        <CurrentCampaignExperience campaign={campaign} />
        <RecentWinners items={winners} />
      </section>
      <RecentCampaigns items={recentCampaigns} locale={locale} />
    </main>
  </div>;
}

function RecentWinners({ items }: { items: RecentWinner[] }) {
  const { copy } = usePublicPreferences();
  return <aside aria-labelledby="recent-winners-title">
    <Card className="overflow-hidden rounded-[18px]">
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-5 sm:px-6">
        <span className="grid size-9 place-items-center rounded-lg bg-[var(--ice)] text-[var(--info)]"><MaterialIcon name="emoji_events" size={20} /></span>
        <h2 id="recent-winners-title" className="text-lg font-semibold text-[var(--text-primary)]">{copy.recentWinners}</h2>
      </div>
      {items.length ? <ol className="divide-y divide-[var(--border-subtle)]">
        {items.map((winner) => <li key={winner.id}><article className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 px-5 py-3.5 sm:grid-cols-3 sm:items-center sm:gap-x-4 sm:gap-y-0 sm:px-6"><p className="whitespace-nowrap text-xs font-semibold text-[var(--brand)]">{copy.issue(winner.issueNo)}</p><p className="min-w-0 truncate text-sm font-medium text-[var(--text-primary)] sm:text-center" title={winner.publicDescription}>{winner.publicDescription}</p><div className="col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs sm:col-span-1"><span className="truncate text-[var(--text-secondary)]">{winner.maskedEmail}</span><span className="shrink-0 whitespace-nowrap font-semibold text-[var(--brand)]">{winner.prizeName}</span></div></article></li>)}
      </ol> : <div className="grid min-h-[290px] place-items-center px-6 py-10 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-[var(--surface-subtle)] text-[var(--text-muted)]"><MaterialIcon name="emoji_events" size={23} /></span><p className="mt-4 text-sm text-[var(--text-secondary)]">{copy.noWinners}</p></div></div>}
    </Card>
  </aside>;
}

function RecentCampaigns({ items, locale }: { items: RecentCampaign[]; locale: "zh" | "en" }) {
  const { copy } = usePublicPreferences();
  return <section className="pt-7 sm:pt-9" aria-labelledby="recent-campaigns-title">
    <Card className="overflow-hidden rounded-[18px]">
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-5 sm:px-6"><span className="grid size-9 place-items-center rounded-lg bg-[var(--ice)] text-[var(--info)]"><MaterialIcon name="history" size={20} /></span><h2 id="recent-campaigns-title" className="text-lg font-semibold text-[var(--text-primary)]">{copy.recentIssues}</h2></div>
      {items.length ? <div>
        <div className="hidden grid-cols-[100px_minmax(0,1fr)_110px_110px_170px] gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-6 py-3 text-xs font-semibold text-[var(--text-muted)] lg:grid"><span>{locale === "zh" ? "期数" : "Issue"}</span><span>{locale === "zh" ? "活动" : "Campaign"}</span><span>{copy.participants}</span><span>{copy.winners}</span><span>{copy.drawTime}</span></div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {items.map((campaign) => <article key={campaign.issueNo} className="grid gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[120px_minmax(0,1fr)_120px_120px] sm:items-center sm:px-6 lg:grid-cols-[100px_minmax(0,1fr)_110px_110px_170px]"><p className="font-semibold text-[var(--text-primary)]">{copy.issue(campaign.issueNo)}</p><p className="min-w-0 truncate text-sm text-[var(--text-secondary)]" title={campaign.name}>{campaign.name}</p><p className="text-sm text-[var(--text-secondary)]"><span className="mr-1 text-xs text-[var(--text-muted)] sm:hidden">{copy.participants}</span>{campaign.participantCount}</p><p className="text-sm text-[var(--text-secondary)]"><span className="mr-1 text-xs text-[var(--text-muted)] sm:hidden">{copy.winners}</span>{campaign.winnerCount}</p><p className="text-xs text-[var(--text-muted)] sm:col-span-2 lg:col-span-1">{formatPublicDate(campaign.completedAt, locale)}</p></article>)}
        </div>
      </div> : <div className="grid min-h-48 place-items-center px-6 py-10 text-center"><div><MaterialIcon name="history" size={25} className="text-[var(--text-muted)]" /><p className="mt-3 text-sm text-[var(--text-secondary)]">{copy.noHistory}</p></div></div>}
    </Card>
  </section>;
}
