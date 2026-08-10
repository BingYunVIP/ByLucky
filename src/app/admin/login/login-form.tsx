"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/icon";

type LoginFormProps = { nextPath: string };
type ApiErrorResponse = { ok: false; error: { code: string; message: string } };

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); setSubmitting(true); const formData = new FormData(event.currentTarget); try { const response = await fetch("/api/admin/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: formData.get("username"), password: formData.get("password") }) }); const payload = await response.json() as ApiErrorResponse | { ok: true }; if (!response.ok || !payload.ok) { setError("error" in payload ? payload.error.message : "登录失败，请稍后重试。"); return; } router.replace(nextPath); router.refresh(); } catch { setError("无法连接服务器，请检查网络后重试。"); } finally { setSubmitting(false); } }
  return <form className="space-y-5" onSubmit={handleSubmit}><label className="block"><span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">管理员账号</span><span className="relative block"><MaterialIcon name="person" size={19} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(199,57,50,0.10)]" name="username" type="text" autoComplete="username" required maxLength={128} /></span></label><label className="block"><span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">密码</span><span className="relative block"><MaterialIcon name="lock" size={19} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white pl-10 pr-11 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[rgba(199,57,50,0.10)]" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={1024} /><button className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "隐藏密码" : "显示密码"} title={showPassword ? "隐藏密码" : "显示密码"}><MaterialIcon name={showPassword ? "visibility_off" : "visibility"} size={19} /></button></span></label>{error ? <div className="flex items-start gap-2 rounded-xl border border-[#efcbc8] bg-[#fff2f1] px-4 py-3 text-sm leading-6 text-[var(--danger)]" role="alert"><MaterialIcon name="error" size={19} filled />{error}</div> : null}<Button className="w-full" size="lg" type="submit" disabled={submitting}>{submitting ? <MaterialIcon name="progress_activity" size={19} className="animate-spin" /> : <MaterialIcon name="login" size={19} />} {submitting ? "正在登录…" : "登录后台"}</Button></form>;
}
