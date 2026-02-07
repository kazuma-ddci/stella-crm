import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StpCompaniesTable } from "./stp-companies-table";

export default async function StpCompaniesPage() {
  const STP_PROJECT_ID = 1; // 採用ブースト

  const [companies, masterCompanies, stages, agents, staff, staffProjectAssignments, allStaffProjectAssignments, leadSources, contactMethods, masterContractStatuses, masterContracts, contactHistories, customerTypes, contractHistoriesData] = await Promise.all([
    prisma.stpCompany.findMany({
      include: {
        company: {
          include: {
            locations: { where: { deletedAt: null } },
            contacts: { where: { deletedAt: null } },
          },
        },
        currentStage: true,
        nextTargetStage: true,
        agent: {
          include: { company: true },
        },
        leadSource: true,
        salesStaff: true,
        contracts: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.masterStellaCompany.findMany({
      include: {
        locations: { where: { deletedAt: null } },
        contacts: { where: { deletedAt: null } },
      },
      orderBy: { companyCode: "desc" },
    }),
    prisma.stpStage.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.stpAgent.findMany({
      where: { status: "アクティブ" },
      include: { company: true },
      orderBy: { id: "asc" },
    }),
    prisma.masterStaff.findMany({
      where: { isActive: true, isSystemUser: false },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    }),
    prisma.staffProjectAssignment.findMany({
      where: { projectId: STP_PROJECT_ID },
      include: { staff: true },
    }),
    // 全プロジェクトのスタッフ割当（接触履歴モーダルでプロジェクト連動担当者選択に使用）
    prisma.staffProjectAssignment.findMany({
      include: { staff: true, project: true },
    }),
    prisma.stpLeadSource.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.contactMethod.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.masterContractStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.masterContract.findMany({
      where: { projectId: STP_PROJECT_ID },
      include: { currentStatus: true },
      orderBy: { createdAt: "desc" },
    }),
    // 接触履歴（顧客種別「企業」のコンテキストを持つもの）
    prisma.contactHistory.findMany({
      where: {
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
        roles: {
          include: {
            customerType: true,
          },
        },
      },
      orderBy: { contactDate: "desc" },
    }),
    // 顧客種別マスタ（全プロジェクト - 接触履歴で複数プロジェクト選択可能にするため）
    prisma.customerType.findMany({
      where: { isActive: true },
      include: { project: true },
      orderBy: [
        { project: { displayOrder: "asc" } },
        { displayOrder: "asc" },
      ],
    }),
    // 契約履歴（契約終了日がnullのアクティブな契約のみ）
    prisma.stpContractHistory.findMany({
      where: {
        deletedAt: null,
        contractEndDate: null, // アクティブな契約のみ
      },
      include: {
        salesStaff: true,
        operationStaff: true,
      },
      orderBy: { contractStartDate: "desc" },
    }),
  ]);

  // companyIdでMasterContractをグループ化
  const masterContractsByCompanyId: Record<number, typeof masterContracts> = {};
  masterContracts.forEach((contract) => {
    if (!masterContractsByCompanyId[contract.companyId]) {
      masterContractsByCompanyId[contract.companyId] = [];
    }
    masterContractsByCompanyId[contract.companyId].push(contract);
  });

  // companyIdで接触履歴をグループ化
  const contactHistoriesByCompanyId: Record<number, typeof contactHistories> = {};
  contactHistories.forEach((history) => {
    if (!contactHistoriesByCompanyId[history.companyId]) {
      contactHistoriesByCompanyId[history.companyId] = [];
    }
    contactHistoriesByCompanyId[history.companyId].push(history);
  });

  // companyIdで契約履歴をグループ化
  const contractHistoriesByCompanyId: Record<number, typeof contractHistoriesData> = {};
  contractHistoriesData.forEach((history) => {
    if (!contractHistoriesByCompanyId[history.companyId]) {
      contractHistoriesByCompanyId[history.companyId] = [];
    }
    contractHistoriesByCompanyId[history.companyId].push(history);
  });

  const data = companies.map((c) => {
    // この企業の接触履歴を取得
    const companyContactHistories = contactHistoriesByCompanyId[c.companyId] || [];
    // この企業のアクティブな契約履歴を取得
    const companyContractHistories = contractHistoriesByCompanyId[c.companyId] || [];

    return {
    id: c.id,
    companyId: c.companyId,
    companyCode: c.company.companyCode,
    companyName: c.company.name,
    note: c.note,
    leadAcquiredDate: c.leadAcquiredDate?.toISOString(),
    // 最終接触日（接触履歴の最新日時）
    latestContactDate: companyContactHistories.length > 0
      ? companyContactHistories[0].contactDate.toISOString()
      : null,
    currentStageId: c.currentStageId,
    currentStageName: c.currentStage?.name,
    nextTargetStageId: c.nextTargetStageId,
    nextTargetStageName: c.nextTargetStage?.name,
    nextTargetDate: c.nextTargetDate?.toISOString(),
    forecast: c.forecast,
    plannedHires: c.plannedHires,
    // 契約書情報
    contracts: c.contracts,
    salesStaffId: c.salesStaffId,
    salesStaffName: c.salesStaff?.name,
    agentId: c.agentId,
    agentCompanyId: c.agent?.companyId || null, // 代理店の全顧客マスタID（リンク用）
    agentCompanyCode: c.agent?.company?.companyCode || null,
    agentName: c.agent?.company?.name || null,
    // 全顧客マスタから取得
    industry: c.company.industry,
    revenueScale: c.company.revenueScale,
    websiteUrl: c.company.websiteUrl,
    // 請求先情報
    billingLocationId: c.billingLocationId,
    billingAddress: c.billingAddress,
    // billingRepresentativeには担当者IDが保存されている
    billingContactIds: c.billingRepresentative,
    // 請求先担当者（名前とメールを統合表示）
    billingContacts: (() => {
      if (!c.billingRepresentative) return null;
      const contactIds = c.billingRepresentative.split(",").map((id) => Number(id.trim()));
      const contactInfoList = contactIds
        .map((id) => {
          const contact = c.company.contacts.find((contact) => contact.id === id);
          if (!contact) return null;
          return contact.email ? `${contact.name} (${contact.email})` : contact.name;
        })
        .filter((info): info is string => !!info);
      return contactInfoList.length > 0 ? contactInfoList : null;
    })(),
    // 検討理由・失注理由
    pendingReason: c.pendingReason,
    lostReason: c.lostReason,
    // 流入経路
    leadSourceId: c.leadSourceId,
    leadSourceName: c.leadSource?.name,
    // 全顧客マスタの拠点・担当者（選択肢用）
    companyLocations: c.company.locations,
    companyContacts: c.company.contacts,
    // 接触履歴
    contactHistoryCount: companyContactHistories.length,
    contactHistories: companyContactHistories.map((h) => {
      // スタッフIDからスタッフ名を取得
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
    }),
    // MasterContract（契約書管理）
    masterContracts: (masterContractsByCompanyId[c.companyId] || []).map((mc) => ({
      id: mc.id,
      contractType: mc.contractType,
      title: mc.title,
      contractNumber: mc.contractNumber,
      startDate: mc.startDate?.toISOString() || null,
      endDate: mc.endDate?.toISOString() || null,
      currentStatusId: mc.currentStatusId,
      currentStatusName: mc.currentStatus?.name || null,
      targetDate: mc.targetDate?.toISOString() || null,
      signedDate: mc.signedDate?.toISOString() || null,
      signingMethod: mc.signingMethod,
      filePath: mc.filePath,
      fileName: mc.fileName,
      assignedTo: mc.assignedTo,
      note: mc.note,
    })),
    // 契約履歴（アクティブな契約のみ）- 契約関連データ用
    activeContractHistories: companyContractHistories.map((ch) => ({
      id: ch.id,
      industryType: ch.industryType,
      contractPlan: ch.contractPlan,
      jobMedia: ch.jobMedia,
      contractStartDate: ch.contractStartDate.toISOString(),
      initialFee: ch.initialFee,
      monthlyFee: ch.monthlyFee,
      performanceFee: ch.performanceFee,
      salesStaffName: ch.salesStaff?.name || null,
      operationStaffName: ch.operationStaff?.name || null,
      note: ch.note,
      operationStatus: ch.operationStatus,
      accountId: ch.accountId,
      accountPass: ch.accountPass,
    })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
  });

  // 契約書ステータス選択肢
  const masterContractStatusOptions = masterContractStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const companyOptions = masterCompanies.map((c) => ({
    value: String(c.id),
    label: `${c.companyCode} ${c.name}`,
  }));

  const stageOptions = stages.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const agentOptions = agents.map((a) => ({
    value: String(a.id),
    label: a.company.name,
  }));

  const staffOptions = staff.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // 契約書用：STPプロジェクトに割り当てられたスタッフのみ
  const contractStaffOptions = staffProjectAssignments
    .filter((a) => a.staff.isActive)
    .map((a) => ({
      value: String(a.staff.id),
      label: a.staff.name,
    }));

  // プロジェクトごとの担当者オプション（接触履歴モーダル用）
  const staffByProject: Record<number, { value: string; label: string }[]> = {};
  allStaffProjectAssignments.forEach((assignment) => {
    if (!assignment.staff.isActive) return;
    if (!staffByProject[assignment.projectId]) {
      staffByProject[assignment.projectId] = [];
    }
    // 重複チェック
    if (!staffByProject[assignment.projectId].some(s => s.value === String(assignment.staff.id))) {
      staffByProject[assignment.projectId].push({
        value: String(assignment.staff.id),
        label: assignment.staff.name,
      });
    }
  });

  const leadSourceOptions = leadSources.map((ls) => ({
    value: String(ls.id),
    label: ls.name,
  }));

  const contactMethodOptions = contactMethods.map((m) => ({
    value: String(m.id),
    label: m.name,
  }));

  // 請求先住所の選択肢（企業ごと）- キーは文字列
  const billingAddressByCompany: Record<string, { value: string; label: string }[]> = {};
  masterCompanies.forEach((mc) => {
    billingAddressByCompany[String(mc.id)] = mc.locations
      .filter((loc) => loc.address)
      .map((loc) => ({
        value: loc.address!,
        label: `${loc.name}: ${loc.address}`,
      }));
  });

  // 請求先担当者の選択肢（企業ごと）- キーは文字列、値はcontact ID
  const billingContactByCompany: Record<string, { value: string; label: string }[]> = {};
  masterCompanies.forEach((mc) => {
    billingContactByCompany[String(mc.id)] = mc.contacts.map((contact) => ({
      value: String(contact.id),
      label: `${contact.name}${contact.email ? ` (${contact.email})` : ''}`,
    }));
  });

  // ステージ情報（検討中・失注のステージIDを取得）
  const pendingStageId = stages.find((s) => s.stageType === 'pending')?.id;
  const lostStageId = stages.find((s) => s.stageType === 'closed_lost')?.id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">STP 企業情報</h1>
      <Card>
        <CardHeader>
          <CardTitle>企業一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <StpCompaniesTable
            data={data}
            companyOptions={companyOptions}
            stageOptions={stageOptions}
            agentOptions={agentOptions}
            staffOptions={staffOptions}
            contractStaffOptions={contractStaffOptions}
            leadSourceOptions={leadSourceOptions}
            billingAddressByCompany={billingAddressByCompany}
            billingContactByCompany={billingContactByCompany}
            contactMethodOptions={contactMethodOptions}
            pendingStageId={pendingStageId}
            lostStageId={lostStageId}
            masterContractStatusOptions={masterContractStatusOptions}
            customerTypes={customerTypes}
            staffByProject={staffByProject}
          />
        </CardContent>
      </Card>
    </div>
  );
}
