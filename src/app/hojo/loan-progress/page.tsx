import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import { LoanProgressTable } from "./loan-progress-table";
import { LenderShareableUrlCard } from "@/components/lender-shareable-url-card";

export default async function HojoLoanProgressPage() {
  const session = await auth();
  const userPermissions = (session?.user?.permissions ?? []) as UserPermission[];
  const canEdit = canEditProject(userPermissions, "hojo");

  const allProgress = await prisma.hojoLoanProgress.findMany({
    where: { deletedAt: null },
    include: {
      vendor: { select: { id: true, name: true } },
      status: { select: { name: true } },
    },
    orderBy: { id: "desc" },
  });

  // Compute vendorNo: position within same vendor's records (sorted by id asc, 1-indexed)
  const vendorRecordsMap = new Map<number, number[]>();
  // Collect all record ids per vendor, sorted by id asc
  const sortedByIdAsc = [...allProgress].sort((a, b) => a.id - b.id);
  for (const record of sortedByIdAsc) {
    const ids = vendorRecordsMap.get(record.vendorId) ?? [];
    ids.push(record.id);
    vendorRecordsMap.set(record.vendorId, ids);
  }
  // Map record id -> vendorNo
  const vendorNoMap = new Map<number, number>();
  for (const [, ids] of vendorRecordsMap) {
    ids.forEach((id, idx) => {
      vendorNoMap.set(id, idx + 1);
    });
  }

  const serialized = allProgress.map((p) => ({
    id: p.id,
    vendorName: p.vendor?.name ?? "",
    vendorNo: vendorNoMap.get(p.id) ?? 0,
    requestDate: p.requestDate?.toISOString() ?? null,
    companyName: p.companyName ?? "",
    representName: p.representName ?? "",
    statusName: p.status?.name ?? "",
    applicantType: p.applicantType ?? "",
    updatedAt: p.updatedAt.toISOString(),
    memo: p.memo ?? "",
    memorandum: p.memorandum ?? "",
    funds: p.funds ?? "",
    redemptionScheduleIssuedAt: p.redemptionScheduleIssuedAt?.toISOString() ?? null,
    toolPurchasePrice: p.toolPurchasePrice?.toString() ?? null,
    loanAmount: p.loanAmount?.toString() ?? null,
    fundTransferDate: p.fundTransferDate?.toISOString() ?? null,
    loanExecutionDate: p.loanExecutionDate?.toISOString() ?? null,
    repaymentDate: p.repaymentDate?.toISOString() ?? null,
    repaymentAmount: p.repaymentAmount?.toString() ?? null,
    principalAmount: p.principalAmount?.toString() ?? null,
    interestAmount: p.interestAmount?.toString() ?? null,
    overshortAmount: p.overshortAmount?.toString() ?? null,
    operationFee: p.operationFee?.toString() ?? null,
    redemptionAmount: p.redemptionAmount?.toString() ?? null,
    redemptionDate: p.redemptionDate?.toISOString() ?? null,
    endMemo: p.endMemo ?? "",
    staffMemo: p.staffMemo ?? "",
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">顧客進捗状況</h1>
      <LenderShareableUrlCard />
      <LoanProgressTable data={serialized} canEdit={canEdit} />
    </div>
  );
}
