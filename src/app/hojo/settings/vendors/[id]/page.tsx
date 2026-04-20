import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { VendorDetailTabs } from "./vendor-detail-tabs";
import { notFound } from "next/navigation";
import { formatLineFriendLabel } from "@/lib/hojo/format-line-friend-label";
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

  const [vendor, lineFriends, joseiLineFriends, scWholesaleStatuses, consultingPlanStatuses, vendorRegistrationStatuses, toolRegistrationStatuses, prolineAccounts, contractStatuses, contractDocuments] =
    await Promise.all([
      prisma.hojoVendor.findUnique({
        where: { id },
        include: {
          scWholesaleStatus: true,
          consultingPlanStatus: true,
          vendorRegistrationStatus: true,
          toolRegistrationStatus: true,
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
      prisma.hojoVendorToolRegistrationStatus.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
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

  // Fetch additional data for tabs
  const [activities, preApplicationRecords, postApplicationRecords, contractsForDropdown] =
    await Promise.all([
      prisma.hojoConsultingActivity.findMany({
        where: { deletedAt: null, vendorId: id },
        include: {
          vendor: { select: { id: true, name: true } },
          contract: { select: { id: true, companyName: true, contractPlan: true } },
          tasks: { orderBy: [{ taskType: "asc" }, { displayOrder: "asc" }] },
        },
        orderBy: { activityDate: "desc" },
      }),
      prisma.hojoGrantCustomerPreApplication.findMany({
        where: { deletedAt: null, vendorId: id },
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { id: "desc" },
      }),
      prisma.hojoGrantCustomerPostApplication.findMany({
        where: { deletedAt: null, vendorId: id },
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { id: "desc" },
      }),
      prisma.hojoConsultingContract.findMany({
        where: { deletedAt: null, vendorId: id },
        orderBy: { id: "desc" },
        select: { id: true, companyName: true, contractPlan: true, vendorId: true },
      }),
    ]);

  const activitiesData = activities.map((a) => ({
    id: a.id,
    vendorId: String(a.vendorId),
    vendorName: a.vendor.name,
    contractId: a.contractId ? String(a.contractId) : "",
    contractLabel: a.contract
      ? `${a.contract.companyName}${a.contract.contractPlan ? ` (${a.contract.contractPlan})` : ""}`
      : "",
    activityDate: a.activityDate.toISOString().split("T")[0],
    contactMethod: a.contactMethod ?? "",
    vendorIssue: a.vendorIssue ?? "",
    hearingContent: a.hearingContent ?? "",
    responseContent: a.responseContent ?? "",
    proposalContent: a.proposalContent ?? "",
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

  const preApplicationData = preApplicationRecords.map((r) => ({
    id: r.id,
    vendorId: String(r.vendorId),
    vendorName: r.vendor.name,
    applicantName: r.applicantName ?? "",
    status: r.status ?? "",
    category: r.category ?? "",
    prospectLevel: r.prospectLevel ?? "",
    nextContactDate: r.nextContactDate?.toISOString().split("T")[0] ?? "",
    businessName: r.businessName ?? "",
    salesStaff: r.salesStaff ?? "",
  }));

  const postApplicationData = postApplicationRecords.map((r) => ({
    id: r.id,
    vendorId: String(r.vendorId),
    vendorName: r.vendor.name,
    applicantName: r.applicantName ?? "",
    grantApplicationNumber: r.grantApplicationNumber ?? "",
    subsidyStatus: r.subsidyStatus ?? "",
    applicationCompletedDate: r.applicationCompletedDate?.toISOString().split("T")[0] ?? "",
    hasLoan: r.hasLoan,
    completedDate: r.completedDate?.toISOString().split("T")[0] ?? "",
  }));

  const contractOptions = contractsForDropdown.map((c) => ({
    value: String(c.id),
    label: `${c.companyName}${c.contractPlan ? ` (${c.contractPlan})` : ""}`,
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

  const toolRegistrationOptions = toolRegistrationStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
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
        toolRegistrationStatusId: vendor.toolRegistrationStatusId,
        toolRegistrationMemo: vendor.toolRegistrationMemo ?? "",
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
      toolRegistrationOptions={toolRegistrationOptions}
      contractDocsByService={contractDocsByService}
      activitiesData={activitiesData}
      preApplicationData={preApplicationData}
      postApplicationData={postApplicationData}
      contractOptions={contractOptions}
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
