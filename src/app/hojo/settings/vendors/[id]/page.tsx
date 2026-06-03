import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { VendorDetailTabs } from "./vendor-detail-tabs";
import { notFound } from "next/navigation";
import { formatLineFriendLabel } from "@/lib/hojo/format-line-friend-label";
import type { FileInfo } from "@/components/hojo/form-answer-editor";
import {
  displayApplicationFormUpdateStatus,
  syncApplicationSupportAfterWholesaleSave,
} from "@/lib/hojo/application-support-wholesale";
import {
  loadHojoContactHistoryMasters,
  loadContactHistoriesForVendor,
} from "@/app/hojo/contact-histories/loaders";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProjectMasterDataEditPermission();

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (isNaN(id)) notFound();

  const [vendor, lineFriends, joseiLineFriends, scWholesaleStatuses, consultingPlanStatuses, vendorRegistrationStatuses, tools, vendorToolRegistrations, prolineAccounts, contractStatuses, contractDocuments] =
    await Promise.all([
      prisma.hojoVendor.findUnique({
        where: { id },
        include: {
          scWholesaleStatus: true,
          consultingPlanStatus: true,
          vendorRegistrationStatus: true,
          assignedAsLineFriend: { select: { id: true, snsname: true, sei: true, mei: true } },
          consultingStaff: { include: { staff: { select: { id: true, name: true } } } },
          contacts: {
            include: {
              lineFriend: { select: { id: true, snsname: true, free1: true, uid: true } },
              joseiLineFriend: { select: { id: true, snsname: true } },
            },
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
          },
        },
      }),
      prisma.hojoLineFriendSecurityCloud.findMany({
        where: { deletedAt: null },
        orderBy: { id: "asc" },
        select: { id: true, snsname: true, sei: true, mei: true, userType: true, uid: true, free1: true },
      }),
      prisma.hojoLineFriendJoseiSupport.findMany({
        where: { deletedAt: null },
        orderBy: { id: "asc" },
        select: { id: true, snsname: true },
      }),
      prisma.hojoVendorScWholesaleStatus.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.hojoVendorConsultingPlanStatus.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.hojoVendorRegistrationStatus.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.hojoVendorTool.findMany({
        where: { isActive: true },
        include: {
          statuses: {
            where: { isActive: true },
            orderBy: { displayOrder: "asc" },
          },
        },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.hojoVendorToolRegistration.findMany({
        where: { vendorId: id },
      }),
      prisma.hojoProlineAccount.findMany({
        select: { lineType: true, label: true },
      }),
      prisma.hojoVendorContractStatus.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.hojoVendorContractDocument.findMany({
        where: { vendorId: id },
        orderBy: [{ serviceType: "asc" }, { displayOrder: "asc" }],
      }),
    ]);

  if (!vendor) notFound();

  // ProLine labels
  const labelMap: Record<string, string> = {};
  for (const a of prolineAccounts) labelMap[a.lineType] = a.label;
  const scLabel = labelMap["security-cloud"] || "セキュリティクラウド";
  const joseiLabel = labelMap["josei-support"] || "助成金申請サポート";

  // Fetch hojo project for staff permissions
  const hojoProject = await prisma.masterProject.findFirst({ where: { code: "hojo" } });
  const staffWithHojoPermission = hojoProject
    ? await prisma.masterStaff.findMany({
        where: {
          isActive: true,
          isSystemUser: false,
          permissions: {
            some: {
              projectId: hojoProject.id,
              permissionLevel: { in: ["edit", "manager"] },
            },
          },
        },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true },
      })
    : [];

  // Load contact history masters and data
  const contactMasters = await loadHojoContactHistoryMasters();
  const contactHistoriesData = (await loadContactHistoriesForVendor(id)) as unknown as Record<
    string,
    unknown
  >[];

  const grantWholesaleAccounts = await prisma.hojoWholesaleAccount.findMany({
    where: { vendorId: id, deletedAt: null, deletedByVendor: false, grantUsage: "有" },
    orderBy: { id: "asc" },
  });
  if (grantWholesaleAccounts.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const account of grantWholesaleAccounts) {
        await syncApplicationSupportAfterWholesaleSave(tx, account);
      }
    });
  }

  const [wholesaleRecords, applicationSupportRecords, loanProgressRecords] = await Promise.all([
    prisma.hojoWholesaleAccount.findMany({
      where: { vendorId: id, deletedAt: null, deletedByVendor: false },
      orderBy: { id: "asc" },
    }),
    prisma.hojoApplicationSupport.findMany({
      where: {
        vendorId: id,
        wholesaleAccount: { grantUsage: "有", deletedAt: null, deletedByVendor: false },
      },
      include: {
        wholesaleAccount: true,
        status: true,
        documents: true,
        linkedFormSubmissions: {
          where: { deletedAt: null, formType: "business-plan" },
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { wholesaleAccountId: "asc" },
    }),
    prisma.hojoLoanProgress.findMany({
      where: {
        vendorId: id,
        OR: [
          { wholesaleAccountId: null, deletedAt: null },
          { wholesaleAccount: { loanUsage: "有", deletedAt: null, deletedByVendor: false } },
        ],
      },
      include: {
        status: { select: { name: true } },
        wholesaleAccount: { select: { loanUsage: true } },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const wholesaleData = wholesaleRecords.map((r) => ({
    id: r.id,
    applicantType: r.applicantType || "",
    companyName: r.companyName || "",
    email: r.email || "",
    softwareSalesContractUrl: r.softwareSalesContractUrl || "",
    loanUsage: r.loanUsage || "",
    grantUsage: r.grantUsage || "",
    subsidyTargetAmountTaxIncluded: r.subsidyTargetAmountTaxIncluded,
    applicationAmount: r.applicationAmount,
    recruitmentRound: r.recruitmentRound,
    adoptionDate: r.adoptionDate?.toISOString().slice(0, 10) ?? "",
    issueRequestDate: r.issueRequestDate?.toISOString().slice(0, 10) ?? "",
    accountApprovalDate: r.accountApprovalDate?.toISOString().slice(0, 10) ?? "-",
    grantDate: r.grantDate?.toISOString().slice(0, 10) ?? "",
  }));

  const applicantData = applicationSupportRecords.map((r) => {
    const submission = r.linkedFormSubmissions[0] ?? null;
    return {
      id: r.id,
      wholesaleAccountId: r.wholesaleAccountId,
      formToken: r.formToken ?? "",
      formUpdateStatus: displayApplicationFormUpdateStatus(r.formUpdateStatus, r.formTranscriptDate),
      applicantName: r.wholesaleAccount?.companyName || r.applicantName || "-",
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
      formSubmission: submission ? {
        id: submission.id,
        submittedAt: submission.submittedAt.toISOString(),
        confirmedAt: submission.confirmedAt?.toISOString() ?? null,
        answers: submission.answers as Record<string, unknown>,
        modifiedAnswers:
          (submission.modifiedAnswers as Record<string, Record<string, string | null>> | null) ?? null,
        fileUrls: (submission.fileUrls as Record<string, FileInfo> | null) ?? null,
      } : null,
      documents: r.documents.map((d) => ({
        docType: d.docType,
        filePath: d.filePath,
        fileName: d.fileName,
        generatedAt: d.generatedAt.toISOString(),
      })),
    };
  });

  const loanProgressData = loanProgressRecords.map((r) => ({
    id: r.id,
    wholesaleAccountId: r.wholesaleAccountId,
    formToken: r.formToken ?? "",
    formUpdateStatus: r.formUpdateStatus,
    hasPendingAnswers: r.pendingAnswers != null,
    requestDate: r.requestDate?.toISOString().split("T")[0] ?? "",
    companyName: r.companyName ?? "",
    representName: r.representName ?? "",
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
    loanExecutionTime: r.loanExecutionDate
      ? r.loanExecutionDate.toISOString().split("T")[1]?.substring(0, 5) ?? ""
      : "",
    repaymentDate: r.repaymentDate?.toISOString().split("T")[0] ?? "",
    repaymentAmount: r.repaymentAmount ? Number(r.repaymentAmount).toLocaleString() : "",
    principalAmount: r.principalAmount ? Number(r.principalAmount).toLocaleString() : "",
    interestAmount: r.interestAmount ? Number(r.interestAmount).toLocaleString() : "",
    overshortAmount: r.overshortAmount ? Number(r.overshortAmount).toLocaleString() : "",
    redemptionAmount: r.redemptionAmount ? Number(r.redemptionAmount).toLocaleString() : "",
    secondaryRepaymentDate: r.secondaryRepaymentDate?.toISOString().split("T")[0] ?? "",
    secondaryRepaymentAmount: r.secondaryRepaymentAmount ? Number(r.secondaryRepaymentAmount).toLocaleString() : "",
    secondaryPrincipalAmount: r.secondaryPrincipalAmount ? Number(r.secondaryPrincipalAmount).toLocaleString() : "",
    secondaryInterestAmount: r.secondaryInterestAmount ? Number(r.secondaryInterestAmount).toLocaleString() : "",
    secondaryRedemptionAmount: r.secondaryRedemptionAmount ? Number(r.secondaryRedemptionAmount).toLocaleString() : "",
    redemptionDate: r.redemptionDate?.toISOString().split("T")[0] ?? "",
    endMemo: r.endMemo ?? "",
  }));

  // Fetch additional data for tabs
  const activities = await prisma.hojoConsultingActivity.findMany({
    where: { deletedAt: null, vendorId: id },
    include: {
      vendor: { select: { id: true, name: true } },
      tasks: { orderBy: [{ taskType: "asc" }, { displayOrder: "asc" }] },
      staffAssignments: {
        include: { staff: { select: { id: true, name: true } } },
        orderBy: { staff: { displayOrder: "asc" } },
      },
    },
    orderBy: { activityDate: "desc" },
  });

  const activitiesData = activities.map((a) => ({
    id: a.id,
    vendorId: String(a.vendorId),
    vendorName: a.vendor.name,
    activityDate: a.activityDate.toISOString().split("T")[0],
    contactMethod: a.contactMethod ?? "",
    staffIds: a.staffAssignments.map((s) => String(s.staffId)).join(","),
    staffNames: a.staffAssignments.map((s) => s.staff.name).join(", "),
    title: a.title ?? "",
    meetingMinutes: a.meetingMinutes ?? "",
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
    notes: a.notes ?? "",
  }));

  const scWholesaleOptions = scWholesaleStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const consultingPlanOptions = consultingPlanStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const vendorRegistrationOptions = vendorRegistrationStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // ツール一覧（ベンダー詳細フォーム用）— activeなステータスをツール毎に保持
  const toolsForForm = tools.map((t) => ({
    id: t.id,
    name: t.name,
    statuses: t.statuses.map((s) => ({
      id: s.id,
      name: s.name,
      isCompleted: s.isCompleted,
    })),
  }));

  // 既存のベンダーx ツール登録（toolId をキーにマップ化）
  const toolRegistrationsForForm = vendorToolRegistrations.map((r) => ({
    toolId: r.toolId,
    statusId: r.statusId,
    memo: r.memo ?? "",
  }));

  const contractStatusOptions = contractStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // 契約書ドキュメントをサービス別に分類
  type ContractDocumentItem = {
    id: number;
    type: "url" | "file";
    url: string | null;
    filePath: string | null;
    fileName: string | null;
    fileSize: number | null;
    mimeType: string | null;
  };
  const contractDocsByService: Record<string, ContractDocumentItem[]> = {
    scWholesale: [],
    consultingPlan: [],
    grantApplicationBpo: [],
  };
  for (const doc of contractDocuments) {
    const list = contractDocsByService[doc.serviceType];
    if (list) {
      list.push({
        id: doc.id,
        type: doc.type as "url" | "file",
        url: doc.url,
        filePath: doc.filePath,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
      });
    }
  }

  const contacts = vendor.contacts.map((c) => ({
    id: c.id,
    name: c.name || null,
    role: c.role || null,
    email: c.email || null,
    phone: c.phone || null,
    lineFriendId: c.lineFriendId,
    lineFriendName: c.lineFriend?.snsname || null,
    joseiLineFriendId: c.joseiLineFriendId,
    joseiLineFriendName: c.joseiLineFriend?.snsname || null,
    isPrimary: c.isPrimary,
  }));

  // LINE友達をSelect用に変換（{value, label}形式）
  const scLineFriendSelectOptions = lineFriends.map((f) => ({
    value: String(f.id),
    label: formatLineFriendLabel(f),
  }));

  const joseiLineFriendSelectOptions = joseiLineFriends.map((f) => ({
    value: String(f.id),
    label: `${f.id} ${f.snsname || "（名前なし）"}`,
  }));

  // Staff options for consulting staff section
  const staffOptions = staffWithHojoPermission.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // Current consulting staff IDs
  const currentConsultingStaffIds = vendor.consultingStaff.map((cs) => cs.staffId);

  // Assigned AS info
  const assignedAsLineFriendId = vendor.assignedAsLineFriendId;
  const assignedAsLineFriendLabel = vendor.assignedAsLineFriend
    ? formatLineFriendLabel(vendor.assignedAsLineFriend)
    : null;

  // Auto-detect AS from contacts' free1 field (free1 contains uid of the AS person)
  let autoDetectedAsLabel: string | null = null;
  let autoDetectedAsLineFriendId: number | null = null;
  for (const c of vendor.contacts) {
    if (c.lineFriend?.free1) {
      // free1にはASのuidが入っている → セキュリティクラウドLINEから検索
      const asFriend = lineFriends.find(
        (f) => f.uid === c.lineFriend!.free1
      );
      if (asFriend) {
        autoDetectedAsLineFriendId = asFriend.id;
        autoDetectedAsLabel = formatLineFriendLabel(asFriend);
        break;
      }
    }
  }

  // セキュリティクラウドLINEからAS選択肢を構築 (userType="AS"のみ)
  const scLineFriendsForAs = lineFriends
    .filter((f) => f.userType === "AS")
    .map((f) => ({
      value: String(f.id),
      label: formatLineFriendLabel(f),
    }));

  // DateTime → ISO string for client (DateTime form input expects "YYYY-MM-DDTHH:mm")
  const toDateTimeString = (d: Date | null): string => {
    if (!d) return "";
    // ローカルタイムゾーンに合わせる
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };
  // DateTime → Date string for client ("YYYY-MM-DD")
  const toDateString = (d: Date | null): string => {
    if (!d) return "";
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
  };

  return (
    <VendorDetailTabs
      vendor={{
        id: vendor.id,
        name: vendor.name,
        email: vendor.email ?? "",
        phone: vendor.phone ?? "",
        kickoffMtg: toDateTimeString(vendor.kickoffMtg),
        nextContactDate: toDateString(vendor.nextContactDate),
        nextContactNotes: vendor.nextContactNotes ?? "",
        nextContactDateWholesale: toDateString(vendor.nextContactDateWholesale),
        nextContactDateConsulting: toDateString(vendor.nextContactDateConsulting),
        scWholesaleStatusId: vendor.scWholesaleStatusId,
        scWholesaleContractStatusId: vendor.scWholesaleContractStatusId,
        scWholesaleKickoffMtg: toDateTimeString(vendor.scWholesaleKickoffMtg),
        scWholesaleContractDate: toDateString(vendor.scWholesaleContractDate),
        scWholesaleEndDate: toDateString(vendor.scWholesaleEndDate),
        scWholesaleMemo: vendor.scWholesaleMemo ?? "",
        consultingPlanStatusId: vendor.consultingPlanStatusId,
        consultingPlanContractStatusId: vendor.consultingPlanContractStatusId,
        consultingPlanKickoffMtg: toDateTimeString(vendor.consultingPlanKickoffMtg),
        consultingPlanContractDate: toDateString(vendor.consultingPlanContractDate),
        consultingPlanEndDate: toDateString(vendor.consultingPlanEndDate),
        consultingPlanMemo: vendor.consultingPlanMemo ?? "",
        grantApplicationBpo: vendor.grantApplicationBpo,
        grantApplicationBpoContractStatusId: vendor.grantApplicationBpoContractStatusId,
        grantApplicationBpoKickoffMtg: toDateTimeString(vendor.grantApplicationBpoKickoffMtg),
        grantApplicationBpoContractDate: toDateString(vendor.grantApplicationBpoContractDate),
        grantApplicationBpoMemo: vendor.grantApplicationBpoMemo ?? "",
        subsidyConsulting: vendor.subsidyConsulting,
        subsidyConsultingKickoffMtg: toDateTimeString(vendor.subsidyConsultingKickoffMtg),
        subsidyConsultingMemo: vendor.subsidyConsultingMemo ?? "",
        loanUsage: vendor.loanUsage,
        loanUsageKickoffMtg: toDateTimeString(vendor.loanUsageKickoffMtg),
        loanUsageMemo: vendor.loanUsageMemo ?? "",
        vendorRegistrationStatusId: vendor.vendorRegistrationStatusId,
        vendorRegistrationMemo: vendor.vendorRegistrationMemo ?? "",
        memo: vendor.memo ?? "",
        vendorSharedMemo: vendor.vendorSharedMemo ?? "",
        assignedAsLineFriendId,
      }}
      contacts={contacts}
      scLineFriendSelectOptions={scLineFriendSelectOptions}
      joseiLineFriendSelectOptions={joseiLineFriendSelectOptions}
      scWholesaleOptions={scWholesaleOptions}
      consultingPlanOptions={consultingPlanOptions}
      contractStatusOptions={contractStatusOptions}
      vendorRegistrationOptions={vendorRegistrationOptions}
      tools={toolsForForm}
      toolRegistrations={toolRegistrationsForForm}
      contractDocsByService={contractDocsByService}
      activitiesData={activitiesData}
      wholesaleData={wholesaleData}
      applicantData={applicantData}
      loanProgressData={loanProgressData}
      scLabel={scLabel}
      joseiLabel={joseiLabel}
      staffOptions={staffOptions}
      currentConsultingStaffIds={currentConsultingStaffIds}
      assignedAsLineFriendId={assignedAsLineFriendId}
      assignedAsLineFriendLabel={assignedAsLineFriendLabel}
      autoDetectedAsLabel={autoDetectedAsLabel}
      autoDetectedAsLineFriendId={autoDetectedAsLineFriendId}
      scLineFriendsForAs={scLineFriendsForAs}
      accessToken={vendor.accessToken}
      contactHistoriesData={contactHistoriesData}
      contactMethodOptions={contactMasters.contactMethodOptions}
      contactStaffOptions={contactMasters.staffOptions}
      customerTypes={contactMasters.customerTypes}
      contactStaffByProject={contactMasters.staffByProject}
      contactCategories={contactMasters.contactCategories}
      hojoVendorCustomerTypeId={contactMasters.hojoVendorCustomerTypeId}
    />
  );
}
