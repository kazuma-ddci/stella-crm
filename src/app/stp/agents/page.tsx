import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentsTable } from "./agents-table";
import { getStaffOptionsByField } from "@/lib/staff/get-staff-by-field";
import crypto from "crypto";

// ユニークなトークンを生成
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// トークンがない代理店に対してトークンを生成
async function ensureLeadFormTokensExist() {
  const agentsWithoutToken = await prisma.stpAgent.findMany({
    where: {
      leadFormToken: null,
    },
    select: { id: true },
  });

  if (agentsWithoutToken.length > 0) {
    await prisma.$transaction(
      agentsWithoutToken.map((agent) =>
        prisma.stpLeadFormToken.create({
          data: {
            token: generateToken(),
            agentId: agent.id,
            status: "active",
          },
        })
      )
    );
  }
}

export default async function StpAgentsPage() {
  const STP_PROJECT_ID = 1; // 採用ブースト

  // 既存代理店にトークンがなければ自動生成
  await ensureLeadFormTokensExist();

  const [agents, masterCompanies, staff, staffProjectAssignments, allStaffProjectAssignments, contactMethods, masterContractStatuses, masterContracts, contactHistories, customerTypes, stpCompanies] = await Promise.all([
    prisma.stpAgent.findMany({
      include: {
        company: {
          include: {
            locations: {
              where: { deletedAt: null },
              orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
              take: 1,
            },
          },
        },
        referrerCompany: true,
        staffAssignments: {
          include: {
            staff: true,
          },
        },
        contracts: {
          orderBy: { signedDate: "desc" },
        },
        leadFormToken: true,
        stpCompanies: {
          include: {
            contracts: true,
            company: true,
            currentStage: true,
          },
        },
        agentContractHistories: {
          where: { deletedAt: null },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.masterStellaCompany.findMany({
      orderBy: { companyCode: "desc" },
    }),
    prisma.masterStaff.findMany({
      where: { isActive: true, isSystemUser: false },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.staffProjectAssignment.findMany({
      where: { projectId: STP_PROJECT_ID },
      include: { staff: true },
    }),
    // 全プロジェクトのスタッフ割当（接触履歴モーダルでプロジェクト連動担当者選択に使用）
    prisma.staffProjectAssignment.findMany({
      include: { staff: true, project: true },
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
    // 接触履歴（顧客種別「代理店」のコンテキストを持つもの）
    prisma.contactHistory.findMany({
      where: {
        deletedAt: null,
        roles: {
          some: {
            customerType: {
              projectId: STP_PROJECT_ID,
              name: "代理店",
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
    // 全STP企業（紹介件数・契約件数計算用）
    prisma.stpCompany.findMany({
      include: {
        contracts: {
          where: { status: "signed" },
        },
      },
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

  // 契約ステータス計算用の今日の日付
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // companyIdの重複を検出（企業統合で「両方残す」を選んだ場合）
  const agentCompanyIdCounts: Record<number, number> = {};
  agents.forEach((a) => {
    agentCompanyIdCounts[a.companyId] = (agentCompanyIdCounts[a.companyId] || 0) + 1;
  });

  const data = agents.map((a) => {
    const primaryLocation = a.company.locations[0];
    // この代理店の接触履歴を取得
    const agentContactHistories = contactHistoriesByCompanyId[a.companyId] || [];

    // 紹介件数：この代理店が紹介したSTP企業の数
    const referralCount = a.stpCompanies.length;

    // 契約件数：この代理店が紹介したSTP企業のうち、契約書がsignedの企業数
    const contractedCount = a.stpCompanies.filter((sc) =>
      sc.contracts.some((c) => c.status === "signed")
    ).length;

    // 紹介企業一覧（モーダル表示用）
    const stpCompaniesData = a.stpCompanies.map((sc) => ({
      id: sc.id,
      companyId: sc.companyId,
      companyName: sc.company.name,
      companyCode: sc.company.companyCode,
      currentStageName: sc.currentStage?.name || "-",
      hasSignedContract: sc.contracts.some((c) => c.status === "signed"),
    }));

    return {
    hasDuplicateCompanyWarning: (agentCompanyIdCounts[a.companyId] || 0) > 1,
    id: a.id,
    companyId: a.companyId,
    companyCode: a.company.companyCode,
    companyName: a.company.name,
    companyEmail: primaryLocation?.email || null,
    companyPhone: primaryLocation?.phone || null,
    status: a.status,
    category1: a.category1,
    contractStatus: (() => {
      const histories = a.agentContractHistories;
      if (histories.length === 0) return "契約前";
      const hasActive = histories.some((h) => {
        const start = new Date(h.contractStartDate);
        start.setHours(0, 0, 0, 0);
        if (start > today) return false;
        if (!h.contractEndDate) return true;
        const end = new Date(h.contractEndDate);
        end.setHours(0, 0, 0, 0);
        return end >= today;
      });
      return hasActive ? "契約済み" : "契約終了";
    })(),
    referrerCompanyId: a.referrerCompanyId,
    referrerCompanyCode: a.referrerCompany?.companyCode || null,
    referrerCompanyName: a.referrerCompany?.name || null,
    note: a.note,
    // 顧問専用フィールド
    minimumCases: a.minimumCases,
    monthlyFee: a.monthlyFee,
    // 源泉徴収対応
    isIndividualBusiness: a.isIndividualBusiness,
    withholdingTaxRate: a.withholdingTaxRate ? Number(a.withholdingTaxRate) : null,
    // 担当者（複数）
    staffAssignments: a.staffAssignments.map((sa) => String(sa.staffId)).join(","),
    staffNames: a.staffAssignments.map((sa) => sa.staff.name).join(", "),
    // 紹介件数・契約件数
    referralCount,
    contractedCount,
    // 紹介企業一覧（モーダル表示用）
    stpCompanies: stpCompaniesData,
    // 契約書（件数表示）
    contractCount: a.contracts.length,
    contracts: a.contracts.map((c) => ({
      id: c.id,
      contractUrl: c.contractUrl,
      signedDate: c.signedDate?.toISOString(),
      title: c.title,
      externalId: c.externalId,
      externalService: c.externalService,
      status: c.status,
      note: c.note,
    })),
    // 接触履歴
    contactHistoryCount: agentContactHistories.length,
    // 最終接触日（接触履歴の最新日時）
    latestContactDate: agentContactHistories.length > 0
      ? agentContactHistories[0].contactDate.toISOString()
      : null,
    contactHistories: agentContactHistories.map((h) => {
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
    masterContracts: (masterContractsByCompanyId[a.companyId] || []).map((mc) => ({
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
    // リード獲得フォーム
    leadFormToken: a.leadFormToken?.token || null,
    leadFormTokenStatus: a.leadFormToken?.status || null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
  });

  // 契約書ステータス選択肢
  const masterContractStatusOptions = masterContractStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // 代理店として選択可能な企業（まだ代理店登録されていない企業）
  const existingAgentCompanyIds = agents.map((a) => a.companyId);
  const companyOptions = masterCompanies.map((c) => ({
    value: String(c.id),
    label: `${c.companyCode} ${c.name}`,
    disabled: existingAgentCompanyIds.includes(c.id),
  }));

  // 紹介者として選択可能な企業（全企業）
  const referrerOptions = masterCompanies.map((c) => ({
    value: String(c.id),
    label: `${c.companyCode} ${c.name}`,
  }));

  // 代理店担当者
  const staffOptions = await getStaffOptionsByField("STP_AGENT_STAFF");

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

  const contactMethodOptions = contactMethods.map((m) => ({
    value: String(m.id),
    label: m.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">STP 代理店情報</h1>
      <Card>
        <CardHeader>
          <CardTitle>代理店一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentsTable
            data={data}
            companyOptions={companyOptions}
            referrerOptions={referrerOptions}
            staffOptions={staffOptions}
            contractStaffOptions={contractStaffOptions}
            contactMethodOptions={contactMethodOptions}
            masterContractStatusOptions={masterContractStatusOptions}
            customerTypes={customerTypes}
            staffByProject={staffByProject}
          />
        </CardContent>
      </Card>
    </div>
  );
}
