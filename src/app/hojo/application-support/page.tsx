import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ApplicationSupportTable } from "./application-support-table";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import {
  calculateGrantPaymentAmounts,
  displayApplicationFormUpdateStatus,
  syncApplicationSupportAfterWholesaleSave,
} from "@/lib/hojo/application-support-wholesale";

export default async function ApplicationSupportPage() {
  const session = await auth();
  const canEditAnswers =
    session?.user?.userType === "staff" &&
    canEditProjectMasterDataSync(session?.user, "hojo");

  const grantAccounts = await prisma.hojoWholesaleAccount.findMany({
    where: { deletedAt: null, deletedByVendor: false, grantUsage: "有" },
    orderBy: { id: "asc" },
  });
  if (grantAccounts.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const account of grantAccounts) {
        await syncApplicationSupportAfterWholesaleSave(tx, account);
      }
    });
  }

  const [records, activeVendors, statuses, allStatuses, bbsStatuses, allBbsStatuses] = await Promise.all([
    prisma.hojoApplicationSupport.findMany({
      where: {
        wholesaleAccountId: { not: null },
        wholesaleAccount: { deletedAt: null, deletedByVendor: false },
        OR: [
          { deletedAt: null },
          { grantUsagePending: { not: null } },
        ],
      },
      include: {
        vendor: true,
        status: true,
        bbsStatusRef: true,
        documents: true,
        wholesaleAccount: { include: { vendor: true } },
        linkedFormSubmissions: {
          where: { deletedAt: null, formType: "business-plan" },
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ wholesaleAccountId: "asc" }, { id: "asc" }],
    }),
    prisma.hojoVendor.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.hojoApplicationStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.hojoApplicationStatus.findMany({
      orderBy: { displayOrder: "asc" },
    }),
    prisma.hojoBbsStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.hojoBbsStatus.findMany({
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const vendorOptions = activeVendors.map((v) => ({ value: String(v.id), label: v.name }));
  const statusOptions = statuses.map((s) => ({ value: String(s.id), label: s.name }));
  const allStatusOptions = allStatuses.map((s) => ({ value: String(s.id), label: s.name }));
  const bbsStatusOptions = bbsStatuses.map((s) => ({ value: String(s.id), label: s.name }));
  const allBbsStatusOptions = allBbsStatuses.map((s) => ({ value: String(s.id), label: s.name }));

  const bbsRecords = records
    .filter((r) => r.formAnswerDate !== null)
    .sort((a, b) => a.formAnswerDate!.getTime() - b.formAnswerDate!.getTime());
  const bbsNoMap = new Map<number, number>();
  bbsRecords.forEach((r, i) => bbsNoMap.set(r.id, i + 1));

  const data = records.map((record, idx) => {
    const submission = record.linkedFormSubmissions[0] ?? null;
    const account = record.wholesaleAccount;
    const calculatedAmounts = calculateGrantPaymentAmounts(record.subsidyAmount);
    return {
      id: record.id,
      rowNo: idx + 1,
      wholesaleAccountId: record.wholesaleAccountId,
      formToken: record.formToken ?? "",
      formUpdateStatus: displayApplicationFormUpdateStatus(record.formUpdateStatus, record.formTranscriptDate),
      hasPendingAnswers: record.pendingAnswers != null,
      pendingAnswers: (record.pendingAnswers as Record<string, unknown> | null) ?? null,
      pendingFileUrls: (record.pendingFileUrls as Record<string, unknown> | null) ?? null,
      grantUsagePending: record.grantUsagePending ?? "",
      grantUsageApproved: record.grantUsageApproved ?? "",
      grantUsageCurrent: account?.grantUsage ?? "",
      vendorName: account?.vendor.name || record.vendor?.name || "-",
      vendorId: record.vendorId ? String(record.vendorId) : "",
      statusId: record.statusId ? String(record.statusId) : "",
      applicantName: account?.companyName ?? record.applicantName ?? "",
      detailMemo: record.detailMemo ?? "",
      formAnswerDate: record.formAnswerDate?.toISOString().slice(0, 10) ?? null,
      formTranscriptDate: record.formTranscriptDate?.toISOString().slice(0, 10) ?? null,
      applicationFormDate: record.applicationFormDate?.toISOString().slice(0, 10) ?? null,
      documentStorageUrl: record.documentStorageUrl ?? "",
      subsidyDesiredDate: record.subsidyDesiredDate?.toISOString().slice(0, 10) ?? null,
      subsidyAmount: record.subsidyAmount ?? null,
      paymentReceivedDate: record.paymentReceivedDate?.toISOString().slice(0, 10) ?? null,
      paymentReceivedAmount: calculatedAmounts.paymentReceivedAmount,
      bbsTransferAmount: calculatedAmounts.bbsTransferAmount,
      bbsTransferDate: record.bbsTransferDate?.toISOString().slice(0, 10) ?? null,
      subsidyReceivedDate: record.subsidyReceivedDate?.toISOString().slice(0, 10) ?? null,
      alkesMemo: record.alkesMemo ?? "",
      bbsMemo: record.bbsMemo ?? "",
      bbsNo: bbsNoMap.get(record.id) ?? null,
      bbsStatusId: record.bbsStatusId ? String(record.bbsStatusId) : "",
      vendorMemo: record.vendorMemo ?? "",
      formSubmission: submission ? {
        id: submission.id,
        submittedAt: submission.submittedAt.toISOString(),
        confirmedAt: submission.confirmedAt?.toISOString() ?? null,
        linkedApplicationSupportId: submission.linkedApplicationSupportId,
        answers: submission.answers as Record<string, unknown>,
        modifiedAnswers:
          (submission.modifiedAnswers as Record<string, Record<string, string | null>> | null) ?? null,
        fileUrls: (submission.fileUrls as Record<string, unknown> | null) ?? null,
      } : null,
      documents: record.documents.map((d) => ({
        docType: d.docType,
        filePath: d.filePath,
        fileName: d.fileName,
        generatedAt: d.generatedAt.toISOString(),
        generatedSections: (d.generatedSections as Record<string, string> | null) ?? null,
        editedSections: (d.editedSections as Record<string, string> | null) ?? null,
        modelName: d.modelName,
        inputTokens: d.inputTokens,
        outputTokens: d.outputTokens,
        cacheReadTokens: d.cacheReadTokens,
        cacheCreationTokens: d.cacheCreationTokens,
        costUsd: d.costUsd ? d.costUsd.toString() : null,
        hasPreviousBackup: !!d.previousFilePath,
      })),
      existingDocTypes: {
        trainingReport: record.documents.some((d) => d.docType === "training_report"),
        supportApplication: record.documents.some((d) => d.docType === "support_application"),
        businessPlan: record.documents.some((d) => d.docType === "business_plan"),
      },
      runningByDocType: {
        trainingReport: record.trainingReportRunningAt?.toISOString() ?? null,
        supportApplication: record.supportApplicationRunningAt?.toISOString() ?? null,
        businessPlan: record.businessPlanRunningAt?.toISOString() ?? null,
      },
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">申請者管理</h1>
      <ApplicationSupportTable
        data={data}
        vendorOptions={vendorOptions}
        statusOptions={statusOptions}
        allStatusOptions={allStatusOptions}
        bbsStatusOptions={bbsStatusOptions}
        allBbsStatusOptions={allBbsStatusOptions}
        canEditAnswers={canEditAnswers}
      />
    </div>
  );
}
