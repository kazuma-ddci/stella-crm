import { getSession, isAdmin, isFounder, isSystemAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EmailSettingsClient } from "./email-settings-client";
import { getProjectEmails, getProjects } from "./actions";

export default async function EmailSettingsPage() {
  const user = await getSession();

  // 管理者権限チェック（ファウンダー/システム管理者 or いずれかのプロジェクトでmanager以上）
  const hasAdmin =
    isSystemAdmin(user) ||
    isFounder(user) ||
    isAdmin(user.permissions, "stella") ||
    isAdmin(user.permissions, "stp");

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
