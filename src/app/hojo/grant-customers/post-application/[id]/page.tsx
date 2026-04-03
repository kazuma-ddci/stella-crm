import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { PostApplicationDetail } from "./post-application-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PostApplicationDetailPage({ params }: Props) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) notFound();

  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const [record, vendors] = await Promise.all([
    prisma.hojoGrantCustomerPostApplication.findFirst({
      where: { id, deletedAt: null },
      include: { vendor: { select: { id: true, name: true } } },
    }),
    prisma.hojoVendor.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!record) notFound();

  const vendorOptions = vendors.map((v) => ({
    value: String(v.id),
    label: v.name,
  }));

  const toStr = (v: unknown) => (v != null ? String(v) : "");
  const toDateStr = (v: Date | null | undefined) =>
    v ? v.toISOString().split("T")[0] : "";
  const toNum = (v: unknown) => (v != null ? String(v) : "");

  const data = {
    id: record.id,
    vendorId: String(record.vendorId),
    vendorName: record.vendor.name,
    preApplicationId: record.preApplicationId ? String(record.preApplicationId) : "",
    isBpo: record.isBpo,
    applicantName: toStr(record.applicantName),
    memo: toStr(record.memo),
    referrer: toStr(record.referrer),
    salesStaff: toStr(record.salesStaff),
    applicationCompletedDate: toDateStr(record.applicationCompletedDate),
    applicationStaff: toStr(record.applicationStaff),
    grantApplicationNumber: toStr(record.grantApplicationNumber),
    nextAction: toStr(record.nextAction),
    nextContactDate: toDateStr(record.nextContactDate),
    documentStorageUrl: toStr(record.documentStorageUrl),
    existingDocuments: toStr(record.existingDocuments),
    staffEmail: toStr(record.staffEmail),
    // 申請状況チェック
    growthMatchingUrl: toStr(record.growthMatchingUrl),
    growthMatchingStatus: toStr(record.growthMatchingStatus),
    wageRaise: toStr(record.wageRaise),
    laborSavingNavi: toStr(record.laborSavingNavi),
    invoiceRegistration: toStr(record.invoiceRegistration),
    repeatJudgment: toStr(record.repeatJudgment),
    // IT導入補助金データ
    subsidyApplicantName: toStr(record.subsidyApplicantName),
    prefecture: toStr(record.prefecture),
    recruitmentRound: toStr(record.recruitmentRound),
    applicationType: toStr(record.applicationType),
    subsidyStatus: toStr(record.subsidyStatus),
    subsidyStatusUpdated: toDateStr(record.subsidyStatusUpdated),
    subsidyVendorName: toStr(record.subsidyVendorName),
    itToolName: toStr(record.itToolName),
    subsidyTargetAmount: toNum(record.subsidyTargetAmount),
    subsidyAppliedAmount: toNum(record.subsidyAppliedAmount),
    grantDecisionDate: toDateStr(record.grantDecisionDate),
    grantDecisionAmount: toNum(record.grantDecisionAmount),
    confirmationApprovalDate: toDateStr(record.confirmationApprovalDate),
    subsidyConfirmedAmount: toNum(record.subsidyConfirmedAmount),
    // プロセス管理
    deliveryDate: toDateStr(record.deliveryDate),
    deliveryCompleted: toStr(record.deliveryCompleted),
    employeeListUrl: toStr(record.employeeListUrl),
    employeeListFormUrl: toStr(record.employeeListFormUrl),
    employeeListCreated: toStr(record.employeeListCreated),
    performanceReportDate: toDateStr(record.performanceReportDate),
    performanceReportCompleted: toStr(record.performanceReportCompleted),
    confirmationDate: toDateStr(record.confirmationDate),
    confirmationCompleted: toStr(record.confirmationCompleted),
    grantDate: toDateStr(record.grantDate),
    grantCompleted: toStr(record.grantCompleted),
    refundDate: toDateStr(record.refundDate),
    refundCompleted: toStr(record.refundCompleted),
    subsidyPaymentDate: toDateStr(record.subsidyPaymentDate),
    subsidyPaymentCompleted: toStr(record.subsidyPaymentCompleted),
    completedDate: toDateStr(record.completedDate),
    // 貸付管理
    hasLoan: record.hasLoan,
    loanSurveyResponse: toStr(record.loanSurveyResponse),
    loanMtgDate: toDateStr(record.loanMtgDate),
    loanMtgCompleted: toStr(record.loanMtgCompleted),
    loanMtgStaff: toStr(record.loanMtgStaff),
    loanLocation: toStr(record.loanLocation),
    loanAmount: toNum(record.loanAmount),
    loanCash: toStr(record.loanCash),
    loanDoubleChecker: toStr(record.loanDoubleChecker),
    loanPaymentDate: toDateStr(record.loanPaymentDate),
    loanTime: toStr(record.loanTime),
    loanPaymentCompleted: toStr(record.loanPaymentCompleted),
    // 報酬管理
    referrerNumber: toStr(record.referrerNumber),
    referrerLineName: toStr(record.referrerLineName),
    referrerPct: toNum(record.referrerPct),
    referrerAmount: toNum(record.referrerAmount),
    referrerPaymentDate: toDateStr(record.referrerPaymentDate),
    referrerPaymentCompleted: toStr(record.referrerPaymentCompleted),
    agent1Number: toStr(record.agent1Number),
    agent1LineName: toStr(record.agent1LineName),
    agent1Pct: toNum(record.agent1Pct),
    agent1Amount: toNum(record.agent1Amount),
    agent1PaymentDate: toDateStr(record.agent1PaymentDate),
    agent1PaymentCompleted: toStr(record.agent1PaymentCompleted),
    agent2Number: toStr(record.agent2Number),
    agent2LineName: toStr(record.agent2LineName),
    agent2Pct: toNum(record.agent2Pct),
    agent2Amount: toNum(record.agent2Amount),
    agent2PaymentDate: toDateStr(record.agent2PaymentDate),
    agent2PaymentCompleted: toStr(record.agent2PaymentCompleted),
    agent3Number: toStr(record.agent3Number),
    agent3LineName: toStr(record.agent3LineName),
    agent3Pct: toNum(record.agent3Pct),
    agent3Amount: toNum(record.agent3Amount),
    agent3PaymentDate: toDateStr(record.agent3PaymentDate),
    agent3PaymentCompleted: toStr(record.agent3PaymentCompleted),
    // その他
    vendorPattern: toStr(record.vendorPattern),
    toolPattern: toStr(record.toolPattern),
    wageTable1: toStr(record.wageTable1),
    wageTable2: toStr(record.wageTable2),
    wageTable3: toStr(record.wageTable3),
    wageTable4: toStr(record.wageTable4),
    wageTable5: toStr(record.wageTable5),
    wageTable6: toStr(record.wageTable6),
    wageTable7: toStr(record.wageTable7),
    wageTable8: toStr(record.wageTable8),
    wageTable9: toStr(record.wageTable9),
    wageTable10: toStr(record.wageTable10),
  };

  return (
    <PostApplicationDetail
      data={data}
      canEdit={canEdit}
      vendorOptions={vendorOptions}
    />
  );
}
