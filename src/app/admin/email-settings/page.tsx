import { getSession, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EmailSettingsClient } from "./email-settings-client";
import { getProjectEmails, getProjects } from "./actions";

export default async function EmailSettingsPage() {
  const user = await getSession();

  // 管理者権限チェック（いずれかのプロジェクトでadmin）
  const hasAdmin =
    isAdmin(user.permissions, "stella") ||
    isAdmin(user.permissions, "stp") ||
    isAdmin(user.permissions, "common");

  if (!hasAdmin) {
    redirect("/");
  }

  const [projectEmails, projects] = await Promise.all([
    getProjectEmails(),
    getProjects(),
  ]);

  return (
    <EmailSettingsClient
      initialProjectEmails={projectEmails}
      projects={projects}
      isSystemAdmin={user.loginId === "admin"}
    />
  );
}
