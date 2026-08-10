import { AdminSidebar } from "@/components/admin-sidebar";
import { requireAdminPageSession } from "@/server/auth/authorization";

export default async function ProtectedAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdminPageSession();

  return (
    <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <AdminSidebar />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
