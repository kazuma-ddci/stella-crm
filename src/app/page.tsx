import { auth } from "@/auth";
import { canView } from "@/lib/auth/permissions";
import type { ProjectCode, UserPermission } from "@/types/auth";
import { redirect } from "next/navigation";

const DEFAULT_PROJECT_ROUTES: Array<{ projectCode: ProjectCode; href: string }> = [
  { projectCode: "stp", href: "/stp/new-dashboard" },
  { projectCode: "slp", href: "/slp/dashboard" },
  { projectCode: "hojo", href: "/hojo/applicant-info" },
  { projectCode: "accounting", href: "/accounting" },
];

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;
  const permissions = (user.permissions ?? []) as UserPermission[];
  const isAdminUser = user.loginId === "admin";
  const isFounder = user.organizationRole === "founder";

  if (isAdminUser || isFounder) {
    redirect("/stp/new-dashboard");
  }

  const defaultRoute = DEFAULT_PROJECT_ROUTES.find(({ projectCode }) =>
    canView(permissions, projectCode)
  );

  redirect(defaultRoute?.href ?? "/notifications");
}
