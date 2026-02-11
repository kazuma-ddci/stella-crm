import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractsTable } from "./contracts-table";
import { TERMINAL_STATUS_IDS, SENT_STATUS_ID, STALE_ALERT_DAYS } from "@/lib/contract-status/constants";
import { ContractRowWithProgress } from "@/lib/contract-status/types";

export default async function StpContractsPage() {
  const STP_PROJECT_ID = 1; // 採用ブースト

  const [contracts, companies, statuses, staffProjectAssignments, contractHistories] = await Promise.all([
    prisma.masterContract.findMany({
      where: { projectId: STP_PROJECT_ID },
      include: {
        company: true,
        currentStatus: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.masterStellaCompany.findMany({
      orderBy: { id: "desc" },
    }),
    prisma.masterContractStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.staffProjectAssignment.findMany({
      where: { projectId: STP_PROJECT_ID },
      include: { staff: true },
    }),
    // 各契約書の最新履歴を取得（滞在日数計算用）
    prisma.masterContractStatusHistory.findMany({
      orderBy: { recordedAt: "desc" },
      distinct: ["contractId"],
    }),
  ]);

  // スタッフIDから名前を取得するマップを作成
  const staffMap = new Map(
    staffProjectAssignments.map((a) => [String(a.staff.id), a.staff.name])
  );

  // 契約書IDから最新履歴日時のマップを作成
  const latestHistoryMap = new Map(
    contractHistories.map((h) => [h.contractId, h.recordedAt])
  );

  // 滞在日数を計算する関数
  const calculateDaysSinceStatusChange = (contractId: number): number | null => {
    const lastRecordedAt = latestHistoryMap.get(contractId);
    if (!lastRecordedAt) return null;

    const now = new Date();
    const recordedAt = new Date(lastRecordedAt);
    const diffTime = Math.abs(now.getTime() - recordedAt.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const data: ContractRowWithProgress[] = contracts.map((c) => {
    const daysSinceStatusChange = calculateDaysSinceStatusChange(c.id);
    const hasStaleAlert =
      c.currentStatusId === SENT_STATUS_ID &&
      daysSinceStatusChange !== null &&
      daysSinceStatusChange >= STALE_ALERT_DAYS;

    return {
      id: c.id,
      companyId: c.companyId,
      companyCode: c.company.companyCode,
      companyName: c.company.name,
      contractType: c.contractType,
      title: c.title,
      contractNumber: c.contractNumber,
      startDate: c.startDate?.toISOString().split("T")[0] || null,
      endDate: c.endDate?.toISOString().split("T")[0] || null,
      currentStatusId: c.currentStatusId,
      currentStatusName: c.currentStatus?.name || null,
      currentStatusDisplayOrder: c.currentStatus?.displayOrder ?? null,
      currentStatusIsTerminal: c.currentStatus?.isTerminal ?? false,
      signedDate: c.signedDate?.toISOString().split("T")[0] || null,
      signingMethod: c.signingMethod,
      filePath: c.filePath,
      fileName: c.fileName,
      assignedTo: c.assignedTo,
      assignedToName: c.assignedTo
        ? c.assignedTo
            .split(",")
            .map((id) => staffMap.get(id.trim()))
            .filter(Boolean)
            .join(", ")
        : null,
      note: c.note,
      createdAt: c.createdAt.toISOString().split("T")[0],
      updatedAt: c.updatedAt.toISOString().split("T")[0],
      daysSinceStatusChange,
      hasStaleAlert,
    };
  });

  const companyOptions = companies.map((c) => ({
    value: String(c.id),
    label: `${c.companyCode} ${c.name}`,
  }));

  const statusOptions = statuses.map((s) => ({
    value: String(s.id),
    label: s.name,
    isTerminal: s.isTerminal,
    displayOrder: s.displayOrder,
  }));

  const staffOptions = staffProjectAssignments
    .filter((a) => a.staff.isActive)
    .map((a) => ({
      value: String(a.staff.id),
      label: a.staff.name,
    }));

  // タブごとのカウント
  const inProgressCount = data.filter(
    (c) => !c.currentStatusIsTerminal
  ).length;
  const signedCount = data.filter(
    (c) => c.currentStatusId === TERMINAL_STATUS_IDS.SIGNED
  ).length;
  const discardedCount = data.filter(
    (c) => c.currentStatusId === TERMINAL_STATUS_IDS.DISCARDED
  ).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">STP 契約書情報</h1>
      <Card>
        <CardHeader>
          <CardTitle>契約書一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractsTable
            data={data}
            companyOptions={companyOptions}
            statusOptions={statusOptions}
            staffOptions={staffOptions}
            tabCounts={{
              inProgress: inProgressCount,
              signed: signedCount,
              discarded: discardedCount,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
