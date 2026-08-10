import type { Metadata } from "next";
import Link from "next/link";
import { CampaignListTable } from "@/components/campaign-list-table";
import { buttonClassName } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { listAdminCampaigns } from "@/server/services/campaigns";

export const metadata: Metadata = { title: { absolute: "活动列表 - 冰云抽奖" } };

export default async function CampaignsPage() {
  const campaigns = await listAdminCampaigns();
  return <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 lg:px-9 lg:py-9"><PageHeader title="活动列表" actions={<Link href="/admin/campaigns/new" className={buttonClassName("primary")}><MaterialIcon name="add_circle" size={19} />创建活动</Link>} /><CampaignListTable campaigns={campaigns} /></main>;
}
