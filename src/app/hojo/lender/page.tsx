import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LenderClientPage } from "./lender-client-page";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
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
    return <LenderClientPage authenticated={false} isLender={false} corporateData={[]} individualData={[]} vendors={[]} progressData={[]} statusOptions={[]} />;
  }

  if (isLender && session?.user?.mustChangePassword) {
    return <LenderClientPage authenticated={false} isLender={false} corporateData={[]} individualData={[]} vendors={[]} progressData={[]} statusOptions={[]} />;
  }

  // 全ベンダーの借入申込フォーム回答を取得
  const allSubmissions = await prisma.hojoFormSubmission.findMany({
    where: {
      deletedAt: null,
      formType: { in: ["loan-corporate", "loan-individual"] },
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
    where: { deletedAt: null },
    include: {
      vendor: { select: { id: true, name: true } },
      status: { select: { id: true, name: true } },
    },
    orderBy: { id: "desc" },
  });

  // vendorNoを計算（ベンダー内での表示順）
  const vendorIdCounts: Record<number, number> = {};
  const progressesByVendor: Record<number, typeof progressRecords> = {};
  for (const r of progressRecords) {
    if (!progressesByVendor[r.vendorId]) progressesByVendor[r.vendorId] = [];
    progressesByVendor[r.vendorId].push(r);
  }
  // ベンダー内はid昇順でナンバリング
  const vendorNoMap: Record<number, number> = {};
  for (const records of Object.values(progressesByVendor)) {
    const sorted = [...records].sort((a, b) => a.id - b.id);
    sorted.forEach((r, i) => { vendorNoMap[r.id] = i + 1; });
  }

  const progressData = progressRecords.map((r) => ({
    id: r.id,
    vendorName: r.vendor.name,
    vendorNo: vendorNoMap[r.id] ?? 0,
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
    redemptionDate: r.redemptionDate?.toISOString().split("T")[0] ?? "",
    endMemo: r.endMemo ?? "",
  }));

  // ステータス選択肢
  const statuses = await prisma.hojoLoanProgressStatus.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });

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
    />
  );
}
