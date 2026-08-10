"use client";

import { useRef, useState } from "react";
import { usePublicPreferences } from "@/components/public-preferences";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form";
import { MaterialIcon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

type CampaignSummary = { id: string; issueNo: number; name: string; targetUniqueEmails: number; currentUniqueEmails: number; status: string };
type ErrorKind = "email" | "domain" | "code" | "rate" | "inactive" | "generic" | null;

function resultCodeLabel(count: number, locale: "zh" | "en") {
  return locale === "zh" ? `${count} 张兑换码` : `${count} code${count === 1 ? "" : "s"}`;
}

function resultValueLabel(value: number, locale: "zh" | "en") {
  return locale === "zh" ? `${value} 元` : `${value} yuan`;
}

export function ParticipationForm({ campaign, disabled = false, onParticipantCountChange }: { campaign: CampaignSummary | null; disabled?: boolean; onParticipantCountChange?: (value: number) => void }) {
  const { locale, copy } = usePublicPreferences();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorKind>(null);
  const [result, setResult] = useState<{ codeCount: number; totalFaceValue: number; participantCount: number; lockedForDraw: boolean } | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const inactive = disabled || !campaign;

  function errorMessage(kind: Exclude<ErrorKind, null>) {
    if (kind === "email") return copy.invalidEmail;
    if (kind === "domain") return copy.emailDomainNotAllowed;
    if (kind === "rate") return copy.tooManyRequests;
    if (kind === "inactive") return copy.noActiveCampaign;
    if (kind === "generic") return copy.joinFailed;
    return copy.invalidCode;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaign || inactive) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/participate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code }) });
      const payload = await response.json() as { ok: boolean; data?: { codeCount: number; totalFaceValue: number; participantCount: number; lockedForDraw: boolean }; error?: { code?: string; message?: string } };
      if (!response.ok || !payload.ok || !payload.data) {
        const errorCode = payload.error?.code ?? "";
        if (errorCode === "EMAIL_DOMAIN_NOT_ALLOWED") setError("domain");
        else if (errorCode.startsWith("EMAIL_") || errorCode === "INVALID_EMAIL") setError("email");
        else if (errorCode === "RATE_LIMITED") setError("rate");
        else if (errorCode === "NO_ACTIVE_CAMPAIGN" || errorCode === "CAMPAIGN_CLOSED") setError("inactive");
        else setError("code");
        return;
      }
      setResult(payload.data);
      setCode("");
      onParticipantCountChange?.(payload.data.participantCount);
      showToast({ tone: "success", title: copy.joinSuccess });
    } catch {
      setError("generic");
    } finally {
      setPending(false);
    }
  }

  return <section aria-label={copy.joinTitle}>
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
      <Field label={copy.email} required error={error === "email" || error === "domain" ? errorMessage(error) : undefined}>
        <TextInput value={email} onChange={(event) => { setEmail(event.target.value); setError(null); }} type="email" autoComplete="email" required maxLength={320} disabled={inactive || pending} placeholder={copy.emailPlaceholder} />
      </Field>
      <Field label={copy.code} required error={error === "code" ? errorMessage("code") : undefined}>
        <TextInput ref={codeRef} value={code} onChange={(event) => { setCode(event.target.value); setError(null); }} type="text" required disabled={inactive || pending} className="font-mono" placeholder={copy.codePlaceholder} spellCheck={false} />
      </Field>
      <Button type="submit" size="lg" disabled={inactive || pending} className="w-full md:w-auto">
        <MaterialIcon name={pending ? "progress_activity" : "auto_awesome"} size={20} className={pending ? "animate-spin" : ""} />
        {pending ? copy.joining : inactive ? copy.unavailable : copy.joinNow}
      </Button>
    </form>

    {error ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--toast-error-border)] bg-[var(--toast-error-bg)] px-4 py-3 text-sm text-[var(--danger)]" role="alert"><span className="flex items-center gap-2"><MaterialIcon name="error" size={19} filled />{errorMessage(error)}</span><button type="button" className="text-xs font-semibold underline underline-offset-4" onClick={() => { setError(null); codeRef.current?.focus(); }}>{locale === "zh" ? "重新输入" : "Try again"}</button></div> : null}

    {result ? <div className="mt-5 rounded-xl border border-[var(--toast-success-border)] bg-[var(--toast-success-bg)] p-4 sm:p-5" role="status">
      <div className="flex items-center gap-2 text-[var(--success)]"><MaterialIcon name="check_circle" size={21} filled /><p className="font-semibold">{copy.joinSuccess}</p></div>
      <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{email}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Summary label={copy.submittedCodes} value={resultCodeLabel(result.codeCount, locale)} />
        <Summary label={copy.totalValue} value={resultValueLabel(result.totalFaceValue, locale)} />
        <Summary label={copy.currentProgress} value={`${result.participantCount} / ${campaign?.targetUniqueEmails ?? "—"}`} />
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{copy.continueHint}</p>
      {result.lockedForDraw ? <p className="mt-2 text-sm font-medium text-[var(--warning)]">{copy.waitingForDraw}</p> : null}
      <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => { setResult(null); setError(null); window.setTimeout(() => codeRef.current?.focus(), 0); }}><MaterialIcon name="add" size={18} />{copy.continueAdd}</Button>
    </div> : null}
  </section>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[var(--toast-success-border)] bg-[var(--surface)] px-3 py-3"><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</p></div>;
}
