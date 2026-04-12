import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { toLocalDateString } from "@/lib/utils";
import { getStaffOptionsByFields, getStaffOptionsByField } from "@/lib/staff/get-staff-by-field";
import { CompanyDetailTabs } from "./company-detail-tabs";

const STP_PROJECT_ID = 1;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function StpCompanyDetailPage({ params, searchParams }: Props) {
  const { id: idStr } = await params;
  const { tab } = await searchParams;
  const stpCompanyId = parseInt(idStr, 10);

  if (isNaN(stpCompanyId)) notFound();

  // 企業データ取得
  const stpCompany = await prisma.stpCompany.findUnique({
    where: { id: stpCompanyId },
    include: {
      company: {
        include: {
          locations: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { id: "asc" }] },
          contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { id: "asc" }] },
          bankAccounts: { where: { deletedAt: null }, orderBy: { id: "asc" } },
        },
      },
      currentStage: true,
      nextTargetStage: true,
      agent: { include: { company: true } },
      leadSource: true,
      salesStaff: true,
      adminStaff: true,
    },
  });

  if (!stpCompany) notFound();

  // マスタオプション並列取得
  const [
    stages,
    staff,
    contactMethods,
    customerTypes,
    stpProducts,
    contactCategories,
    latestContract,
    staffOptionsByField,
    masterContractStatuses,
    contractTypes,
    contactHistoriesRaw,
  ] = await Promise.all([
    prisma.stpStage.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" } }),
    prisma.masterStaff.findMany({ where: { isActive: true, isSystemUser: false }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] }),
    prisma.contactMethod.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" } }),
    prisma.customerType.findMany({ where: { isActive: true }, include: { project: true }, orderBy: [{ project: { displayOrder: "asc" } }, { displayOrder: "asc" }] }),
    prisma.stpProduct.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" } }),
    prisma.contactCategory.findMany({ where: { isActive: true }, include: { project: true }, orderBy: [{ project: { displayOrder: "asc" } }, { displayOrder: "asc" }] }),
    prisma.stpContractHistory.findFirst({
      where: { companyId: stpCompany.companyId, deletedAt: null },
      orderBy: { contractStartDate: "desc" },
      include: { salesStaff: true, operationStaff: true },
    }),
    getStaffOptionsByFields(["STP_COMPANY_SALES", "STP_COMPANY_ADMIN", "CONTRACT_ASSIGNED_TO", "CONTACT_HISTORY_STAFF"]),
    prisma.masterContractStatus.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" } }),
    prisma.contractType.findMany({ where: { projectId: STP_PROJECT_ID, isActive: true }, orderBy: { displayOrder: "asc" } }),
    // 接触履歴（この企業に紐づくもの）
    prisma.contactHistory.findMany({
      where: {
        companyId: stpCompany.companyId,
        deletedAt: null,
        roles: {
          some: {
            customerType: {
              projectId: STP_PROJECT_ID,
              name: "企業",
            },
          },
        },
      },
      include: {
        contactMethod: true,
        roles: { include: { customerType: true } },
      },
      orderBy: { contactDate: "desc" },
    }),
  ]);

  // プロジェクトごとの担当者オプション（接触履歴用）
  const allProjects = await prisma.masterProject.findMany({ where: { isActive: true } });
  const staffByProject: Record<number, { value: string; label: string }[]> = {};
  for (const project of allProjects) {
    staffByProject[project.id] = await getStaffOptionsByField("CONTACT_HISTORY_STAFF", project.id);
  }

  // 企業データシリアライズ
  const companyData = {
    id: stpCompany.id,
    companyId: stpCompany.companyId,
    companyName: stpCompany.company.name,
    industryType: stpCompany.industryType,
    industry: stpCompany.company.industry,
    plannedHires: stpCompany.plannedHires,
    note: stpCompany.note,
    contractNote: stpCompany.contractNote,
    leadAcquiredDate: stpCompany.leadAcquiredDate ? toLocalDateString(stpCompany.leadAcquiredDate) : null,
    leadValidity: stpCompany.leadValidity,
    hasDeal: stpCompany.hasDeal,
    operationStatus: stpCompany.operationStatus,
    currentStageName: stpCompany.currentStage?.name ?? null,
    currentStageId: stpCompany.currentStageId,
    nextTargetStageName: stpCompany.nextTargetStage?.name ?? null,
    nextTargetDate: stpCompany.nextTargetDate ? toLocalDateString(stpCompany.nextTargetDate) : null,
    salesStaffName: stpCompany.salesStaff?.name ?? null,
    adminStaffName: stpCompany.adminStaff?.name ?? null,
    agentName: stpCompany.agent?.company?.name ?? null,
    leadSourceName: stpCompany.leadSource?.name ?? null,
    forecast: stpCompany.forecast,
    pendingReason: stpCompany.pendingReason,
    lostReason: stpCompany.lostReason,
    billingCompanyName: stpCompany.billingCompanyName,
    billingAddress: stpCompany.billingAddress,
    jobPostingStartDate: stpCompany.jobPostingStartDate,
  };

  // 全顧客マスタデータ
  const masterCompanyData = {
    id: stpCompany.company.id,
    companyCode: stpCompany.company.companyCode,
    name: stpCompany.company.name,
    nameKana: stpCompany.company.nameKana,
    corporateNumber: stpCompany.company.corporateNumber,
    companyType: stpCompany.company.companyType,
    websiteUrl: stpCompany.company.websiteUrl,
    industry: stpCompany.company.industry,
    revenueScale: stpCompany.company.revenueScale,
    employeeCount: stpCompany.company.employeeCount,
    note: stpCompany.company.note,
    closingDay: stpCompany.company.closingDay,
    paymentMonthOffset: stpCompany.company.paymentMonthOffset,
    paymentDay: stpCompany.company.paymentDay,
    isInvoiceRegistered: stpCompany.company.isInvoiceRegistered,
    invoiceRegistrationNumber: stpCompany.company.invoiceRegistrationNumber,
    contacts: stpCompany.company.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      department: c.department,
      isPrimary: c.isPrimary,
      note: c.note,
    })),
    locations: stpCompany.company.locations.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      phone: l.phone,
      email: l.email,
      isPrimary: l.isPrimary,
      note: l.note,
    })),
    bankAccounts: stpCompany.company.bankAccounts.map((b) => ({
      id: b.id,
      bankName: b.bankName,
      bankCode: b.bankCode,
      branchName: b.branchName,
      branchCode: b.branchCode,
      accountNumber: b.accountNumber,
      accountHolderName: b.accountHolderName,
      note: b.note,
    })),
  };

  // 最新契約シリアライズ
  const latestContractData = latestContract
    ? {
        jobMedia: latestContract.jobMedia,
        contractPlan: latestContract.contractPlan,
        monthlyFee: latestContract.monthlyFee,
        performanceFee: latestContract.performanceFee,
        initialFee: latestContract.initialFee,
        contractStartDate: toLocalDateString(latestContract.contractStartDate),
        contractEndDate: latestContract.contractEndDate ? toLocalDateString(latestContract.contractEndDate) : null,
        status: latestContract.status,
        operationStaffName: latestContract.operationStaff?.name ?? null,
        accountId: latestContract.accountId,
      }
    : null;

  // 接触履歴シリアライズ
  const contactHistoriesData = contactHistoriesRaw.map((h) => {
    const assignedToNames = h.assignedTo
      ? h.assignedTo.split(",").filter(Boolean).map((id) => {
          const s = staff.find((st) => st.id === Number(id));
          return s?.name || id;
        }).join(", ")
      : null;
    return {
      id: h.id,
      contactDate: h.contactDate.toISOString(),
      contactMethodId: h.contactMethodId,
      contactMethodName: h.contactMethod?.name || null,
      assignedTo: h.assignedTo,
      assignedToNames,
      customerParticipants: h.customerParticipants,
      meetingMinutes: h.meetingMinutes,
      note: h.note,
      customerTypeIds: h.roles.map((r) => r.customerTypeId),
    };
  });

  // オプション
  const contactMethodOptions = contactMethods.map((m) => ({ value: String(m.id), label: m.name }));
  const staffOptions = staff.map((s) => ({ value: String(s.id), label: s.name }));
  return (
    <CompanyDetailTabs
      stpCompanyId={stpCompanyId}
      companyData={companyData}
      masterCompany={masterCompanyData}
      latestContract={latestContractData}
      initialTab={tab || "overview"}
      contactMethodOptions={contactMethodOptions}
      staffOptions={staffOptions}
      contactHistories={contactHistoriesData}
      contractStatusOptions={masterContractStatuses.map((s) => ({ value: String(s.id), label: s.name }))}
      contractTypeOptions={contractTypes.map((ct) => ({ value: ct.name, label: ct.name }))}
      customerTypes={customerTypes.map((ct) => ({
        id: ct.id,
        name: ct.name,
        projectId: ct.projectId,
        displayOrder: ct.displayOrder,
        project: ct.project ? { id: ct.project.id, name: ct.project.name, displayOrder: ct.project.displayOrder } : { id: 0, name: "", displayOrder: 0 },
      }))}
      staffByProject={staffByProject}
      contactCategories={contactCategories.map((c) => ({
        id: c.id,
        name: c.name,
        projectId: c.projectId,
        project: c.project ? { id: c.project.id, name: c.project.name, displayOrder: c.project.displayOrder } : { id: 0, name: "", displayOrder: 0 },
      }))}
    />
  );
}
