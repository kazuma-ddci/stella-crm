import { prisma } from "@/lib/prisma";
import { toLocalDateString } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractsTable } from "./contracts-table";
import { STALE_ALERT_DAYS, STALE_CHECK_CLOUDSIGN_MAPPING, getProgressStatusCount } from "@/lib/contract-status/constants";
import { ContractRowWithProgress, ContractStatusType } from "@/lib/contract-status/types";
import { getStaffOptionsByField } from "@/lib/staff/get-staff-by-field";

export default async function StpContractsPage() {
  const STP_PROJECT_ID = 1; // 採用ブースト

  const [contracts, contractHistories, statusRecords] = await Promise.all([
    prisma.masterContract.findMany({
      where: { projectId: STP_PROJECT_ID },
      include: {
        company: true,
        currentStatus: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    // 各契約書の最新履歴を取得（滞在日数計算用）
    prisma.masterContractStatusHistory.findMany({
      orderBy: { recordedAt: "desc" },
      distinct: ["contractId"],
    }),
    // ステータスマスタ取得（進行中ステータス数の動的計算用）
    prisma.masterContractStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const staffOptions = await getStaffOptionsByField("CONTRACT_ASSIGNED_TO");

  // スタッフIDから名前を取得するマップを作成
  const staffMap = new Map(
    staffOptions.map((o) => [o.value, o.label])
  );

  // 契約書IDから最新履歴日時のマップを作成
  const latestHistoryMap = new Map(
    contractHistories.map((h) => [h.contractId, h.recordedAt])
  );

  // 進行中ステータスの数を動的に計算
  const progressStatusCount = getProgressStatusCount(
    statusRecords.map((s) => ({
      id: s.id,
      name: s.name,
      displayOrder: s.displayOrder,
      isTerminal: s.isTerminal,
      statusType: s.statusType as ContractStatusType,
      isActive: s.isActive,
    }))
  );

  // ステータスIDからcloudsignStatusMappingのマップ
  const statusMappingMap = new Map(
    statusRecords.map((s) => [s.id, s.cloudsignStatusMapping])
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
    const cloudsignMapping = c.currentStatusId ? statusMappingMap.get(c.currentStatusId) : null;
    const hasStaleAlert =
      cloudsignMapping === STALE_CHECK_CLOUDSIGN_MAPPING &&
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
      startDate: c.startDate ? toLocalDateString(c.startDate) : null,
      endDate: c.endDate ? toLocalDateString(c.endDate) : null,
      currentStatusId: c.currentStatusId,
      currentStatusName: c.currentStatus?.name || null,
      currentStatusDisplayOrder: c.currentStatus?.displayOrder ?? null,
      currentStatusIsTerminal: c.currentStatus?.isTerminal ?? false,
      currentStatusType: (c.currentStatus?.statusType as ContractStatusType) ?? null,
      signedDate: c.signedDate ? toLocalDateString(c.signedDate) : null,
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
      createdAt: toLocalDateString(c.createdAt),
      updatedAt: toLocalDateString(c.updatedAt),
      daysSinceStatusChange,
      hasStaleAlert,
    };
  });

  // タブごとのカウント（statusTypeベース）
  const inProgressCount = data.filter(
    (c) => c.currentStatusType === "progress" || c.currentStatusType === "pending" || (!c.currentStatusType && !c.currentStatusIsTerminal)
  ).length;
  const signedCount = data.filter(
    (c) => c.currentStatusType === "signed"
  ).length;
  const discardedCount = data.filter(
    (c) => c.currentStatusType === "discarded"
  ).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">STP 契約書進捗</h1>
      <Card>
        <CardHeader>
          <CardTitle>契約書進捗一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractsTable
            data={data}
            tabCounts={{
              inProgress: inProgressCount,
              signed: signedCount,
              discarded: discardedCount,
            }}
            progressStatusCount={progressStatusCount}
          />
        </CardContent>
      </Card>
    </div>
  );
}
