import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LenderClientPage } from "./lender-client-page";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "貸金業社様 専用ページ",
};

export default async function LenderPage() {
  const session = await auth();
  const userType = session?.user?.userType;
  const isStaff = userType === "staff";
  const isLender = userType === "lender";
  const isAuthenticated = isStaff || isLender;

  if (!isAuthenticated) {
    return <LenderClientPage authenticated={false} isLender={false} corporateData={[]} individualData={[]} vendors={[]} progressData={[]} statusOptions={[]} rates={{ interestRate: 0.15, feeRate: 0.5 }} />;
  }

  if (isLender && session?.user?.mustChangePassword) {
    redirect("/hojo/lender/change-password");
  }

  // 貸金業社側は弊社承認済みの表示状態を使う。
  // ベンダーが貸金利用を変更しても、弊社が承認するまでは貸金業社側へ反映しない。
  // 既存の未紐づけ回答は移行対象外のため、従来どおり表示する。
  const allSubmissions = await prisma.hojoFormSubmission.findMany({
    where: {
      deletedAt: null,
      formType: { in: ["loan-corporate", "loan-individual"] },
      OR: [
        { loanProgress: { is: null } },
        { loanProgress: { is: { wholesaleAccountId: null, deletedAt: null } } },
        {
          loanProgress: {
            is: {
              deletedAt: null,
              wholesaleAccount: { deletedAt: null, deletedByVendor: false },
            },
          },
        },
      ],
    },
    orderBy: { submittedAt: "desc" },
  });

  const mapRow = (s: typeof allSubmissions[number]) => {
    const answers = s.answers as Record<string, unknown>;
    const modifiedAnswers = s.modifiedAnswers as Record<string, string> | null;
    const changeHistory = s.changeHistory as { changedAt: string; changedBy: string; changes: { field: string; fieldLabel: string; oldValue: string; newValue: string }[] }[] | null;
    return {
      id: s.id,
      formType: s.formType,
      companyName: s.companyName || "（未入力）",
      representName: s.representName || "（未入力）",
      email: s.email || "",
      phone: s.phone || "",
      vendorName: (answers?._vendorName as string) || "",
      submittedAt: s.submittedAt.toISOString(),
      answers: answers as Record<string, string>,
      modifiedAnswers,
      changeHistory,
      lenderMemo: s.lenderMemo || "",
    };
  };

  const corporateData = allSubmissions
    .filter((s) => s.formType === "loan-corporate")
    .map(mapRow);
  const individualData = allSubmissions
    .filter((s) => s.formType === "loan-individual")
    .map(mapRow);

  // ベンダー一覧（フィルタ用）
  const vendors = await prisma.hojoVendor.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true },
  });

  // 顧客進捗データ
  const progressRecords = await prisma.hojoLoanProgress.findMany({
    where: {
      deletedAt: null,
      formSubmissionId: { not: null },
      OR: [
        { wholesaleAccountId: null },
        { wholesaleAccount: { deletedAt: null, deletedByVendor: false } },
      ],
    },
    include: {
      vendor: { select: { id: true, name: true } },
      status: { select: { id: true, name: true } },
      wholesaleAccount: { select: { loanUsage: true } },
    },
    orderBy: { id: "desc" },
  });

  const progressData = progressRecords.map((r) => ({
    id: r.id,
    vendorName: r.vendor.name,
    requestDate: r.requestDate?.toISOString().split("T")[0] ?? "",
    companyName: r.companyName ?? "",
    representName: r.representName ?? "",
    statusId: r.statusId ? String(r.statusId) : "",
    statusName: r.status?.name ?? "",
    applicantType: r.applicantType ?? "",
    updatedAt: r.updatedAt.toISOString().split("T")[0],
    memo: r.memo ?? "",
    memorandum: r.memorandum ?? "",
    funds: r.funds ?? "",
    redemptionScheduleIssuedAt: r.redemptionScheduleIssuedAt?.toISOString().split("T")[0] ?? "",
    toolPurchasePrice: r.toolPurchasePrice ? Number(r.toolPurchasePrice).toLocaleString() : "",
    loanAmount: r.loanAmount ? Number(r.loanAmount).toLocaleString() : "",
    fundTransferDate: r.fundTransferDate?.toISOString().split("T")[0] ?? "",
    loanExecutionDate: r.loanExecutionDate?.toISOString().split("T")[0] ?? "",
    loanExecutionTime: r.loanExecutionDate ? r.loanExecutionDate.toISOString().split("T")[1]?.substring(0, 5) ?? "" : "",
    repaymentDate: r.repaymentDate?.toISOString().split("T")[0] ?? "",
    repaymentAmount: r.repaymentAmount ? Number(r.repaymentAmount).toLocaleString() : "",
    principalAmount: r.principalAmount ? Number(r.principalAmount).toLocaleString() : "",
    interestAmount: r.interestAmount ? Number(r.interestAmount).toLocaleString() : "",
    overshortAmount: r.overshortAmount ? Number(r.overshortAmount).toLocaleString() : "",
    operationFee: r.operationFee ? Number(r.operationFee).toLocaleString() : "",
    redemptionAmount: r.redemptionAmount ? Number(r.redemptionAmount).toLocaleString() : "",
    secondaryRepaymentDate: r.secondaryRepaymentDate?.toISOString().split("T")[0] ?? "",
    secondaryRepaymentAmount: r.secondaryRepaymentAmount ? Number(r.secondaryRepaymentAmount).toLocaleString() : "",
    secondaryPrincipalAmount: r.secondaryPrincipalAmount ? Number(r.secondaryPrincipalAmount).toLocaleString() : "",
    secondaryInterestAmount: r.secondaryInterestAmount ? Number(r.secondaryInterestAmount).toLocaleString() : "",
    secondaryRedemptionAmount: r.secondaryRedemptionAmount ? Number(r.secondaryRedemptionAmount).toLocaleString() : "",
    redemptionDate: r.redemptionDate?.toISOString().split("T")[0] ?? "",
    endMemo: r.endMemo ?? "",
  }));

  // ステータス選択肢
  const statuses = await prisma.hojoLoanProgressStatus.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  // 利率/フィー率（グローバル設定。シングルトン）
  // マイグレーション未適用 / Prisma Client未再生成時は 0 にフォールバック
  let rates = { interestRate: 0.15, feeRate: 0.5 };
  try {
    if (prisma.hojoLoanProgressRateConfig) {
      const rateConfig = await prisma.hojoLoanProgressRateConfig.findFirst({ orderBy: { id: "asc" } });
      if (rateConfig) {
        rates = {
          interestRate: Number(rateConfig.interestRate),
          feeRate: Number(rateConfig.feeRate),
        };
      }
    }
  } catch (e) {
    console.warn("[LenderPage] hojoLoanProgressRateConfig load failed (migration not applied?):", e);
  }

  const userName = session?.user?.name || "";

  return (
    <LenderClientPage
      authenticated={true}
      isLender={isLender}
      corporateData={corporateData}
      individualData={individualData}
      vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
      progressData={progressData}
      statusOptions={statuses.map((s) => ({ value: String(s.id), label: s.name }))}
      userName={userName}
      rates={rates}
    />
  );
}
