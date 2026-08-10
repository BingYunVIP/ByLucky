import type { Metadata } from "next";
import { CampaignEditor } from "@/components/campaign-editor";
import { PageHeader } from "@/components/ui/page-header";
import { getCampaignEditorDefaults } from "@/server/services/campaigns";

export const metadata: Metadata = { title: { absolute: "创建活动 - 冰云抽奖" } };

export default async function NewCampaignPage() {
  const defaults = await getCampaignEditorDefaults();
  return <main className="mx-auto w-full max-w-[1180px] px-5 py-7 sm:px-7 lg:px-9 lg:py-9"><PageHeader title="创建活动" /><CampaignEditor defaults={defaults} /></main>;
}
