"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Field, SelectInput, Textarea, TextInput } from "@/components/ui/form";
import { MaterialIcon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

type EditorDefaults = {
  nextIssueNo: number;
  timezone: string;
  targetUniqueEmails: number;
  minCodeFaceValue: number;
  drawMethod: string;
};

type PrizeTierDraft = { id: string; name: string; publicDescription: string; rawContents: string };

export type CampaignEditorInitial = {
  id: string;
  issueNo: number;
  name: string;
  targetUniqueEmails: number;
  minCodeFaceValue: number;
  drawMethod: string;
  drawTrigger: string;
  drawAt: string | null;
  winnerCooldownPeriods: number;
  cleanupDelayMinutes: number;
  timezone: string;
  importedCodeCount: number;
  prizeTiers: PrizeTierDraft[];
};

type CodePreview = {
  counts: Record<string, number>;
  importableCounts: Record<string, number>;
  total: number;
  importableTotal: number;
  whitespaceRiskCount: number;
  duplicateCount: number;
  crossValueDuplicateCount: number;
  usedSkippedCount: number;
  otherCampaignConflictCount: number;
  currentCampaignDuplicateCount: number;
  errors: Array<{ code: string; line?: number }>;
  canImport: boolean;
};

type EditorStep = 1 | 2 | 3 | 4;

const faceValues = [1, 5, 10, 20, 50, 100];
const steps: Array<{ id: EditorStep; label: string; icon: string }> = [
  { id: 1, label: "基本设置", icon: "tune" },
  { id: 2, label: "奖项设置", icon: "emoji_events" },
  { id: 3, label: "核实兑换码", icon: "confirmation_number" },
  { id: 4, label: "确认发布", icon: "fact_check" },
];

function toDateTimeParts(value: string | null) {
  if (!value) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "00";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

function visibleItemCount(contents: string) {
  return contents.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function formatScheduledValue(date: string, time: string) {
  const [, month = "", day = ""] = date.split("-");
  return month && day && time ? `${month} 月 ${day} 日 ${time}` : "尚未填写";
}

function codeIssueLabel(code: string) {
  return ({
    CODE_BEFORE_HEADER: "标题前出现了兑换码。",
    UNKNOWN_HEADER: "无法识别的面值标题。",
    DUPLICATE_CODE: "本次文本中出现重复兑换码。",
    CROSS_VALUE_DUPLICATE: "同一兑换码出现在不同面值标题下。",
    EMPTY_IMPORT: "没有可解析的兑换码。",
    CODE_ASSIGNED_TO_OTHER_CAMPAIGN: "兑换码正在被其他活动占用。",
    CODE_ALREADY_IN_CAMPAIGN: "兑换码已经导入本期活动。",
    CODE_ALREADY_USED: "兑换码已经在历史活动中使用，不能再次导入。",
  } as Record<string, string>)[code] ?? "发现无法导入的兑换码。";
}

export function CampaignEditor({ defaults, initial }: { defaults: EditorDefaults; initial?: CampaignEditorInitial }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isEditing = Boolean(initial);
  const tierId = useRef((initial?.prizeTiers.length ?? 0) + 1);
  const initialSchedule = toDateTimeParts(initial?.drawAt ?? null);
  const [step, setStep] = useState<EditorStep>(1);
  const [name, setName] = useState(initial?.name ?? `第${defaults.nextIssueNo}期冰云抽奖`);
  const [target, setTarget] = useState(String(initial?.targetUniqueEmails ?? defaults.targetUniqueEmails));
  const [minValue, setMinValue] = useState(String(initial?.minCodeFaceValue ?? defaults.minCodeFaceValue));
  const [drawMethod, setDrawMethod] = useState(initial?.drawMethod ?? defaults.drawMethod);
  const [drawTrigger, setDrawTrigger] = useState(initial?.drawTrigger ?? "PARTICIPANT_TARGET");
  const [drawDate, setDrawDate] = useState(initialSchedule.date);
  const [drawTime, setDrawTime] = useState(initialSchedule.time);
  const [codesText, setCodesText] = useState("");
  const [prizeTiers, setPrizeTiers] = useState<PrizeTierDraft[]>(initial?.prizeTiers.length ? initial.prizeTiers : [
    { id: "tier-1", name: "一等奖", publicDescription: "", rawContents: "" },
    { id: "tier-2", name: "二等奖", publicDescription: "", rawContents: "" },
    { id: "tier-3", name: "三等奖", publicDescription: "", rawContents: "" },
  ]);
  const [openTierIds, setOpenTierIds] = useState(() => new Set((initial?.prizeTiers.length ? initial.prizeTiers : [{ id: "tier-1" }, { id: "tier-2" }]).slice(0, 2).map((tier) => tier.id)));
  const [importedCodeCount, setImportedCodeCount] = useState(initial?.importedCodeCount ?? 0);
  const [preview, setPreview] = useState<CodePreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | "draft" | "start" | null>(null);
  const [startConfirmationOpen, setStartConfirmationOpen] = useState(false);

  const issueNo = initial?.issueNo ?? defaults.nextIssueNo;
  const timezone = initial?.timezone ?? defaults.timezone;
  const scheduledDateTime = drawDate && drawTime ? `${drawDate}T${drawTime}` : "";
  const prizeCount = useMemo(() => prizeTiers.reduce((total, tier) => total + visibleItemCount(tier.rawContents), 0), [prizeTiers]);
  const basicValid = name.trim().length > 0 && Number.isInteger(Number(target)) && Number(target) > 0 && (drawTrigger !== "SCHEDULED" || Boolean(scheduledDateTime));
  const prizesValid = prizeTiers.length > 0 && prizeTiers.every((tier) => tier.name.trim() && tier.publicDescription.trim() && visibleItemCount(tier.rawContents) > 0);
  const codeStepValid = isEditing || codesText.trim().length === 0 || Boolean(preview?.canImport);
  const canStart = basicValid && prizesValid && prizeCount > 0 && Boolean(preview?.canImport && preview.importableTotal > 0);

  function addTier() {
    const index = prizeTiers.length;
    const id = `tier-${tierId.current}`;
    tierId.current += 1;
    setPrizeTiers((current) => [...current, { id, name: ["一等奖", "二等奖", "三等奖"][index] ?? `第${index + 1}奖`, publicDescription: "", rawContents: "" }]);
    setOpenTierIds((current) => new Set([...current, id]));
  }

  function updateTier(id: string, field: keyof Omit<PrizeTierDraft, "id">, value: string) {
    setPrizeTiers((current) => current.map((tier) => tier.id === id ? { ...tier, [field]: value } : tier));
  }

  function moveTier(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= prizeTiers.length) return;
    setPrizeTiers((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function removeTier(id: string) {
    setPrizeTiers((current) => current.filter((tier) => tier.id !== id));
    setOpenTierIds((current) => { const next = new Set(current); next.delete(id); return next; });
  }

  function toggleTier(id: string) {
    setOpenTierIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function validationMessage(current: EditorStep) {
    if (current === 1 && !basicValid) return "请先填写活动名称、目标人数和开奖条件。";
    if (current === 2 && !prizesValid) return "每个奖项都需要名称、公开展示名称和至少一个中奖名额。";
    if (current === 3 && !codeStepValid) return "请先解析兑换码并处理预览中的错误。";
    return null;
  }

  function goNext() {
    const validation = validationMessage(step);
    if (validation) { showToast({ tone: "warning", title: "请完善当前步骤", description: validation }); return; }
    setStep((current) => Math.min(4, current + 1) as EditorStep);
  }

  function goTo(next: EditorStep) {
    if (next > step) {
      const validation = validationMessage(step);
      if (validation) { showToast({ tone: "warning", title: "请先完善当前步骤", description: validation }); return; }
    }
    setStep(next);
  }

  async function parseCodes() {
    setBusy("preview");
    try {
      const endpoint = initial ? `/api/admin/campaigns/${initial.id}/codes/preview` : "/api/admin/codes/parse";
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: codesText }) });
      const payload = await response.json() as { ok: boolean; data?: CodePreview; error?: { message: string } };
      if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message ?? "解析失败。");
      setPreview(payload.data);
      showToast(payload.data.canImport ? { tone: "success", title: "兑换码解析成功", description: `本次可导入 ${payload.data.importableTotal} 张兑换码。` } : { tone: "error", title: "兑换码预览发现问题", description: "请处理错误后再继续。" });
    } catch (error) {
      showToast({ tone: "error", title: "兑换码解析失败", description: error instanceof Error ? error.message : "请稍后重试。" });
    } finally { setBusy(null); }
  }

  function payload(action: "DRAFT" | "START") {
    return {
      name,
      targetUniqueEmails: Number(target),
      minCodeFaceValue: Number(minValue),
      drawMethod,
      drawTrigger,
      drawAt: drawTrigger === "SCHEDULED" && scheduledDateTime ? new Date(scheduledDateTime).toISOString() : null,
      timezone,
      prizeTiers: prizeTiers.map(({ name: tierName, publicDescription, rawContents }) => ({ name: tierName, publicDescription, rawContents })),
      codesText: initial ? "" : codesText,
      action,
    };
  }

  async function save(action: "DRAFT" | "START", confirmed = false) {
    if (!isEditing && codesText.trim().length > 0 && (!preview || !preview.canImport)) {
      setStep(3);
      showToast({ tone: "warning", title: "请先处理核实兑换码", description: "需要先解析兑换码并修复预览错误。" });
      return;
    }
    if (action === "START" && !canStart) {
      if (!preview?.canImport || preview.importableTotal === 0) setStep(3);
      else if (!prizesValid) setStep(2);
      else setStep(1);
      showToast({ tone: "warning", title: "活动尚未满足启动条件", description: "请检查奖项、核实码预览和基本设置。" });
      return;
    }
    if (action === "START" && !confirmed) { setStartConfirmationOpen(true); return; }
    setBusy(action === "START" ? "start" : "draft");
    try {
      const endpoint = initial ? `/api/admin/campaigns/${initial.id}` : "/api/admin/campaigns";
      const response = await fetch(endpoint, { method: initial ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload(action)) });
      const body = await response.json() as { ok: boolean; data?: { campaign?: { id: string } }; error?: { message: string } };
      if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "保存失败。");
      const campaignId = body.data?.campaign?.id ?? initial?.id;
      showToast({ tone: "success", title: initial ? "草稿已更新" : action === "START" ? "活动已创建并启动" : "草稿已保存" });
      window.setTimeout(() => router.push(campaignId ? `/admin/campaigns/${campaignId}` : "/admin/campaigns"), 450);
    } catch (error) {
      showToast({ tone: "error", title: "保存失败", description: error instanceof Error ? error.message : "请稍后重试。" });
    } finally { setBusy(null); }
  }

  async function importCodes() {
    if (!initial || !preview?.canImport) return;
    setBusy("import");
    try {
      const response = await fetch(`/api/admin/campaigns/${initial.id}/codes/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: codesText }) });
      const body = await response.json() as { ok: boolean; data?: { importedCodeCount: number }; error?: { message: string } };
      if (!response.ok || !body.ok || !body.data) throw new Error(body.error?.message ?? "导入失败。");
      setImportedCodeCount((count) => count + body.data!.importedCodeCount);
      setCodesText("");
      setPreview(null);
      showToast({ tone: "success", title: "核实兑换码已导入", description: `本次新增 ${body.data.importedCodeCount} 张。` });
      router.refresh();
    } catch (error) {
      showToast({ tone: "error", title: "导入失败", description: error instanceof Error ? error.message : "请稍后重试。" });
    } finally { setBusy(null); }
  }

  return <div>
    <ol className="mb-6 grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-card)] sm:grid-cols-4" aria-label="创建活动步骤">
      {steps.map((item) => {
        const activeStep = item.id === step;
        const completed = item.id < step;
        return <li key={item.id}><button type="button" onClick={() => goTo(item.id)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-3 text-left transition", activeStep ? "bg-[#fff1f0] text-[var(--brand)]" : completed ? "text-[var(--success)] hover:bg-[#effaf3]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]")} aria-current={activeStep ? "step" : undefined}><span className={cn("grid size-7 place-items-center rounded-full border text-xs font-semibold", activeStep ? "border-[var(--brand)] bg-[var(--brand)] text-white" : completed ? "border-[#b7dbc5] bg-[#effaf3] text-[var(--success)]" : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-muted)]")}>{completed ? <MaterialIcon name="check" size={17} /> : item.id}</span><span className="min-w-0 truncate text-sm font-semibold">{item.label}</span></button></li>;
      })}
    </ol>

    {step === 1 ? <BasicStep name={name} onNameChange={setName} issueNo={issueNo} target={target} onTargetChange={setTarget} minValue={minValue} onMinValueChange={setMinValue} drawMethod={drawMethod} onDrawMethodChange={setDrawMethod} drawTrigger={drawTrigger} onDrawTriggerChange={setDrawTrigger} drawDate={drawDate} onDrawDateChange={setDrawDate} drawTime={drawTime} onDrawTimeChange={setDrawTime} /> : null}
    {step === 2 ? <PrizeStep tiers={prizeTiers} prizeCount={prizeCount} openTierIds={openTierIds} onToggle={toggleTier} onUpdate={updateTier} onMove={moveTier} onRemove={removeTier} onAdd={addTier} /> : null}
    {step === 3 ? <CodeStep isEditing={isEditing} importedCodeCount={importedCodeCount} codesText={codesText} onCodesTextChange={(value) => { setCodesText(value); setPreview(null); }} preview={preview} busy={busy} onParse={() => void parseCodes()} onImport={() => void importCodes()} /> : null}
    {step === 4 ? <ReviewStep issueNo={issueNo} name={name} target={target} minValue={minValue} drawMethod={drawMethod} drawTrigger={drawTrigger} drawDate={drawDate} drawTime={drawTime} prizeTiers={prizeTiers} prizeCount={prizeCount} preview={preview} importedCodeCount={importedCodeCount} isEditing={isEditing} /> : null}

    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5"><Button type="button" variant="ghost" onClick={() => setStep((current) => Math.max(1, current - 1) as EditorStep)} disabled={step === 1 || busy !== null}><MaterialIcon name="arrow_back" size={19} />上一步</Button><div className="flex flex-wrap gap-2">{step < 4 ? <Button type="button" onClick={goNext} disabled={busy !== null}>下一步<MaterialIcon name="arrow_forward" size={19} /></Button> : <><Button type="button" variant="secondary" size="lg" onClick={() => void save("DRAFT")} disabled={busy !== null}><MaterialIcon name={busy === "draft" ? "progress_activity" : "save"} size={19} className={busy === "draft" ? "animate-spin" : ""} />{isEditing ? "保存草稿修改" : "保存为草稿"}</Button>{!isEditing ? <Button type="button" size="lg" onClick={() => void save("START")} disabled={busy !== null || !canStart}><MaterialIcon name={busy === "start" ? "progress_activity" : "play_circle"} size={20} className={busy === "start" ? "animate-spin" : ""} />创建并启动</Button> : null}</>}</div></div>
    {step === 4 && !isEditing && !canStart ? <p className="mt-3 text-right text-xs text-[var(--warning)]">创建并启动前，需要完成奖项设置并成功解析至少一张核实兑换码。</p> : null}
    <ConfirmDialog open={startConfirmationOpen} title="确认创建并立即启动？" description="活动启动后会开始接受参与，达到开奖条件后不能重新随机。" confirmLabel="确认创建并启动" danger pending={busy === "start"} onCancel={() => setStartConfirmationOpen(false)} onConfirm={() => { setStartConfirmationOpen(false); void save("START", true); }} />
  </div>;
}

function BasicStep(props: { name: string; onNameChange: (value: string) => void; issueNo: number; target: string; onTargetChange: (value: string) => void; minValue: string; onMinValueChange: (value: string) => void; drawMethod: string; onDrawMethodChange: (value: string) => void; drawTrigger: string; onDrawTriggerChange: (value: string) => void; drawDate: string; onDrawDateChange: (value: string) => void; drawTime: string; onDrawTimeChange: (value: string) => void }) {
  return <Card><CardHeader title="基本设置" /><div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"><Field label="活动名称" required><TextInput value={props.name} onChange={(event) => props.onNameChange(event.target.value)} placeholder="例如：第1期冰云抽奖" required /></Field><Field label="期号"><div className="flex h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-sm font-medium text-[var(--text-secondary)]">第 {props.issueNo} 期</div></Field><Field label="目标人数" required help="达到多少个不同邮箱后触发自动开奖。"><TextInput type="number" min="1" value={props.target} onChange={(event) => props.onTargetChange(event.target.value)} required /></Field><Field label="最低兑换码面值" required><SelectInput value={props.minValue} onChange={(event) => props.onMinValueChange(event.target.value)}>{faceValues.map((value) => <option key={value} value={value}>{value} 元</option>)}</SelectInput></Field><div className="sm:col-span-2"><p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">抽奖方式 <span className="text-[var(--brand)]">*</span></p><div className="grid gap-3 lg:grid-cols-2"><ChoiceCard selected={props.drawMethod === "FACE_VALUE_PRIORITY"} icon="payments" title="面值优先抽奖" description="同一邮箱提交的多张兑换码会累计面值，累计面值更高者优先进入中奖候选。" onClick={() => props.onDrawMethodChange("FACE_VALUE_PRIORITY")} /><ChoiceCard selected={props.drawMethod === "CODE_EQUAL"} icon="confirmation_number" title="每张兑换码等权" description="每张成功提交的兑换码都是一张抽奖票；同一邮箱中奖后不会再次中奖。" onClick={() => props.onDrawMethodChange("CODE_EQUAL")} /></div></div><div className="sm:col-span-2"><p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">开奖条件 <span className="text-[var(--brand)]">*</span></p><div className="grid gap-3 lg:grid-cols-3"><ChoiceCard selected={props.drawTrigger === "PARTICIPANT_TARGET"} icon="groups" title="满 N 个不同邮箱自动开奖" description="达到目标人数后自动开奖。" onClick={() => props.onDrawTriggerChange("PARTICIPANT_TARGET")} /><ChoiceCard selected={props.drawTrigger === "SCHEDULED"} icon="schedule" title="指定时间开奖" description="到指定日期和时间自动开奖，不要求达到目标人数。" onClick={() => props.onDrawTriggerChange("SCHEDULED")} /><ChoiceCard selected={props.drawTrigger === "MANUAL_ONLY"} icon="touch_app" title="仅管理员手动开奖" description="不会自动开奖，由管理员在活动详情中执行。" onClick={() => props.onDrawTriggerChange("MANUAL_ONLY")} /></div></div>{props.drawTrigger === "SCHEDULED" ? <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2"><Field label="开奖日期" required><TextInput type="date" value={props.drawDate} onChange={(event) => props.onDrawDateChange(event.target.value)} required /></Field><Field label="开奖时间" required><TextInput type="time" step="60" value={props.drawTime} onChange={(event) => props.onDrawTimeChange(event.target.value)} required /></Field></div> : null}</div></Card>;
}

function ChoiceCard({ selected, icon, title, description, onClick }: { selected: boolean; icon: string; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("rounded-xl border p-4 text-left transition", selected ? "border-[var(--brand)] bg-[#fff7f6] shadow-[0_0_0_3px_rgba(199,57,50,0.08)]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-muted)] hover:bg-[var(--surface-subtle)]")}><span className={cn("grid size-9 place-items-center rounded-lg", selected ? "bg-[var(--brand)] text-white" : "bg-[var(--ice)] text-[var(--info)]")}><MaterialIcon name={icon} size={20} /></span><span className="mt-3 block text-sm font-semibold text-[var(--text-primary)]">{title}</span><span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{description}</span></button>;
}

function PrizeStep({ tiers, prizeCount, openTierIds, onToggle, onUpdate, onMove, onRemove, onAdd }: { tiers: PrizeTierDraft[]; prizeCount: number; openTierIds: Set<string>; onToggle: (id: string) => void; onUpdate: (id: string, field: keyof Omit<PrizeTierDraft, "id">, value: string) => void; onMove: (index: number, direction: -1 | 1) => void; onRemove: (id: string) => void; onAdd: () => void }) {
  return <Card><CardHeader title="奖项设置" action={<Badge tone="brand">共 {prizeCount} 个中奖名额</Badge>} /><div className="space-y-3 p-5 sm:p-6">{tiers.map((tier, index) => { const count = visibleItemCount(tier.rawContents); const open = openTierIds.has(tier.id); return <article key={tier.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)]"><div className="flex items-center gap-2 p-3.5 sm:px-4"><button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={open} onClick={() => onToggle(tier.id)}><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#fff1f0] text-[var(--brand)]"><MaterialIcon name="emoji_events" size={20} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{tier.name || `奖项 ${index + 1}`}</span><span className="mt-0.5 block truncate text-xs text-[var(--text-secondary)]">{tier.publicDescription || "未填写公开展示名称"} · {count} 个名额</span></span><MaterialIcon name={open ? "expand_less" : "expand_more"} size={21} className="text-[var(--text-muted)]" /></button><div className="flex shrink-0 items-center gap-1"><SmallIconButton label="上移奖项" icon="arrow_upward" onClick={() => onMove(index, -1)} disabled={index === 0} /><SmallIconButton label="下移奖项" icon="arrow_downward" onClick={() => onMove(index, 1)} disabled={index === tiers.length - 1} /><SmallIconButton label="删除奖项" icon="delete" onClick={() => onRemove(tier.id)} disabled={tiers.length <= 1} danger /></div></div>{open ? <div className="border-t border-[var(--border-subtle)] p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="奖项名称" required><TextInput value={tier.name} onChange={(event) => onUpdate(tier.id, "name", event.target.value)} placeholder="例如：一等奖" /></Field><Field label="公开展示名称" required><TextInput value={tier.publicDescription} onChange={(event) => onUpdate(tier.id, "publicDescription", event.target.value)} placeholder="例如：100 元 AI 额度" /></Field></div><div className="mt-4"><Field label="获奖内容" required help="一行 = 一个中奖名额。"><Textarea value={tier.rawContents} onChange={(event) => onUpdate(tier.id, "rawContents", event.target.value)} placeholder={"CODE-001\nCODE-002\nCODE-003"} /></Field></div><p className="mt-3 flex items-center gap-2 text-xs leading-5 text-[var(--info)]"><MaterialIcon name="info" size={17} />获奖内容属于敏感信息，只会在管理员后台和中奖邮件中使用，公开页面不会显示。</p></div> : null}</article>; })}<Button type="button" variant="secondary" onClick={onAdd}><MaterialIcon name="add" size={19} />添加奖项</Button></div></Card>;
}

function SmallIconButton({ label, icon, onClick, disabled, danger = false }: { label: string; icon: string; onClick: () => void; disabled?: boolean; danger?: boolean }) { return <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className={cn("grid size-9 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-35", danger ? "text-[var(--danger)] hover:bg-[#fff1f0]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]")}><MaterialIcon name={icon} size={19} /></button>; }

function CodeStep({ isEditing, importedCodeCount, codesText, onCodesTextChange, preview, busy, onParse, onImport }: { isEditing: boolean; importedCodeCount: number; codesText: string; onCodesTextChange: (value: string) => void; preview: CodePreview | null; busy: string | null; onParse: () => void; onImport: () => void }) {
  const errors = preview?.errors ?? [];
  return <Card><CardHeader title={isEditing ? "追加本期核实兑换码" : "核实兑换码"} /><div className="p-5 sm:p-6"><div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]"><aside className="rounded-xl border border-[#cfe2f1] bg-[#f3faff] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[#28617f]"><MaterialIcon name="format_list_bulleted" size={20} />粘贴格式</div><pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[var(--surface)] p-3 font-mono text-xs leading-6 text-[var(--text-primary)]">{"# 1元\ncode-a\ncode-b\n\n# 5元\ncode-c"}</pre><p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">支持面值：1 / 5 / 10 / 20 / 50 / 100 元。兑换码大小写敏感，系统不会猜测兑换码长度。</p>{isEditing ? <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">本期已导入 <strong className="text-[var(--text-primary)]">{importedCodeCount}</strong> 张。</p> : null}</aside><div><Field label="兑换码文本" required><Textarea value={codesText} onChange={(event) => onCodesTextChange(event.target.value)} className="min-h-[250px] font-mono" placeholder={"# 1元\ncode-a\ncode-b\n\n# 50元\ncode-50"} spellCheck={false} /></Field><div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" variant="secondary" onClick={onParse} disabled={busy !== null || codesText.trim().length === 0}><MaterialIcon name={busy === "preview" ? "progress_activity" : "manage_search"} size={19} className={busy === "preview" ? "animate-spin" : ""} />解析并预览</Button>{isEditing && preview?.canImport ? <Button type="button" variant="dark" onClick={onImport} disabled={busy !== null}><MaterialIcon name={busy === "import" ? "progress_activity" : "upload"} size={19} className={busy === "import" ? "animate-spin" : ""} />导入已预览兑换码</Button> : null}</div></div></div>{preview ? <div className="mt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold text-[var(--text-primary)]">解析结果</h3><Badge tone={preview.canImport ? "success" : "danger"}><MaterialIcon name={preview.canImport ? "check_circle" : "error"} size={16} filled />{preview.canImport ? "解析成功" : "需要处理错误"}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{faceValues.map((faceValue) => <PreviewMetric key={faceValue} label={`${faceValue} 元`} value={preview.counts[String(faceValue)] ?? 0} />)}</div><div className="mt-3 grid gap-3 sm:grid-cols-3"><PreviewMetric label="总计" value={preview.total} emphasis /><PreviewMetric label="错误" value={errors.length} tone={errors.length ? "danger" : "success"} /><PreviewMetric label="警告" value={preview.whitespaceRiskCount} tone={preview.whitespaceRiskCount ? "warning" : "success"} /></div>{errors.length > 0 ? <div className="mt-4 rounded-xl border border-[#efcbc8] bg-[#fff2f1] p-4 text-sm text-[var(--danger)]"><div className="flex items-center gap-2 font-semibold"><MaterialIcon name="error" size={20} filled />请先处理下列错误</div><ul className="mt-3 space-y-1.5 leading-6">{errors.slice(0, 12).map((issue, index) => <li key={`${issue.code}-${issue.line ?? index}`}>{issue.line ? `第 ${issue.line} 行：` : ""}{codeIssueLabel(issue.code)}</li>)}</ul>{errors.length > 12 ? <p className="mt-2 text-xs">还有 {errors.length - 12} 项错误未显示。</p> : null}</div> : null}{preview.whitespaceRiskCount > 0 ? <p className="mt-4 flex items-center gap-2 text-xs leading-5 text-[var(--warning)]"><MaterialIcon name="warning" size={17} />发现 {preview.whitespaceRiskCount} 行首尾空白，保存时会按规则去除。</p> : null}</div> : null}</div></Card>;
}

function PreviewMetric({ label, value, tone = "neutral", emphasis = false }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger"; emphasis?: boolean }) { const colors = { neutral: "text-[var(--text-primary)]", success: "text-[var(--success)]", warning: "text-[var(--warning)]", danger: "text-[var(--danger)]" }; return <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-3"><p className="text-xs text-[var(--text-muted)]">{label}</p><p className={cn("mt-1 text-lg font-semibold", colors[tone], emphasis && "text-xl")}>{value.toLocaleString("zh-CN")}</p></div>; }

function ReviewStep({ issueNo, name, target, minValue, drawMethod, drawTrigger, drawDate, drawTime, prizeTiers, prizeCount, preview, importedCodeCount, isEditing }: { issueNo: number; name: string; target: string; minValue: string; drawMethod: string; drawTrigger: string; drawDate: string; drawTime: string; prizeTiers: PrizeTierDraft[]; prizeCount: number; preview: CodePreview | null; importedCodeCount: number; isEditing: boolean }) {
  const trigger = drawTrigger === "PARTICIPANT_TARGET" ? `满 ${target || "-"} 个不同邮箱自动开奖` : drawTrigger === "SCHEDULED" ? `指定时间：${formatScheduledValue(drawDate, drawTime)}` : "仅管理员手动开奖";
  const codeTotal = isEditing ? importedCodeCount + (preview?.importableTotal ?? 0) : preview?.importableTotal ?? 0;
  return <Card><CardHeader title={isEditing ? "确认草稿修改" : "确认发布"} /><div className="space-y-5 p-5 sm:p-6"><div><p className="text-xs font-semibold text-[var(--brand)]">第 {issueNo} 期</p><h2 className="mt-1.5 text-xl font-semibold text-[var(--text-primary)]">{name || "未填写活动名称"}</h2></div><dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2"><ReviewItem label="抽奖方式" value={drawMethod === "FACE_VALUE_PRIORITY" ? "面值优先抽奖" : "每张兑换码等权"} /><ReviewItem label="开奖条件" value={trigger} /><ReviewItem label="最低兑换码面值" value={`${minValue || "-"} 元`} /><ReviewItem label="核实兑换码" value={`${codeTotal.toLocaleString("zh-CN")} 张`} /></dl><div className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-[var(--text-primary)]">奖项</h3><Badge tone="brand">共 {prizeCount} 个中奖名额</Badge></div><div className="mt-3 divide-y divide-[var(--border-subtle)]">{prizeTiers.map((tier) => <div key={tier.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-semibold text-[var(--text-primary)]">{tier.name || "未命名奖项"}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{tier.publicDescription || "未填写公开展示名称"}</p></div><span className="text-sm font-medium text-[var(--text-secondary)]">{visibleItemCount(tier.rawContents)} 人</span></div>)}</div></div></div></Card>;
}

function ReviewItem({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-[var(--text-muted)]">{label}</dt><dd className="mt-1 text-sm font-semibold leading-6 text-[var(--text-primary)]">{value}</dd></div>; }
