import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CampaignEditor } from "@/components/campaign-editor";
import { PageHeader } from "@/components/ui/page-header";
import { getCampaignEditorDefaults, getDraftCampaignEditorData } from "@/server/services/campaigns";
import { isBusinessError } from "@/server/services/errors";

export const metadata: Metadata = { title: { absolute: "编辑活动 - 冰云抽奖" } };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let initial;
  try {
    initial = await getDraftCampaignEditorData(id);
  } catch (error) {
    if (isBusinessError(error) && error.code === "CAMPAIGN_NOT_FOUND") notFound();
    if (isBusinessError(error) && error.code === "INVALID_CAMPAIGN_STATE") redirect(`/admin/campaigns/${id}`);
    throw error;
  }
  const defaults = await getCampaignEditorDefaults();
  return <main className="mx-auto w-full max-w-[1180px] px-5 py-7 sm:px-7 lg:px-9 lg:py-9"><PageHeader title={`编辑第 ${initial.issueNo} 期草稿`} /><CampaignEditor defaults={defaults} initial={initial} /></main>;
}
