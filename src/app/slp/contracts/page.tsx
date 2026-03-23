import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";
import { ContractsTable } from "./contracts-table";

function formatDate(date: Date | null): string {
  if (!date) return "-";
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateTime(date: Date | null): string {
  if (!date) return "-";
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default async function SlpContractsPage() {
  const session = await auth();
  const user = session?.user;

  if (!canEditProjectMasterDataSync(user, "slp")) {
    redirect("/slp/dashboard");
  }

  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });

  if (!slpProject) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">契約書管理</h1>
        <p className="text-muted-foreground">SLPプロジェクトが見つかりません。</p>
      </div>
    );
  }

  const [contracts, statuses] = await Promise.all([
    prisma.masterContract.findMany({
      where: { projectId: slpProject.id },
      include: {
        currentStatus: true,
        slpMember: {
          select: { id: true, name: true, email: true, uid: true, reminderExcluded: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.masterContractStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const rows = contracts.map((c) => ({
    id: c.id,
    memberName: c.slpMember?.name ?? "-",
    memberEmail: c.slpMember?.email ?? "-",
    title: c.title,
    statusName: c.currentStatus?.name ?? "-",
    statusType: (c.currentStatus?.statusType ?? "progress") as "progress" | "signed" | "discarded",
    cloudsignStatus: c.cloudsignStatus,
    cloudsignAutoSync: c.cloudsignAutoSync,
    cloudsignDocumentId: c.cloudsignDocumentId,
    cloudsignUrl: c.cloudsignUrl,
    sentAt: formatDateTime(c.cloudsignSentAt),
    completedAt: formatDateTime(c.cloudsignCompletedAt),
    signedDate: formatDate(c.signedDate),
    lastRemindedAt: formatDateTime(c.cloudsignLastRemindedAt),
    filePath: c.filePath,
    fileName: c.fileName,
    note: c.note,
    createdAt: formatDateTime(c.createdAt),
  }));

  const statusOptions = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    statusType: s.statusType as "progress" | "signed" | "discarded",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">契約書管理</h1>
      <ContractsTable rows={rows} statusOptions={statusOptions} />
    </div>
  );
}
