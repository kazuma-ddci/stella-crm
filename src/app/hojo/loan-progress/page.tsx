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
    where: {
      OR: [
        { deletedAt: null },
        { loanUsagePending: { not: null } },
      ],
    },
    include: {
      vendor: { select: { id: true, name: true } },
      status: { select: { name: true } },
      wholesaleAccount: { select: { loanUsage: true } },
    },
    orderBy: { id: "desc" },
  });

  const serialized = allProgress.map((p) => ({
    id: p.id,
    formToken: p.formToken ?? "",
    formUpdateStatus: p.formUpdateStatus,
    loanUsagePending: p.loanUsagePending ?? "",
    loanUsageApproved: p.loanUsageApproved ?? "",
    vendorName: p.vendor?.name ?? "",
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
    secondaryRepaymentDate: p.secondaryRepaymentDate?.toISOString() ?? null,
    secondaryRepaymentAmount: p.secondaryRepaymentAmount?.toString() ?? null,
    secondaryPrincipalAmount: p.secondaryPrincipalAmount?.toString() ?? null,
    secondaryInterestAmount: p.secondaryInterestAmount?.toString() ?? null,
    secondaryRedemptionAmount: p.secondaryRedemptionAmount?.toString() ?? null,
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
