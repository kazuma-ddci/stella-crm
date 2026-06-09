import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StpCompaniesTable } from "./stp-companies-table";
import { getStaffOptionsByField, getStaffOptionsByFields } from "@/lib/staff/get-staff-by-field";
import { elapsedPerfMs, logPerf, measurePerf, startPerfTimer } from "@/lib/perf-log";

type UnlockedProposalRow = { stpCompanyId: number | null };

export default async function StpCompaniesPage() {
  const pageStartedAt = startPerfTimer();
  const STP_PROJECT_ID = 1; // 採用ブースト

  const [companies, masterCompanies, stages, agents, staff, contractTypes, leadSources, contactMethods, masterContractStatuses, contactHistories, customerTypes, contractHistoriesData, unlockedProposalRows, stpProducts, contactCategories] = await Promise.all([
    measurePerf("page.stpCompanies", "stp-companies", () =>
      prisma.stpCompany.findMany({
        select: {
          id: true,
          companyId: true,
          note: true,
          leadAcquiredDate: true,
          leadValidity: true,
          currentStageId: true,
          nextTargetStageId: true,
          nextTargetDate: true,
          forecast: true,
          plannedHires: true,
          dealProbability: true,
          nextContactDate: true,
          salesStaffId: true,
          adminStaffId: true,
          asStaffId: true,
          agentId: true,
          leadSourceId: true,
          billingLocationId: true,
          billingAddress: true,
          billingRepresentative: true,
          hasDeal: true,
          proposedProductIds: true,
          pendingReason: true,
          lostReasonOptionId: true,
          lostReason: true,
          createdAt: true,
          updatedAt: true,
          currentStage: { select: { id: true, name: true, stageType: true } },
          nextTargetStage: { select: { id: true, name: true, stageType: true } },
          leadSource: { select: { id: true, name: true } },
          salesStaff: { select: { id: true, name: true } },
          adminStaff: { select: { id: true, name: true } },
          asStaff: { select: { id: true, name: true } },
          lostReasonOption: { select: { id: true, name: true } },
          agent: {
            select: {
              id: true,
              companyId: true,
              company: { select: { id: true, companyCode: true, name: true } },
            },
          },
          company: {
            select: {
              id: true,
              companyCode: true,
              name: true,
              industry: true,
              revenueScale: true,
              websiteUrl: true,
              locations: {
                where: { deletedAt: null },
                select: { id: true, name: true, address: true },
              },
              contacts: {
                where: { deletedAt: null },
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      }),
      500
    ),
    measurePerf("page.stpCompanies", "master-companies", () =>
      prisma.masterStellaCompany.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          companyCode: true,
          name: true,
          locations: {
            where: { deletedAt: null },
            select: { id: true, name: true, address: true },
          },
          contacts: {
            where: { deletedAt: null },
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { id: "desc" },
      }),
      500
    ),
    measurePerf("page.stpCompanies", "stages", () =>
      prisma.stpStage.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      200
    ),
    measurePerf("page.stpCompanies", "agents", () =>
      prisma.stpAgent.findMany({
        where: { status: "アクティブ" },
        select: { id: true, company: { select: { id: true, name: true } } },
        orderBy: { id: "asc" },
      }),
      200
    ),
    measurePerf("page.stpCompanies", "staff", () =>
      prisma.masterStaff.findMany({
        where: { isActive: true, isSystemUser: false },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      }),
      200
    ),
    measurePerf("page.stpCompanies", "contract-types", () =>
      prisma.contractType.findMany({
        where: { projectId: STP_PROJECT_ID, isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      200
    ),
    measurePerf("page.stpCompanies", "lead-sources", () =>
      prisma.stpLeadSource.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      200
    ),
    measurePerf("page.stpCompanies", "contact-methods", () =>
      prisma.contactMethod.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      200
    ),
    measurePerf("page.stpCompanies", "master-contract-statuses", () =>
      prisma.masterContractStatus.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      200
    ),
    // 接触履歴（顧客種別「企業」のコンテキストを持つもの）
    measurePerf("page.stpCompanies", "contact-histories", () =>
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
        select: {
          id: true,
          companyId: true,
          contactDate: true,
          contactMethodId: true,
          contactCategoryId: true,
          assignedTo: true,
          customerParticipants: true,
          meetingMinutes: true,
          note: true,
          contactMethod: { select: { id: true, name: true } },
          contactCategory: { select: { id: true, name: true } },
          files: {
            select: {
              id: true,
              filePath: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              url: true,
            },
          },
          roles: {
            select: {
              customerTypeId: true,
              customerType: { select: { id: true, name: true, projectId: true } },
            },
          },
        },
        orderBy: { contactDate: "desc" },
      }),
      500
    ),
    // 顧客種別マスタ（全プロジェクト - 接触履歴で複数プロジェクト選択可能にするため）
    measurePerf("page.stpCompanies", "customer-types", () =>
      prisma.customerType.findMany({
        where: { isActive: true },
        include: { project: true },
        orderBy: [
          { project: { displayOrder: "asc" } },
          { displayOrder: "asc" },
        ],
      }),
      200
    ),
    // 契約履歴（全件取得 - 期間内/期間外のフィルタはクライアントで行う）
    measurePerf("page.stpCompanies", "contract-histories", () =>
      prisma.stpContractHistory.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          companyId: true,
          industryType: true,
          contractPlan: true,
          jobMedia: true,
          contractStartDate: true,
          contractEndDate: true,
          initialFee: true,
          monthlyFee: true,
          performanceFee: true,
          note: true,
          operationStatus: true,
          accountId: true,
          accountPass: true,
          salesStaff: { select: { id: true, name: true } },
          operationStaff: { select: { id: true, name: true } },
        },
        orderBy: { contractStartDate: "desc" },
      }),
      500
    ),
    // エディタ提案書（権限未戻しチェック用）。巨大JSONを全件アプリへ渡さずDB側で判定する。
    measurePerf("page.stpCompanies", "unlocked-proposals", () =>
      prisma.$queryRaw<UnlockedProposalRow[]>`
        SELECT DISTINCT "stpCompanyId"
        FROM stp_proposals
        WHERE "deletedAt" IS NULL
          AND "sourceProposalId" IS NULL
          AND "stpCompanyId" IS NOT NULL
          AND "proposalContent" IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE("proposalContent"->'slides', '[]'::jsonb)) AS slide
            WHERE NULLIF(slide->>'editUnlockedAt', '') IS NOT NULL
              AND NULLIF(slide->>'deletedAt', '') IS NULL
          )
      `,
      500
    ),
    // 商材マスタを取得
    measurePerf("page.stpCompanies", "products", () =>
      prisma.stpProduct.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      200
    ),
    // 接触種別を取得
    measurePerf("page.stpCompanies", "contact-categories", () =>
      prisma.contactCategory.findMany({
        where: { isActive: true },
        include: { project: true },
        orderBy: [
          { project: { displayOrder: "asc" } },
          { displayOrder: "asc" },
        ],
      }),
      200
    ),
  ]);

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

  // 権限未戻しスライドを持つstpCompanyIdのセットを作成
  const companiesWithUnlockedSlides = new Set(
    unlockedProposalRows
      .map((row) => row.stpCompanyId)
      .filter((id): id is number => typeof id === "number")
  );

  // companyIdの重複を検出（企業統合で「両方残す」を選んだ場合）
  const companyIdCounts: Record<number, number> = {};
  companies.forEach((c) => {
    companyIdCounts[c.companyId] = (companyIdCounts[c.companyId] || 0) + 1;
  });

  // 契約履歴の状態を判定:
  //   "active"  = 今日時点で稼働中（開始日<=今日 かつ 終了日null or 終了日>=今日）
  //   "future"  = 未来開始（開始日>今日）
  //   "expired" = 終了済み（終了日<今日）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const getContractState = (ch: { contractStartDate: Date; contractEndDate: Date | null }): "active" | "future" | "expired" => {
    const start = new Date(ch.contractStartDate);
    start.setHours(0, 0, 0, 0);
    if (start > today) return "future";
    if (ch.contractEndDate) {
      const end = new Date(ch.contractEndDate);
      end.setHours(0, 0, 0, 0);
      if (end < today) return "expired";
    }
    return "active";
  };
  // 企業単位の契約状態ラベル（優先順: 契約中 > 契約中(未来) > 契約終了 > 空白）
  const computeContractStatusLabel = (states: ("active" | "future" | "expired")[]): string => {
    if (states.includes("active")) return "契約中";
    if (states.includes("future")) return "契約中(未来)";
    if (states.includes("expired")) return "契約終了";
    return "";
  };

  const data = companies.map((c) => {
    // この企業の接触履歴を取得
    const companyContactHistories = contactHistoriesByCompanyId[c.companyId] || [];
    // この企業の契約履歴を取得（全件）
    const companyContractHistories = contractHistoriesByCompanyId[c.companyId] || [];
    const contractStates = companyContractHistories.map(getContractState);

    return {
    hasDuplicateCompanyWarning: (companyIdCounts[c.companyId] || 0) > 1,
    hasUnlockedSlides: companiesWithUnlockedSlides.has(c.id),
    id: c.id,
    companyId: c.companyId,
    companyCode: c.company.companyCode,
    companyName: c.company.name,
    contractStatus: computeContractStatusLabel(contractStates),
    note: c.note,
    leadAcquiredDate: c.leadAcquiredDate?.toISOString(),
    leadValidity: c.leadValidity,
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
    salesStaffId: c.salesStaffId,
    salesStaffName: c.salesStaff?.name,
    dealProbability: c.dealProbability,
    nextContactDate: c.nextContactDate?.toISOString(),
    adminStaffId: c.adminStaffId,
    adminStaffName: c.adminStaff?.name,
    asStaffId: c.asStaffId,
    asStaffName: c.asStaff?.name,
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
    // 案件・商材
    hasDeal: c.hasDeal,
    proposedProductIds: c.proposedProductIds,
    // 検討理由・失注理由
    pendingReason: c.pendingReason,
    lostReasonOptionId: c.lostReasonOptionId,
    lostReasonOptionName: c.lostReasonOption?.name ?? null,
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
        contactCategoryId: h.contactCategoryId,
        contactCategoryName: h.contactCategory?.name || null,
        assignedTo: h.assignedTo,
        assignedToNames,
        customerParticipants: h.customerParticipants,
        meetingMinutes: h.meetingMinutes,
        note: h.note,
        customerTypeIds: h.roles.map((r) => r.customerTypeId),
        files: h.files.map((f) => ({
          id: f.id,
          filePath: f.filePath,
          fileName: f.fileName,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
          url: f.url,
        })),
      };
    }),
    // 契約履歴（全件、stateフラグ付き）- 契約関連データ用
    contractHistories: companyContractHistories.map((ch, i) => ({
      id: ch.id,
      industryType: ch.industryType,
      contractPlan: ch.contractPlan,
      jobMedia: ch.jobMedia,
      contractStartDate: ch.contractStartDate.toISOString(),
      contractEndDate: ch.contractEndDate?.toISOString() ?? null,
      initialFee: ch.initialFee,
      monthlyFee: ch.monthlyFee,
      performanceFee: ch.performanceFee,
      salesStaffName: ch.salesStaff?.name || null,
      operationStaffName: ch.operationStaff?.name || null,
      note: ch.note,
      operationStatus: ch.operationStatus,
      accountId: ch.accountId,
      accountPass: ch.accountPass,
      state: contractStates[i], // "active" | "future" | "expired"
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

  const staffOptionsByFieldResult = await measurePerf(
    "page.stpCompanies",
    "staff-options-by-fields",
    () => getStaffOptionsByFields(["STP_COMPANY_SALES", "STP_COMPANY_ADMIN", "CONTRACT_ASSIGNED_TO", "CONTACT_HISTORY_STAFF"]),
    500
  );
  const staffOptions = staffOptionsByFieldResult.STP_COMPANY_SALES;
  const adminStaffOptions = staffOptionsByFieldResult.STP_COMPANY_ADMIN;
  const contractStaffOptions = staffOptionsByFieldResult.CONTRACT_ASSIGNED_TO;
  const asStaff = await measurePerf(
    "page.stpCompanies",
    "as-staff-options",
    () =>
      prisma.masterStaff.findMany({
        where: {
          isActive: true,
          isSystemUser: false,
          roleAssignments: {
            some: {
              roleType: {
                isActive: true,
                OR: [{ code: "AS" }, { name: "AS" }],
              },
            },
          },
        },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      }),
    200
  );
  const asStaffOptions = asStaff.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // 契約種別選択肢
  const contractTypeOptions = contractTypes.map((ct) => ({
    value: ct.name,
    label: ct.name,
  }));

  // プロジェクトごとの担当者オプション（接触履歴モーダル用）
  const allProjects = await measurePerf(
    "page.stpCompanies",
    "active-projects",
    () => prisma.masterProject.findMany({ where: { isActive: true }, select: { id: true } }),
    200
  );
  const staffByProjectEntries = await measurePerf(
    "page.stpCompanies",
    "staff-options-by-project",
    () =>
      Promise.all(
        allProjects.map(async (project) => [
          project.id,
          await getStaffOptionsByField("CONTACT_HISTORY_STAFF", project.id),
        ] as const)
      ),
    500
  );
  const staffByProject: Record<number, { value: string; label: string }[]> = Object.fromEntries(staffByProjectEntries);

  const leadSourceOptions = leadSources.map((ls) => ({
    value: String(ls.id),
    label: ls.name,
  }));

  const contactMethodOptions = contactMethods.map((m) => ({
    value: String(m.id),
    label: m.name,
  }));

  const productOptions = stpProducts.map((p) => ({
    value: String(p.id),
    label: p.name,
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

  logPerf("page.stpCompanies", "total", elapsedPerfMs(pageStartedAt), { rows: data.length }, 500);

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
            adminStaffOptions={adminStaffOptions}
            asStaffOptions={asStaffOptions}
            contractStaffOptions={contractStaffOptions}
            contractTypeOptions={contractTypeOptions}
            leadSourceOptions={leadSourceOptions}
            billingAddressByCompany={billingAddressByCompany}
            billingContactByCompany={billingContactByCompany}
            contactMethodOptions={contactMethodOptions}
            productOptions={productOptions}
            pendingStageId={pendingStageId}
            lostStageId={lostStageId}
            masterContractStatusOptions={masterContractStatusOptions}
            customerTypes={customerTypes}
            staffByProject={staffByProject}
            contactCategories={contactCategories.map((cc) => ({
              id: cc.id,
              name: cc.name,
              projectId: cc.projectId,
              project: { id: cc.project.id, name: cc.project.name, displayOrder: cc.project.displayOrder },
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
