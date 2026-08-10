import type { Metadata } from "next";
import { PublicHomeExperience } from "@/components/public-home-experience";
import { getPublicCampaign, getPublicRecentCampaigns, getPublicWinners } from "@/server/services/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "欢迎使用 - 冰云抽奖" } };

export default async function HomePage() {
  const [campaign, winners, recentCampaigns] = await Promise.all([
    getPublicCampaign(),
    getPublicWinners({ pageSize: 5 }),
    getPublicRecentCampaigns({ limit: 5 }),
  ]);
  return <PublicHomeExperience campaign={campaign} winners={winners.items} recentCampaigns={recentCampaigns} />;
}
