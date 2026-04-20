import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import { checkDailyApiCostLimit } from "@/lib/hojo/api-cost-limit";
import { ApiUsageClient } from "./api-usage-client";

export default async function HojoApiUsagePage() {
  const session = await auth();
  const userPermissions = (session?.user?.permissions ?? []) as UserPermission[];
  const canEdit = session?.user?.userType === "staff" && canEditProject(userPermissions, "hojo");
  if (!canEdit) redirect("/hojo");

  const status = await checkDailyApiCostLimit();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Claude API 費用管理</h1>
      <ApiUsageClient
        dailyUsageYen={status.dailyUsageYen}
        dailyUsageUsd={status.dailyUsageUsd}
        limitYen={status.limitYen}
        overridden={status.overridden}
        overriddenAt={status.overriddenAt?.toISOString() ?? null}
        overriddenByName={status.overriddenByName}
      />
    </div>
  );
}
