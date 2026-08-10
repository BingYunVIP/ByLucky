import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { getCurrentAdminSession } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: { absolute: "管理员登录 - 冰云抽奖" } };

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

function getSafeNextPath(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    candidate &&
    candidate.startsWith("/admin") &&
    !candidate.startsWith("//") &&
    candidate !== "/admin/login"
  ) {
    return candidate;
  }
  return "/admin";
}

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const session = await getCurrentAdminSession();
  const nextPath = getSafeNextPath((await searchParams).next);

  if (session) {
    redirect(nextPath);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10">
      <section className="w-full max-w-[440px] rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[0_18px_48px_rgba(23,36,45,0.10)] sm:p-8">
        <BrandMark />
        <div className="mb-7 mt-9">
          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--brand)]">管理后台</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight text-[var(--text-primary)]">管理员登录</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">使用系统管理员账号继续管理 ByLucky 活动。</p>
        </div>
        <LoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}
