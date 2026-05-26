import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { ApplicationBpoTable, type ApplicationBpoRow } from "./application-bpo-table";
import type { ApplicationBpoAttachments } from "@/lib/hojo/application-bpo-fields";

function dateOnly(value: Date | null) {
  return value ? value.toISOString().split("T")[0] : "";
}

export default async function ApplicationBpoPage() {
  const session = await auth();
  const canEdit =
    session?.user?.userType === "staff" &&
    canEditProjectMasterDataSync(session?.user, "hojo");

  const records = await prisma.hojoApplicationBpoRequest.findMany({
    where: { deletedAt: null },
    include: { vendor: { select: { name: true } } },
    orderBy: [{ id: "asc" }],
  });

  const data: ApplicationBpoRow[] = records.map((record) => ({
    id: record.id,
    vendorId: record.vendorId,
    vendorName: record.vendor.name,
    vendorCustomerNo: record.vendorCustomerNo,
    requestDate: dateOnly(record.requestDate),
    doubleCheckStatus: record.doubleCheckStatus ?? "",
    scheduledAt: record.scheduledAt ?? "",
    companyName: record.companyName ?? "",
    applicantType: record.applicantType ?? "",
    repeatType: record.repeatType ?? "",
    wageIncreaseAvailability: record.wageIncreaseAvailability ?? "",
    completionDate: dateOnly(record.completionDate),
    nextAction: record.nextAction ?? "",
    vendorInput: (record.vendorInput as Record<string, unknown> | null) ?? {},
    staffInput: (record.staffInput as Record<string, unknown> | null) ?? {},
    attachments: (record.attachments as ApplicationBpoAttachments | null) ?? {},
    staffMemo: record.staffMemo ?? "",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">申請BPO管理</h1>
      {canEdit ? (
        <ApplicationBpoTable data={data} mode="staff" />
      ) : (
        <div className="rounded-md border bg-white p-6 text-sm text-muted-foreground">
          補助金の編集権限が必要です。
        </div>
      )}
    </div>
  );
}
