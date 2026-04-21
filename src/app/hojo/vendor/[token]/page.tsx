import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { VendorClientPage } from "./vendor-client-page";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import type { Metadata } from "next";
import { extractSubmissionMeta } from "@/lib/hojo/form-answer-sections";
import type { FileInfo } from "@/components/hojo/form-answer-editor";

export const metadata: Metadata = {
  title: "ベンダー様専用",
};

export default async function VendorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const vendor = await prisma.hojoVendor.findUnique({
    where: { accessToken: token },
    include: {
      assignedAsLineFriend: { select: { snsname: true } },
      consultingStaff: { include: { staff: { select: { name: true } } } },
      consultingPlanStatus: { select: { name: true } },
      consultingPlanContractStatus: { select: { name: true } },
      scWholesaleStatus: { select: { name: true } },
      scWholesaleContractStatus: { select: { name: true } },
      grantApplicationBpoContractStatus: { select: { name: true } },
      contacts: {
        select: { id: true, name: true, role: true, email: true, phone: true, isPrimary: true },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!vendor || !vendor.isActive) {
    notFound();
  }

  // ProLineアカウントラベル取得
  const prolineAccounts = await prisma.hojoProlineAccount.findMany({
    select: { lineType: true, label: true },
  });
  const labelMap: Record<string, string> = {};
  for (const a of prolineAccounts) labelMap[a.lineType] = a.label;
  const scLabel = labelMap["security-cloud"] || "セキュリティクラウド";

  const dateOnly = (d: Date | null): string | null => d ? d.toISOString().split("T")[0] : null;

  // ベンダー基本情報（契約概要セクション用）
  const vendorInfo = {
    scLabel,
    assignedAs: vendor.assignedAsLineFriend?.snsname ?? null,
    consultingStaffNames: vendor.consultingStaff.map((cs) => cs.staff.name),
    companyName: vendor.name,
    contacts: vendor.contacts.map((c) => ({
      id: c.id,
      name: c.name ?? "",
      role: c.role ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      isPrimary: c.isPrimary,
    })),
    kickoffMtg: vendor.kickoffMtg?.toISOString() ?? null,
    consultingPlan: vendor.consultingPlanStatus?.name ?? null,
    consultingPlanContractStatus: vendor.consultingPlanContractStatus?.name ?? null,
    consultingPlanContractDate: dateOnly(vendor.consultingPlanContractDate),
    consultingPlanEndDate: dateOnly(vendor.consultingPlanEndDate),
    scWholesalePlan: vendor.scWholesaleStatus?.name ?? null,
    scWholesaleContractStatus: vendor.scWholesaleContractStatus?.name ?? null,
    scWholesaleContractDate: dateOnly(vendor.scWholesaleContractDate),
    scWholesaleEndDate: dateOnly(vendor.scWholesaleEndDate),
    grantApplicationBpoContractStatus: vendor.grantApplicationBpoContractStatus?.name ?? null,
    grantApplicationBpoContractDate: dateOnly(vendor.grantApplicationBpoContractDate),
    subsidyConsulting: vendor.subsidyConsulting,
    grantApplicationBpo: vendor.grantApplicationBpo,
    loanUsage: vendor.loanUsage,
    loanUsageKickoffMtg: vendor.loanUsageKickoffMtg?.toISOString() ?? null,
    vendorSharedMemo: vendor.vendorSharedMemo ?? null,
  };

  const session = await auth();
  const userType = session?.user?.userType;
  const isStaff = userType === "staff";
  const isVendor = userType === "vendor";
  const sessionVendorId = session?.user?.vendorId;
  const isAuthenticated = isStaff || (isVendor && sessionVendorId === vendor.id);
  const userPermissions = (session?.user?.permissions ?? []) as UserPermission[];
  const staffCanEdit = isStaff && canEditProject(userPermissions, "hojo");

  if (!isAuthenticated) {
    return (
      <VendorClientPage
        authenticated={false}
        isVendor={false}
        applicantData={[]}
        wholesaleData={[]}
        contractsData={[]}
        activitiesData={[]}
        preApplicationData={[]}
        postApplicationData={[]}
        loanCorporateData={[]}
        loanIndividualData={[]}
        loanProgressData={[]}
        vendorName={vendor.name}
        vendorToken={token}
        allVendors={[]}
        vendorInfo={vendorInfo}
      />
    );
  }

  let allVendors: { id: number; name: string; token: string }[] = [];
  if (isStaff) {
    const vendors = await prisma.hojoVendor.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true, accessToken: true },
    });
    allVendors = vendors.map((v) => ({ id: v.id, name: v.name, token: v.accessToken }));
  }

  // 助成金申請者管理データ（vendorIdで直接フィルタ。申請者管理ページがfree1→vendorIdを自動同期済み）
  const records = await prisma.hojoApplicationSupport.findMany({
    where: { vendorId: vendor.id, deletedAt: null },
    include: { lineFriend: true, status: true, documents: true },
    orderBy: { lineFriendId: "asc" },
  });

  const applicantUids = records.map((r) => r.lineFriend.uid).filter(Boolean);
  const formSubmissions = applicantUids.length
    ? await prisma.hojoFormSubmission.findMany({
        where: {
          deletedAt: null,
          formType: "business-plan",
          OR: [
            { linkedApplicationSupportId: { in: records.map((r) => r.id) } },
            ...applicantUids.map((uid) => ({
              answers: { path: ["_meta", "uid"], equals: uid },
            })),
          ],
        },
        orderBy: { submittedAt: "desc" },
      })
    : [];
  const formByUid = new Map<string, {
    id: number;
    submittedAt: string;
    confirmedAt: string | null;
    answers: Record<string, unknown>;
    modifiedAnswers: Record<string, Record<string, string | null>> | null;
    fileUrls: Record<string, FileInfo> | null;
  }>();
  for (const s of formSubmissions) {
    const { uid } = extractSubmissionMeta(s.answers as Record<string, unknown>);
    if (!uid || formByUid.has(uid)) continue;
    formByUid.set(uid, {
      id: s.id,
      submittedAt: s.submittedAt.toISOString(),
      confirmedAt: s.confirmedAt?.toISOString() ?? null,
      answers: s.answers as Record<string, unknown>,
      modifiedAnswers:
        (s.modifiedAnswers as Record<string, Record<string, string | null>> | null) ?? null,
      fileUrls: (s.fileUrls as Record<string, FileInfo> | null) ?? null,
    });
  }

  const applicantData = records.map((r) => ({
    id: r.id,
    lineFriendUid: r.lineFriend.uid,
    lineName: r.lineFriend.snsname || "-",
    applicantName: r.applicantName || "-",
    statusName: r.status?.name || "-",
    formAnswerDate: r.formAnswerDate?.toISOString().slice(0, 10) ?? "-",
    formTranscriptDate: r.formTranscriptDate?.toISOString().slice(0, 10) ?? "-",
    applicationFormDate: r.applicationFormDate?.toISOString().slice(0, 10) ?? "-",
    subsidyDesiredDate: r.subsidyDesiredDate?.toISOString().slice(0, 10) ?? "",
    subsidyAmount: r.subsidyAmount,
    paymentReceivedAmount: r.paymentReceivedAmount,
    paymentReceivedDate: r.paymentReceivedDate?.toISOString().slice(0, 10) ?? "-",
    subsidyReceivedDate: r.subsidyReceivedDate?.toISOString().slice(0, 10) ?? "-",
    vendorMemo: r.vendorMemo || "",
    formSubmission: formByUid.get(r.lineFriend.uid) ?? null,
    documents: r.documents.map((d) => ({
      docType: d.docType,
      filePath: d.filePath,
      fileName: d.fileName,
      generatedAt: d.generatedAt.toISOString(),
    })),
  }));

  // 卸アカウント管理データ（ベンダー側削除されたものは非表示）
  const wholesaleRecords = await prisma.hojoWholesaleAccount.findMany({
    where: { vendorId: vendor.id, deletedAt: null, deletedByVendor: false },
    orderBy: { id: "asc" },
  });

  const wholesaleData = wholesaleRecords.map((r) => ({
    id: r.id,
    supportProviderName: r.supportProviderName || "",
    companyName: r.companyName || "",
    email: r.email || "",
    softwareSalesContractUrl: r.softwareSalesContractUrl || "",
    recruitmentRound: r.recruitmentRound,
    adoptionDate: r.adoptionDate?.toISOString().slice(0, 10) ?? "",
    issueRequestDate: r.issueRequestDate?.toISOString().slice(0, 10) ?? "",
    accountApprovalDate: r.accountApprovalDate?.toISOString().slice(0, 10) ?? "-",
    grantDate: r.grantDate?.toISOString().slice(0, 10) ?? "",
    toolCost: r.toolCost,
    invoiceStatus: r.invoiceStatus || "-",
  }));

  // コンサル契約データ
  const contracts = await prisma.hojoConsultingContract.findMany({
    where: { vendorId: vendor.id, deletedAt: null },
    orderBy: { id: "asc" },
  });

  const contractsData = contracts.map((c) => ({
    id: c.id,
    lineNumber: c.lineNumber ?? "",
    lineName: c.lineName ?? "",
    referralUrl: c.referralUrl ?? "",
    assignedAs: c.assignedAs ?? "",
    consultingStaff: c.consultingStaff ?? "",
    companyName: c.companyName,
    representativeName: c.representativeName ?? "",
    mainContactName: c.mainContactName ?? "",
    customerEmail: c.customerEmail ?? "",
    customerPhone: c.customerPhone ?? "",
    contractDate: c.contractDate?.toISOString().split("T")[0] ?? "",
    contractPlan: c.contractPlan ?? "",
    contractAmount: c.contractAmount ? Number(c.contractAmount) : "",
    serviceType: c.serviceType ?? "",
    caseStatus: c.caseStatus ?? "",
    hasScSales: c.hasScSales,
    hasSubsidyConsulting: c.hasSubsidyConsulting,
    hasBpoSupport: c.hasBpoSupport,
    consultingPlan: c.consultingPlan ?? "",
    successFee: c.successFee ? Number(c.successFee) : "",
    startDate: c.startDate?.toISOString().split("T")[0] ?? "",
    endDate: c.endDate?.toISOString().split("T")[0] ?? "",
    billingStatus: c.billingStatus ?? "",
    paymentStatus: c.paymentStatus ?? "",
    revenueRecordingDate: c.revenueRecordingDate?.toISOString().split("T")[0] ?? "",
    grossProfit: c.grossProfit ? Number(c.grossProfit) : "",
    notes: c.notes ?? "",
  }));

  // コンサル活動データ（スタッフ専用フィールドを除外）
  const activities = await prisma.hojoConsultingActivity.findMany({
    where: { vendorId: vendor.id, deletedAt: null },
    include: {
      tasks: { orderBy: [{ taskType: "asc" }, { displayOrder: "asc" }] },
    },
    orderBy: { activityDate: "desc" },
  });

  const activitiesData = activities.map((a) => ({
    id: a.id,
    activityDate: a.activityDate.toISOString().split("T")[0],
    contactMethod: a.contactMethod ?? "",
    vendorIssue: a.vendorIssue ?? "",
    vendorNextAction: a.vendorNextAction ?? "",
    nextDeadline: a.nextDeadline?.toISOString().split("T")[0] ?? "",
    tasks: a.tasks.map((t) => ({
      id: t.id,
      taskType: t.taskType as "vendor" | "consulting_team",
      content: t.content ?? "",
      deadline: t.deadline?.toISOString().split("T")[0] ?? "",
      priority: t.priority ?? "",
      completed: t.completed,
    })),
    attachmentUrls: (a.attachmentUrls as string[] | null) ?? [],
    recordingUrls: (a.recordingUrls as string[] | null) ?? [],
    screenshotUrls: (a.screenshotUrls as string[] | null) ?? [],
    notes: a.notes ?? "",
  }));

  // 助成金顧客 〜概要案内データ
  const preApps = await prisma.hojoGrantCustomerPreApplication.findMany({
    where: { vendorId: vendor.id, deletedAt: null },
    orderBy: { id: "asc" },
  });

  const preApplicationData = preApps.map((r) => ({
    id: r.id,
    applicantName: r.applicantName ?? "",
    referrer: r.referrer ?? "",
    salesStaff: r.salesStaff ?? "",
    category: r.category ?? "",
    status: r.status ?? "",
    prospectLevel: r.prospectLevel ?? "",
    nextContactDate: r.nextContactDate?.toISOString().split("T")[0] ?? "",
    overviewBriefingDate: r.overviewBriefingDate?.toISOString().split("T")[0] ?? "",
    briefingStaff: r.briefingStaff ?? "",
    phone: r.phone ?? "",
    businessEntity: r.businessEntity ?? "",
    industry: r.industry ?? "",
    systemType: r.systemType ?? "",
    hasLoan: r.hasLoan ?? "",
    revenueRange: r.revenueRange ?? "",
    businessName: r.businessName ?? "",
  }));

  // 助成金顧客 交付申請〜データ
  const postApps = await prisma.hojoGrantCustomerPostApplication.findMany({
    where: { vendorId: vendor.id, deletedAt: null },
    orderBy: { id: "asc" },
  });

  const postApplicationData = postApps.map((r) => ({
    id: r.id,
    isBpo: r.isBpo,
    applicantName: r.applicantName ?? "",
    memo: r.memo ?? "",
    referrer: r.referrer ?? "",
    salesStaff: r.salesStaff ?? "",
    applicationCompletedDate: r.applicationCompletedDate?.toISOString().split("T")[0] ?? "",
    applicationStaff: r.applicationStaff ?? "",
    grantApplicationNumber: r.grantApplicationNumber ?? "",
    nextAction: r.nextAction ?? "",
    nextContactDate: r.nextContactDate?.toISOString().split("T")[0] ?? "",
    subsidyStatus: r.subsidyStatus ?? "",
    subsidyApplicantName: r.subsidyApplicantName ?? "",
    prefecture: r.prefecture ?? "",
    recruitmentRound: r.recruitmentRound ?? "",
    applicationType: r.applicationType ?? "",
    itToolName: r.itToolName ?? "",
    hasLoan: r.hasLoan,
    completedDate: r.completedDate?.toISOString().split("T")[0] ?? "",
  }));

  // 借入申込フォーム回答データ（このベンダーのもの）
  const loanSubmissions = await prisma.hojoFormSubmission.findMany({
    where: {
      deletedAt: null,
      formType: { in: ["loan-corporate", "loan-individual"] },
      answers: { path: ["_vendorId"], equals: vendor.id },
    },
    include: {
      loanProgress: { select: { deletedAt: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const mapLoanRow = (s: typeof loanSubmissions[number]) => ({
    id: s.id,
    formType: s.formType,
    companyName: s.companyName || "（未入力）",
    representName: s.representName || "（未入力）",
    email: s.email || "",
    phone: s.phone || "",
    submittedAt: s.submittedAt.toISOString(),
    answers: s.answers as Record<string, string>,
    modifiedAnswers: (s.modifiedAnswers as Record<string, string> | null) ?? null,
    changeHistory: (s.changeHistory as { changedAt: string; changedBy: string; changes: { field: string; fieldLabel: string; oldValue: string; newValue: string }[] }[] | null) ?? null,
    vendorMemo: s.vendorMemo || "",
    progressExcluded: s.loanProgress?.deletedAt != null,
  });

  const loanCorporateData = loanSubmissions
    .filter((s) => s.formType === "loan-corporate")
    .map(mapLoanRow);
  const loanIndividualData = loanSubmissions
    .filter((s) => s.formType === "loan-individual")
    .map(mapLoanRow);

  // 貸金 顧客進捗管理データ
  const loanProgressRecords = await prisma.hojoLoanProgress.findMany({
    where: { vendorId: vendor.id, deletedAt: null },
    include: { status: { select: { name: true } } },
    orderBy: { id: "asc" },
  });

  const loanProgressData = loanProgressRecords.map((r) => ({
    id: r.id,
    requestDate: r.requestDate?.toISOString().split("T")[0] ?? "",
    companyName: r.companyName ?? "",
    representName: r.representName ?? "",
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
    loanExecutionTime: r.loanExecutionDate
      ? r.loanExecutionDate.toISOString().split("T")[1]?.substring(0, 5) ?? ""
      : "",
    repaymentDate: r.repaymentDate?.toISOString().split("T")[0] ?? "",
    repaymentAmount: r.repaymentAmount ? Number(r.repaymentAmount).toLocaleString() : "",
    principalAmount: r.principalAmount ? Number(r.principalAmount).toLocaleString() : "",
    interestAmount: r.interestAmount ? Number(r.interestAmount).toLocaleString() : "",
    overshortAmount: r.overshortAmount ? Number(r.overshortAmount).toLocaleString() : "",
    redemptionAmount: r.redemptionAmount ? Number(r.redemptionAmount).toLocaleString() : "",
    redemptionDate: r.redemptionDate?.toISOString().split("T")[0] ?? "",
    endMemo: r.endMemo ?? "",
  }));

  const userName = session?.user?.name || "";

  return (
    <VendorClientPage
      authenticated={true}
      isVendor={isVendor}
      canEdit={isVendor || staffCanEdit}
      applicantData={applicantData}
      wholesaleData={wholesaleData}
      contractsData={contractsData}
      activitiesData={activitiesData}
      preApplicationData={preApplicationData}
      postApplicationData={postApplicationData}
      loanCorporateData={loanCorporateData}
      loanIndividualData={loanIndividualData}
      loanProgressData={loanProgressData}
      vendorName={vendor.name}
      vendorToken={token}
      vendorId={vendor.id}
      allVendors={allVendors}
      userName={userName}
      vendorInfo={vendorInfo}
    />
  );
}
