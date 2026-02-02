import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractsTable } from "./contracts-table";

export default async function StpContractsPage() {
  const STP_PROJECT_ID = 1; // 採用ブースト

  const [contracts, companies, statuses, staffProjectAssignments] = await Promise.all([
    prisma.masterContract.findMany({
      where: { projectId: STP_PROJECT_ID },
      include: {
        company: true,
        currentStatus: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.masterStellaCompany.findMany({
      orderBy: { companyCode: "desc" },
    }),
    prisma.masterContractStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.staffProjectAssignment.findMany({
      where: { projectId: STP_PROJECT_ID },
      include: { staff: true },
    }),
  ]);

  // スタッフIDから名前を取得するマップを作成
  const staffMap = new Map(
    staffProjectAssignments.map((a) => [String(a.staff.id), a.staff.name])
  );

  const data = contracts.map((c) => ({
    id: c.id,
    companyId: c.companyId,
    companyName: `（${c.companyId}）${c.company.name}`,
    contractType: c.contractType,
    title: c.title,
    contractNumber: c.contractNumber,
    startDate: c.startDate?.toISOString().split("T")[0] || null,
    endDate: c.endDate?.toISOString().split("T")[0] || null,
    currentStatusId: c.currentStatusId,
    currentStatusName: c.currentStatus?.name || null,
    targetDate: c.targetDate?.toISOString().split("T")[0] || null,
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
  }));

  const companyOptions = companies.map((c) => ({
    value: String(c.id),
    label: `${c.companyCode} - ${c.name}`,
  }));

  const statusOptions = statuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const staffOptions = staffProjectAssignments
    .filter((a) => a.staff.isActive)
    .map((a) => ({
      value: String(a.staff.id),
      label: a.staff.name,
    }));

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
          />
        </CardContent>
      </Card>
    </div>
  );
}
