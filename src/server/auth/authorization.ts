import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentAdminSession } from "@/server/auth/session";

export const requireAdminPageSession = cache(async () => {
  const session = await getCurrentAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
});
