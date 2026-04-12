import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";
import { ContractsTable } from "./contracts-table";
import type { CloudsignInputData } from "@/components/cloudsign-input-section";

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

  const [contracts, statuses, contractTypes] = await Promise.all([
    prisma.masterContract.findMany({
      where: { projectId: slpProject.id },
      include: {
        currentStatus: true,
        slpMember: {
          select: { id: true, name: true, email: true, uid: true, reminderExcluded: true },
        },
        contractFiles: {
          select: { id: true, filePath: true, fileName: true },
        },
        statusHistories: {
          include: {
            fromStatus: { select: { name: true } },
            toStatus: { select: { name: true } },
          },
          orderBy: { recordedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.masterContractStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.contractType.findMany({
      where: { projectId: slpProject.id, isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows = contracts.map((c) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    contractType: c.contractType,
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
    // ソート用のISO文字列(クライアント側で日付比較するため)
    sentAtRaw: c.cloudsignSentAt?.toISOString() ?? null,
    completedAtRaw: c.cloudsignCompletedAt?.toISOString() ?? null,
    signedDateRaw: c.signedDate?.toISOString() ?? null,
    lastRemindedAtRaw: c.cloudsignLastRemindedAt?.toISOString() ?? null,
    createdAtRaw: c.createdAt.toISOString(),
    filePath: c.filePath,
    fileName: c.fileName,
    note: c.note,
    createdAt: formatDateTime(c.createdAt),
    cloudsignInputData: (c.cloudsignInputData as CloudsignInputData | null) ?? null,
    contractFiles: c.contractFiles.map((f) => ({
      id: f.id,
      filePath: f.filePath,
      fileName: f.fileName,
    })),
    statusHistories: c.statusHistories.map((h) => ({
      id: h.id,
      eventType: h.eventType,
      fromStatusName: h.fromStatus?.name ?? null,
      toStatusName: h.toStatus?.name ?? null,
      changedBy: h.changedBy,
      note: h.note,
      recordedAt: formatDateTime(h.recordedAt),
    })),
  }));

  const statusOptions = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    statusType: s.statusType as "progress" | "signed" | "discarded",
  }));

  // 契約種別フィルタ用: マスタ + 既存契約書に登場する種別文字列のユニオン
  const masterTypeNames = new Set(contractTypes.map((t) => t.name));
  const contractTypeNames = new Set<string>(masterTypeNames);
  for (const c of contracts) {
    if (c.contractType) contractTypeNames.add(c.contractType);
  }
  const contractTypeFilterOptions = Array.from(contractTypeNames).sort();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">契約書管理</h1>
      <ContractsTable
        rows={rows}
        statusOptions={statusOptions}
        contractTypeOptions={contractTypeFilterOptions}
      />
    </div>
  );
}
