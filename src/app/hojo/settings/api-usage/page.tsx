import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { checkDailyApiCostLimit } from "@/lib/hojo/api-cost-limit";
import { ApiUsageClient } from "./api-usage-client";

export default async function HojoApiUsagePage() {
  const session = await auth();
  const canEdit =
    session?.user?.userType === "staff" &&
    canEditProjectMasterDataSync(session?.user, "hojo");
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
