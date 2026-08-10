import { redirect } from "next/navigation";

export default function EmailRulesPage() {
  redirect("/admin/email?tab=rules");
}
