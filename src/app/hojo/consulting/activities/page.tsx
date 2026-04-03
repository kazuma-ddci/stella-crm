import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivitiesTable } from "./activities-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function ConsultingActivitiesPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const [activities, vendors, contracts] = await Promise.all([
    prisma.hojoConsultingActivity.findMany({
      where: { deletedAt: null },
      include: {
        vendor: { select: { id: true, name: true } },
        contract: { select: { id: true, companyName: true, contractPlan: true } },
      },
      orderBy: { activityDate: "desc" },
    }),
    prisma.hojoVendor.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.hojoConsultingContract.findMany({
      where: { deletedAt: null },
      orderBy: { id: "desc" },
      select: { id: true, companyName: true, contractPlan: true, vendorId: true },
    }),
  ]);

  const vendorOptions = vendors.map((v) => ({
    value: String(v.id),
    label: v.name,
  }));

  const contractOptions = contracts.map((c) => ({
    value: String(c.id),
    label: `${c.companyName}${c.contractPlan ? ` (${c.contractPlan})` : ""}`,
  }));

  const data = activities.map((a) => ({
    id: a.id,
    vendorId: String(a.vendorId),
    vendorName: a.vendor.name,
    contractId: a.contractId ? String(a.contractId) : "",
    contractLabel: a.contract
      ? `${a.contract.companyName}${a.contract.contractPlan ? ` (${a.contract.contractPlan})` : ""}`
      : "",
    activityDate: a.activityDate.toISOString().split("T")[0],
    contactMethod: a.contactMethod ?? "",
    vendorIssue: a.vendorIssue ?? "",
    hearingContent: a.hearingContent ?? "",
    responseContent: a.responseContent ?? "",
    proposalContent: a.proposalContent ?? "",
    vendorNextAction: a.vendorNextAction ?? "",
    nextDeadline: a.nextDeadline?.toISOString().split("T")[0] ?? "",
    vendorTask: a.vendorTask ?? "",
    vendorTaskDeadline: a.vendorTaskDeadline?.toISOString().split("T")[0] ?? "",
    vendorTaskPriority: a.vendorTaskPriority ?? "",
    vendorTaskCompleted: a.vendorTaskCompleted,
    supportTask: a.supportTask ?? "",
    supportTaskDeadline: a.supportTaskDeadline?.toISOString().split("T")[0] ?? "",
    supportTaskPriority: a.supportTaskPriority ?? "",
    supportTaskCompleted: a.supportTaskCompleted,
    attachmentUrl: a.attachmentUrl ?? "",
    recordingUrl: a.recordingUrl ?? "",
    screenshotUrl: a.screenshotUrl ?? "",
    notes: a.notes ?? "",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">コンサル/BPO 活動記録</h1>
      <Card>
        <CardHeader>
          <CardTitle>活動記録一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivitiesTable
            data={data}
            canEdit={canEdit}
            vendorOptions={vendorOptions}
            contractOptions={contractOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
