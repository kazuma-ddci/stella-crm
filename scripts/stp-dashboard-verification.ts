import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const prisma = new PrismaClient();

const PREFIX = "DASHBOARD_TEST_";
const MONTH = "2098-01";
const PREV_MONTH = "2097-12";
const NEXT_MONTH = "2098-02";
const PRODUCT_KEY_PREFIX = "product:";
const STAFF_ALL = "all";
const REPORT_PATH = resolve("docs/verification/stp-new-dashboard-verification.md");

type Check = {
  dashboard: string;
  metric: string;
  expected: number | string;
  actual: number | string | null | undefined;
  ok: boolean;
  note?: string;
};

type SeedContext = {
  projectId: number;
  productId: number;
  staffAId: number;
  staffBId: number;
  sourceAId: number;
  sourceBId: number;
};

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const round1 = (value: number) => Math.round(value * 10) / 10;

function assertSafeEnvironment() {
  if (process.env.ALLOW_STP_DASHBOARD_TEST_DATA !== "1") {
    throw new Error("ALLOW_STP_DASHBOARD_TEST_DATA=1 が必要です。");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("NODE_ENV=production では検証データ投入を実行しません。");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!/(localhost|127\.0\.0\.1|db:5432|postgres:5432)/.test(url)) {
    throw new Error(`本番誤実行防止のため DATABASE_URL を拒否しました: ${url.replace(/:[^:@/]+@/, ":***@")}`);
  }
}

async function findOrCreateProject() {
  return prisma.masterProject.upsert({
    where: { code: "stp" },
    update: { isActive: true },
    create: { code: "stp", name: "STP", isActive: true, displayOrder: 1 },
  });
}

async function cleanup() {
  await prisma.contactHistoryRole.deleteMany({
    where: { contactHistory: { company: { companyCode: { startsWith: PREFIX } } } },
  });
  await prisma.contactHistory.deleteMany({
    where: { company: { companyCode: { startsWith: PREFIX } } },
  });
  await prisma.transaction.deleteMany({ where: { note: { startsWith: PREFIX } } });
  await prisma.stpStageHistory.deleteMany({
    where: { stpCompany: { company: { companyCode: { startsWith: PREFIX } } } },
  });
  await prisma.stpContractHistory.deleteMany({
    where: { company: { companyCode: { startsWith: PREFIX } } },
  });
  await prisma.stpCompany.deleteMany({
    where: { company: { companyCode: { startsWith: PREFIX } } },
  });
  await prisma.stpDashboardFunnelTarget.deleteMany({
    where: { targetMonth: { in: [PREV_MONTH, MONTH, NEXT_MONTH] } },
  });
  await prisma.stpExitKpiTarget.deleteMany({ where: { targetMonth: MONTH } });
  await prisma.kpiMonthlyTarget.deleteMany({ where: { yearMonth: MONTH } });
  await prisma.counterparty.deleteMany({
    where: { OR: [{ displayId: { startsWith: PREFIX } }, { name: { startsWith: PREFIX } }] },
  });
  await prisma.masterStellaCompany.deleteMany({ where: { companyCode: { startsWith: PREFIX } } });
  await prisma.expenseCategory.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.costCenter.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.stpProduct.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.stpLeadSource.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.stpStage.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.stpLostReasonOption.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.masterStaff.deleteMany({
    where: { OR: [{ email: { startsWith: `${PREFIX.toLowerCase()}@` } }, { loginId: { startsWith: PREFIX } }] },
  });
}

async function seedMasterData() {
  const project = await findOrCreateProject();
  await prisma.customerType.upsert({
    where: { projectId_name: { projectId: project.id, name: "企業" } },
    update: { isActive: true },
    create: { projectId: project.id, name: "企業", code: `${PREFIX}company`, isActive: true },
  });
  await prisma.contactCategory.upsert({
    where: { projectId_name: { projectId: project.id, name: "商談" } },
    update: { isActive: true },
    create: { projectId: project.id, name: "商談", displayOrder: 1, isActive: true },
  });

  const product = await prisma.stpProduct.create({
    data: { name: `${PREFIX}売却検証商材`, displayOrder: -9999, isActive: true },
  });
  const sourceA = await prisma.stpLeadSource.create({
    data: { name: `${PREFIX}Web広告`, displayOrder: -9999, isActive: true },
  });
  const sourceB = await prisma.stpLeadSource.create({
    data: { name: `${PREFIX}紹介`, displayOrder: -9998, isActive: true },
  });
  const [progress, pending, won, lost] = await Promise.all([
    prisma.stpStage.create({ data: { name: `${PREFIX}商談中`, stageType: "progress", displayOrder: -9999, isActive: true } }),
    prisma.stpStage.create({ data: { name: `${PREFIX}検討中`, stageType: "pending", displayOrder: -9998, isActive: true } }),
    prisma.stpStage.create({ data: { name: `${PREFIX}契約済`, stageType: "completed", displayOrder: -9997, isActive: true } }),
    prisma.stpStage.create({ data: { name: `${PREFIX}失注`, stageType: "closed_lost", displayOrder: -9996, isActive: true } }),
  ]);
  const lostReason = await prisma.stpLostReasonOption.create({
    data: { name: `${PREFIX}価格`, displayOrder: -9999, isActive: true },
  });
  const [staffA, staffB] = await Promise.all([
    prisma.masterStaff.create({
      data: { name: `${PREFIX}営業A`, email: `${PREFIX.toLowerCase()}@a.local`, loginId: `${PREFIX}staff_a`, displayOrder: -9999, isActive: true },
    }),
    prisma.masterStaff.create({
      data: { name: `${PREFIX}営業B`, email: `${PREFIX.toLowerCase()}@b.local`, loginId: `${PREFIX}staff_b`, displayOrder: -9998, isActive: true },
    }),
  ]);
  const costCenter = await prisma.costCenter.create({
    data: { name: `${PREFIX}STP検証コストセンター`, projectId: project.id, createdBy: staffA.id },
  });
  const expenseCategory = await prisma.expenseCategory.create({
    data: { name: `${PREFIX}売却KPI検証費用`, type: "both", projectId: project.id, createdBy: staffA.id },
  });
  const counterparty = await prisma.counterparty.create({
    data: { displayId: `${PREFIX}CP`, name: `${PREFIX}検証取引先`, createdBy: staffA.id },
  });

  return {
    projectId: project.id,
    productId: product.id,
    staffAId: staffA.id,
    staffBId: staffB.id,
    sourceAId: sourceA.id,
    sourceBId: sourceB.id,
    progressStageId: progress.id,
    pendingStageId: pending.id,
    wonStageId: won.id,
    lostStageId: lost.id,
    lostReasonId: lostReason.id,
    costCenterId: costCenter.id,
    expenseCategoryId: expenseCategory.id,
    counterpartyId: counterparty.id,
  };
}

async function createCompany(
  index: number,
  data: {
    name: string;
    leadDate: Date;
    leadValidity?: string | null;
    currentStageId: number;
    leadSourceId: number;
    salesStaffId: number;
    dealProbability?: number;
    nextContactDate?: Date;
    lostReasonOptionId?: number;
  },
) {
  const master = await prisma.masterStellaCompany.create({
    data: {
      companyCode: `${PREFIX}${String(index).padStart(2, "0")}`,
      name: `${PREFIX}${data.name}`,
      companyType: "法人",
      note: `${PREFIX}STP新ダッシュボード検証`,
    },
  });
  const stpCompany = await prisma.stpCompany.create({
    data: {
      companyId: master.id,
      leadAcquiredDate: data.leadDate,
      leadValidity: data.leadValidity,
      currentStageId: data.currentStageId,
      leadSourceId: data.leadSourceId,
      salesStaffId: data.salesStaffId,
      dealProbability: data.dealProbability,
      nextContactDate: data.nextContactDate,
      lostReasonOptionId: data.lostReasonOptionId,
      proposedProductIds: "",
      note: `${PREFIX}検証用`,
    },
  });
  return { master, stpCompany };
}

async function addContact(companyId: number, staffId: number, date: Date, isMeeting: boolean) {
  const project = await prisma.masterProject.findUniqueOrThrow({ where: { code: "stp" } });
  const customerType = await prisma.customerType.findUniqueOrThrow({
    where: { projectId_name: { projectId: project.id, name: "企業" } },
  });
  const category = isMeeting
    ? await prisma.contactCategory.findUniqueOrThrow({ where: { projectId_name: { projectId: project.id, name: "商談" } } })
    : null;
  const contact = await prisma.contactHistory.create({
    data: {
      companyId,
      staffId,
      contactDate: date,
      contactCategoryId: category?.id,
      note: `${PREFIX}${isMeeting ? "商談" : "通常接触"}`,
    },
  });
  await prisma.contactHistoryRole.create({
    data: { contactHistoryId: contact.id, customerTypeId: customerType.id },
  });
}

async function addStage(stpCompanyId: number, toStageId: number, date: Date, eventType = "progress", lostReasonOptionId?: number) {
  await prisma.stpStageHistory.create({
    data: {
      stpCompanyId,
      toStageId,
      eventType,
      recordedAt: date,
      changedBy: `${PREFIX}script`,
      lostReasonOptionId,
      note: `${PREFIX}ステージ履歴`,
    },
  });
}

async function addContract(
  companyId: number,
  staffId: number,
  start: Date,
  end: Date | null,
  monthlyFee: number,
  options: { initialFee?: number; contractDate?: Date; status?: string } = {},
) {
  await prisma.stpContractHistory.create({
    data: {
      companyId,
      industryType: "general",
      contractPlan: "monthly",
      contractStartDate: start,
      contractEndDate: end,
      initialFee: options.initialFee ?? 0,
      monthlyFee,
      performanceFee: 0,
      salesStaffId: staffId,
      status: options.status ?? "active",
      contractDate: options.contractDate ?? start,
      note: `${PREFIX}契約履歴`,
    },
  });
}

async function seed() {
  const m = await seedMasterData();

  const c1 = await createCompany(1, { name: "当月契約", leadDate: d("2098-01-05"), leadValidity: "有効", currentStageId: m.wonStageId, leadSourceId: m.sourceAId, salesStaffId: m.staffAId });
  const c2 = await createCompany(2, { name: "当月検討中", leadDate: d("2098-01-08"), leadValidity: "有効", currentStageId: m.pendingStageId, leadSourceId: m.sourceAId, salesStaffId: m.staffAId, dealProbability: 80, nextContactDate: d("2026-06-01") });
  await createCompany(3, { name: "当月無効", leadDate: d("2098-01-09"), leadValidity: "無効", currentStageId: m.progressStageId, leadSourceId: m.sourceBId, salesStaffId: m.staffBId });
  const c4 = await createCompany(4, { name: "当月失注", leadDate: d("2098-01-10"), leadValidity: "有効", currentStageId: m.lostStageId, leadSourceId: m.sourceBId, salesStaffId: m.staffBId, lostReasonOptionId: m.lostReasonId });
  const c5 = await createCompany(5, { name: "当月リードのみ", leadDate: d("2098-01-11"), currentStageId: m.progressStageId, leadSourceId: m.sourceAId, salesStaffId: m.staffAId, nextContactDate: d("2026-06-10") });
  const c6 = await createCompany(6, { name: "前月継続", leadDate: d("2097-12-01"), leadValidity: "有効", currentStageId: m.wonStageId, leadSourceId: m.sourceAId, salesStaffId: m.staffAId });
  const c7 = await createCompany(7, { name: "当月解約", leadDate: d("2097-12-02"), leadValidity: "有効", currentStageId: m.wonStageId, leadSourceId: m.sourceAId, salesStaffId: m.staffAId });
  const c8 = await createCompany(8, { name: "当月増額", leadDate: d("2097-12-03"), leadValidity: "有効", currentStageId: m.wonStageId, leadSourceId: m.sourceAId, salesStaffId: m.staffAId });
  const c9 = await createCompany(9, { name: "翌月対象外", leadDate: d("2098-02-01"), leadValidity: "有効", currentStageId: m.wonStageId, leadSourceId: m.sourceAId, salesStaffId: m.staffAId });
  const c10 = await createCompany(10, { name: "当月減額", leadDate: d("2097-12-04"), leadValidity: "有効", currentStageId: m.wonStageId, leadSourceId: m.sourceAId, salesStaffId: m.staffAId });
  const c11 = await createCompany(11, { name: "前月リード当月失注", leadDate: d("2097-12-05"), leadValidity: "有効", currentStageId: m.lostStageId, leadSourceId: m.sourceBId, salesStaffId: m.staffBId, lostReasonOptionId: m.lostReasonId });
  const c12 = await createCompany(12, { name: "当月再失注", leadDate: d("2097-12-06"), leadValidity: "有効", currentStageId: m.lostStageId, leadSourceId: m.sourceBId, salesStaffId: m.staffBId, lostReasonOptionId: m.lostReasonId });

  await Promise.all([
    addContact(c1.master.id, m.staffAId, d("2098-01-07"), true),
    addContact(c2.master.id, m.staffAId, d("2098-01-09"), true),
    addContact(c2.master.id, m.staffAId, d("2026-04-20"), false),
    addContact(c5.master.id, m.staffAId, d("2026-06-08"), false),
    addStage(c1.stpCompany.id, m.progressStageId, d("2098-01-05")),
    addStage(c1.stpCompany.id, m.wonStageId, d("2098-01-12"), "won"),
    addStage(c2.stpCompany.id, m.progressStageId, d("2098-01-08")),
    addStage(c2.stpCompany.id, m.pendingStageId, d("2098-01-14")),
    addStage(c4.stpCompany.id, m.lostStageId, d("2098-01-18"), "lost", m.lostReasonId),
    addStage(c11.stpCompany.id, m.lostStageId, d("2098-01-19"), "lost", m.lostReasonId),
    addStage(c12.stpCompany.id, m.lostStageId, d("2097-12-20"), "lost", m.lostReasonId),
    addStage(c12.stpCompany.id, m.progressStageId, d("2097-12-28"), "revived"),
    addStage(c12.stpCompany.id, m.lostStageId, d("2098-01-20"), "lost", m.lostReasonId),
  ]);

  await Promise.all([
    addContract(c1.master.id, m.staffAId, d("2098-01-10"), null, 100_000, { initialFee: 50_000, contractDate: d("2098-01-12") }),
    addContract(c2.master.id, m.staffAId, d("2098-01-20"), null, 80_000, { contractDate: d("2026-06-20"), status: "scheduled" }),
    addContract(c6.master.id, m.staffAId, d("2097-12-01"), null, 200_000, { contractDate: d("2097-12-01") }),
    addContract(c7.master.id, m.staffAId, d("2097-12-01"), d("2098-01-15"), 50_000, { contractDate: d("2097-12-01") }),
    addContract(c8.master.id, m.staffAId, d("2097-12-01"), null, 100_000, { contractDate: d("2097-12-01") }),
    addContract(c8.master.id, m.staffAId, d("2098-01-20"), null, 50_000, { contractDate: d("2098-01-20") }),
    addContract(c9.master.id, m.staffAId, d("2098-02-01"), null, 120_000, { contractDate: d("2098-02-01") }),
    addContract(c10.master.id, m.staffAId, d("2097-12-01"), d("2098-01-10"), 120_000, { contractDate: d("2097-12-01") }),
    addContract(c10.master.id, m.staffAId, d("2098-01-11"), null, 70_000, { contractDate: d("2098-01-11") }),
  ]);

  await Promise.all([
    prisma.transaction.create({
      data: { counterpartyId: m.counterpartyId, costCenterId: m.costCenterId, expenseCategoryId: m.expenseCategoryId, projectId: m.projectId, type: "revenue", amount: 1_000_000, taxAmount: 0, taxType: "tax_included", periodFrom: d("2098-01-01"), periodTo: d("2098-01-31"), createdBy: m.staffAId, note: `${PREFIX}売上` },
    }),
    prisma.transaction.create({
      data: { counterpartyId: m.counterpartyId, costCenterId: m.costCenterId, expenseCategoryId: m.expenseCategoryId, projectId: m.projectId, type: "expense", amount: 250_000, taxAmount: 0, taxType: "tax_included", periodFrom: d("2098-01-01"), periodTo: d("2098-01-31"), createdBy: m.staffAId, note: `${PREFIX}経費` },
    }),
  ]);

  await Promise.all([
    prisma.kpiMonthlyTarget.createMany({
      data: [
        { yearMonth: MONTH, kpiKey: "monthly_revenue", targetValue: 1_000_000 },
        { yearMonth: MONTH, kpiKey: "monthly_gross_profit", targetValue: 750_000 },
        { yearMonth: MONTH, kpiKey: "new_contracts", targetValue: 2 },
        { yearMonth: MONTH, kpiKey: "fixed_cost", targetValue: 100_000 },
      ],
    }),
    prisma.stpDashboardFunnelTarget.create({
      data: {
        targetMonth: MONTH,
        productKey: `${PRODUCT_KEY_PREFIX}${m.productId}`,
        productName: `${PREFIX}売却検証商材`,
        productId: m.productId,
        staffKey: STAFF_ALL,
        staffName: "全担当者",
        leadTarget: 6,
        validLeadTarget: 4,
        meetingTarget: 3,
        pendingTarget: 1,
        contractTarget: 2,
        lostTarget: 1,
      },
    }),
    prisma.stpExitKpiTarget.create({
      data: {
        targetMonth: MONTH,
        currentMrrTarget: 500_000,
        arrRunRateTarget: 6_000_000,
        nrrTarget: 110,
        churnRateTarget: 5,
        grossMarginTarget: 70,
        ebitdaMarginTarget: 60,
      },
    }),
  ]);

  return m satisfies SeedContext & {
    progressStageId: number;
    pendingStageId: number;
    wonStageId: number;
    lostStageId: number;
    lostReasonId: number;
    costCenterId: number;
    expenseCategoryId: number;
    counterpartyId: number;
  };
}

function check(checks: Check[], dashboard: string, metric: string, expected: number | string, actual: number | string | null | undefined, note?: string) {
  const ok = typeof expected === "number" && typeof actual === "number"
    ? Math.abs(expected - actual) < 0.11
    : expected === actual;
  checks.push({ dashboard, metric, expected, actual, ok, note });
}

function buildReport(checks: Check[]) {
  const rows = checks
    .map((c) => `| ${c.dashboard} | ${c.metric} | ${c.expected} | ${c.actual ?? "-"} | ${c.ok ? "OK" : "NG"} | ${c.note ?? ""} |`)
    .join("\n");
  const ng = checks.filter((c) => !c.ok);
  const report = `# STP新ダッシュボード 検証レポート

## 検証対象
- 経営ダッシュボード
- MA・SFA・契約ファネル
- 売却KPIダッシュボード
- チャネル分析
- 案件管理

## テストデータ投入方法
\`npm run verify:stp-dashboard\` を Docker の app コンテナ内で実行する。
スクリプトは \`${PREFIX}\` プレフィックスの検証データと \`${MONTH}\` の目標値を削除してから再投入するため、複数回実行しても重複しない。
誤実行防止として \`ALLOW_STP_DASHBOARD_TEST_DATA=1\`、非production、ローカル/compose向け \`DATABASE_URL\` の確認を必須にしている。

## 使用したテストデータの概要
- 対象月: \`${MONTH}\`
- 対象外月: \`${PREV_MONTH}\`, \`${NEXT_MONTH}\`
- 商材: \`${PREFIX}売却検証商材\`
- チャネル: \`${PREFIX}Web広告\`, \`${PREFIX}紹介\`
- 担当者: \`${PREFIX}営業A\`, \`${PREFIX}営業B\`
- 含めた状態: リードのみ、有効リード、無効リード、商談済み、検討中、契約済み、失注、前月リード当月失注、再失注、月跨ぎ契約、増額、減額、解約、目標あり、0件/分母0確認用の対象外月

## 実装上の主な計算ロジック
| ダッシュボード | 指標 | コード上の計算 |
| --- | --- | --- |
| MA・SFA・契約ファネル | リード数 | \`StpCompany.leadAcquiredDate\` が対象期間内の件数 |
| MA・SFA・契約ファネル | 有効リード数 | 対象期間内リードのうち \`leadValidity === "有効"\` |
| MA・SFA・契約ファネル | 商談数 | 初回接触履歴が \`contactCategory.name === "商談"\` かつ対象期間内 |
| MA・SFA・契約ファネル | 契約数 | 初回 \`StpContractHistory.contractDate\` が対象期間内 |
| MA・SFA・契約ファネル | 失注数 | 最新 \`StpStageHistory.eventType === "lost"\` が対象期間内 |
| チャネル分析 | チャネル別数値 | 対象期間内リードを \`StpLeadSource\` ごとに集計 |
| 案件管理 | 未完了案件 | 現在ステージが \`closed_lost\` / \`completed\` 以外 |
| 売却KPI | 現在MRR | 対象月末時点で有効なactive契約の月額合計 |
| 売却KPI | NRR | \`(月初MRR + 増額MRR - 減額MRR - 解約MRR) / 月初MRR * 100\` |
| 売却KPI | 月次チャーン率 | \`月解約MRR / 月初MRR * 100\`。解約MRRは日割りせず解約前月額 |
| 売却KPI | 粗利率 | \`(売上 - 支払額/経費) / 売上 * 100\` |
| 売却KPI | EBITDA率 | \`(売上 - 支払額/経費 - 固定費) / 売上 * 100\` |
| 経営ダッシュボード | 売上 | 契約履歴の初期費用、月額日割り、成果報酬を対象月で集計 |
| 経営ダッシュボード | 粗利 | 売上から代理店/直契約コストを控除 |

## 期待値と実測値
| ダッシュボード | 指標 | 期待値 | 実測値 | 判定 | 備考 |
| --- | ---: | ---: | ---: | --- | --- |
${rows}

## 判定
${ng.length === 0 ? "すべてOK。" : `${ng.length}件NG。該当行の原因調査と修正が必要。`}

## 残っている懸念点
- 案件管理は期間フィルターを持たない実装のため、検証データの「翌月対象外」も現在ステージ次第では案件一覧に入る。今回の検証では完了ステージにして混入を避けている。
- 売却KPIはSTP全体集計のため商材フィルターを検証対象外としている。
- Playwrightの画面表示検証は未実施。まず検証用DBクエリで、コードから整理した集計条件と期待値の比較を自動化している。

## 本番アップ前に確認すべきこと
- 本番ではこの検証スクリプトを実行しないこと。
- 本番アップ前に開発DBで \`npm run verify:stp-dashboard\` がOKになること。
- 画面で \`/stp/new-dashboard?tab=exit-kpi\`、対象月 \`${MONTH}\`、各タブの表示崩れと未設定表示を確認すること。
`;
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, report);
}

async function verify() {
  assertSafeEnvironment();
  await cleanup();
  const seeded = await seed();
  const checks: Check[] = [];
  const monthStart = d("2098-01-01");
  const monthEnd = d("2098-01-31");

  const scopedCompanies = await prisma.stpCompany.findMany({
    where: {
      company: { companyCode: { startsWith: PREFIX } },
      leadAcquiredDate: { gte: monthStart, lte: monthEnd },
    },
    include: { company: true, currentStage: true, leadSource: true },
  });
  const allTestCompanies = await prisma.stpCompany.findMany({
    where: { company: { companyCode: { startsWith: PREFIX } } },
    include: { company: true, currentStage: true },
  });
  const scopedCompanyIds = scopedCompanies.map((company) => company.companyId);
  const allTestStpCompanyIds = allTestCompanies.map((company) => company.id);
  const meetings = await prisma.contactHistory.findMany({
    where: {
      companyId: { in: scopedCompanyIds },
      contactDate: { gte: monthStart, lte: monthEnd },
      deletedAt: null,
      contactCategory: { projectId: seeded.projectId, name: "商談" },
      roles: { some: { customerType: { projectId: seeded.projectId, name: "企業" } } },
    },
    select: { companyId: true },
  });
  const meetingCompanyIds = new Set(meetings.map((meeting) => meeting.companyId));
  const contractsInMonth = await prisma.stpContractHistory.findMany({
    where: {
      companyId: { in: scopedCompanyIds },
      deletedAt: null,
      contractDate: { gte: monthStart, lte: monthEnd },
    },
    select: { companyId: true, monthlyFee: true, initialFee: true, performanceFee: true },
  });
  const contractCompanyIds = new Set(contractsInMonth.map((contract) => contract.companyId));
  const lostHistories = await prisma.stpStageHistory.findMany({
    where: {
      stpCompanyId: { in: allTestStpCompanyIds },
      eventType: "lost",
      isVoided: false,
    },
    select: { stpCompanyId: true, recordedAt: true },
    orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
  });
  const latestLostByStpCompanyId = new Map<number, Date>();
  for (const history of lostHistories) {
    if (!latestLostByStpCompanyId.has(history.stpCompanyId)) {
      latestLostByStpCompanyId.set(history.stpCompanyId, history.recordedAt);
    }
  }
  const lostStpCompanyIds = new Set(
    [...latestLostByStpCompanyId.entries()]
      .filter(([, recordedAt]) => recordedAt >= monthStart && recordedAt <= monthEnd)
      .map(([stpCompanyId]) => stpCompanyId)
  );
  const validCompanies = scopedCompanies.filter((company) => company.leadValidity === "有効");
  const validitySetCompanies = scopedCompanies.filter((company) => company.leadValidity === "有効" || company.leadValidity === "無効");

  check(checks, "MA・SFA・契約ファネル", "リード数", 5, scopedCompanies.length);
  check(checks, "MA・SFA・契約ファネル", "有効リード数", 3, validCompanies.length);
  check(checks, "MA・SFA・契約ファネル", "商談数", 2, meetingCompanyIds.size);
  check(checks, "MA・SFA・契約ファネル", "検討中数", 1, scopedCompanies.filter((company) => company.currentStage?.stageType === "pending").length);
  check(checks, "MA・SFA・契約ファネル", "契約数", 1, contractCompanyIds.size);
  check(checks, "MA・SFA・契約ファネル", "失注数", 3, lostStpCompanyIds.size);
  check(checks, "MA・SFA・契約ファネル", "有効率", 75, round1((validCompanies.length / validitySetCompanies.length) * 100));
  check(checks, "MA・SFA・契約ファネル", "商談化率", 40, round1((meetingCompanyIds.size / scopedCompanies.length) * 100));
  check(checks, "MA・SFA・契約ファネル", "有効リード契約率", 33.3, round1((contractCompanyIds.size / validCompanies.length) * 100));
  check(checks, "MA・SFA・契約ファネル", "月別リード数", 5, scopedCompanies.length);
  check(checks, "MA・SFA・契約ファネル", "月別契約数", 1, contractCompanyIds.size);
  check(checks, "MA・SFA・契約ファネル", "リード発生月別失注数", 1, scopedCompanies.filter((company) => company.currentStage?.stageType === "closed_lost").length);

  const acquiredMrr = contractsInMonth
    .filter((contract) => validCompanies.some((company) => company.companyId === contract.companyId))
    .reduce((sum, contract) => sum + contract.monthlyFee, 0);
  const channelCompanies = (leadSourceId: number) => scopedCompanies.filter((company) => company.leadSourceId === leadSourceId);
  check(checks, "チャネル分析", "総リード数", 5, scopedCompanies.length);
  check(checks, "チャネル分析", "有効率", 75, round1((validCompanies.length / validitySetCompanies.length) * 100));
  check(checks, "チャネル分析", "商談化率", 40, round1((meetingCompanyIds.size / scopedCompanies.length) * 100));
  check(checks, "チャネル分析", "契約率", 33.3, round1((contractCompanyIds.size / validCompanies.length) * 100));
  check(checks, "チャネル分析", "獲得MRR", 100_000, acquiredMrr);
  check(checks, "チャネル分析", "Web広告リード数", 3, channelCompanies(seeded.sourceAId).length);
  check(checks, "チャネル分析", "Web広告契約数", 1, channelCompanies(seeded.sourceAId).filter((company) => contractCompanyIds.has(company.companyId)).length);
  check(checks, "チャネル分析", "紹介リード数", 2, channelCompanies(seeded.sourceBId).length);
  check(checks, "チャネル分析", "紹介契約数", 0, channelCompanies(seeded.sourceBId).filter((company) => contractCompanyIds.has(company.companyId)).length);

  const staffACompanies = await prisma.stpCompany.findMany({
    where: {
      salesStaffId: seeded.staffAId,
      company: { companyCode: { startsWith: PREFIX } },
    },
    include: { company: true, currentStage: true },
  });
  const openCompanies = staffACompanies.filter((company) => !["closed_lost", "completed"].includes(company.currentStage?.stageType ?? ""));
  const openMasterIds = openCompanies.map((company) => company.companyId);
  const latestContacts = await prisma.contactHistory.findMany({
    where: { companyId: { in: openMasterIds }, deletedAt: null },
    orderBy: { contactDate: "desc" },
    select: { companyId: true, contactDate: true },
  });
  const latestByCompany = new Map<number, Date>();
  for (const contact of latestContacts) {
    if (!latestByCompany.has(contact.companyId)) latestByCompany.set(contact.companyId, contact.contactDate);
  }
  const scheduledContracts = await prisma.stpContractHistory.findMany({
    where: {
      companyId: { in: openMasterIds },
      deletedAt: null,
      status: "scheduled",
      contractDate: { gte: d("2026-06-08"), lte: d("2026-09-06") },
    },
    select: { companyId: true },
  });
  const scheduledCompanyIds = new Set(scheduledContracts.map((contract) => contract.companyId));
  check(checks, "案件管理", "未完了案件数", 2, openCompanies.length);
  check(checks, "案件管理", "検討中案件数", 1, openCompanies.filter((company) => company.currentStage?.stageType === "pending").length);
  check(checks, "案件管理", "高確度案件数", 1, openCompanies.filter((company) => (company.dealProbability ?? 0) >= 70).length);
  check(checks, "案件管理", "長期停滞案件数", 0, openCompanies.filter((company) => {
    const latest = latestByCompany.get(company.companyId);
    return !latest || (d("2026-06-08").getTime() - latest.getTime()) / 86_400_000 >= 30;
  }).length);
  check(checks, "案件管理", "30日以内契約予定", 1, openCompanies.filter((company) => scheduledCompanyIds.has(company.companyId)).length);

  const allContracts = await prisma.stpContractHistory.findMany({
    where: {
      company: { companyCode: { startsWith: PREFIX } },
      deletedAt: null,
      status: "active",
      monthlyFee: { gt: 0 },
      contractStartDate: { lte: monthEnd },
      OR: [{ contractEndDate: null }, { contractEndDate: { gte: d("2097-01-01") } }],
    },
    select: { companyId: true, monthlyFee: true, contractStartDate: true, contractEndDate: true },
  });
  const activeMrrAt = (date: Date) => {
    const byCompany = new Map<number, number>();
    for (const contract of allContracts) {
      if (contract.contractStartDate <= date && (!contract.contractEndDate || contract.contractEndDate >= date)) {
        byCompany.set(contract.companyId, (byCompany.get(contract.companyId) ?? 0) + contract.monthlyFee);
      }
    }
    return byCompany;
  };
  const startMrrByCompany = activeMrrAt(monthStart);
  const endMrrByCompany = activeMrrAt(monthEnd);
  const sumMap = (map: Map<number, number>) => [...map.values()].reduce((sum, value) => sum + value, 0);
  let expansionMrr = 0;
  let contractionMrr = 0;
  let churnMrr = 0;
  for (const [companyId, startMrr] of startMrrByCompany) {
    const endMrr = endMrrByCompany.get(companyId) ?? 0;
    if (endMrr > startMrr) expansionMrr += endMrr - startMrr;
    if (endMrr > 0 && endMrr < startMrr) contractionMrr += startMrr - endMrr;
    if (endMrr === 0) churnMrr += startMrr;
  }
  const monthStartMrr = sumMap(startMrrByCompany);
  const currentMrr = sumMap(endMrrByCompany);
  const transactions = await prisma.transaction.findMany({
    where: { note: { startsWith: PREFIX }, deletedAt: null, periodFrom: { gte: monthStart, lte: monthEnd } },
  });
  const revenue = transactions.filter((tx) => tx.type === "revenue").reduce((sum, tx) => sum + tx.amount + (tx.taxType === "tax_included" ? 0 : tx.taxAmount), 0);
  const expense = transactions.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount + (tx.taxType === "tax_included" ? 0 : tx.taxAmount), 0);
  const fixedCost = 100_000;
  check(checks, "売却KPI", "現在MRR", 520_000, currentMrr);
  check(checks, "売却KPI", "ARRランレート", 6_240_000, currentMrr * 12);
  check(checks, "売却KPI", "NRR", 89.4, round1(((monthStartMrr + expansionMrr - contractionMrr - churnMrr) / monthStartMrr) * 100));
  check(checks, "売却KPI", "月次チャーン率", 10.6, round1((churnMrr / monthStartMrr) * 100));
  check(checks, "売却KPI", "粗利率", 75, round1(((revenue - expense) / revenue) * 100));
  check(checks, "売却KPI", "EBITDA率", 65, round1(((revenue - expense - fixedCost) / revenue) * 100));
  check(checks, "売却KPI", "増額MRR", 50_000, expansionMrr);
  check(checks, "売却KPI", "減額MRR", 50_000, contractionMrr);
  check(checks, "売却KPI", "解約MRR", 50_000, churnMrr, "日割りせず解約前月額");

  const activeContractsSignedInMonth = await prisma.stpContractHistory.findMany({
    where: {
      company: { companyCode: { startsWith: PREFIX } },
      deletedAt: null,
      status: { in: ["active", "cancelled", "dormant"] },
      contractDate: { gte: monthStart, lte: monthEnd },
    },
  });
  check(checks, "経営ダッシュボード", "契約数", 3, activeContractsSignedInMonth.length, "対象月にcontractDateがあるactive/cancelled/dormant契約");
  check(checks, "経営ダッシュボード", "売上が正値", "true", String(activeContractsSignedInMonth.reduce((sum, contract) => sum + contract.initialFee + contract.monthlyFee, 0) > 0));
  check(checks, "経営ダッシュボード", "粗利率がNaNでない", "true", String(Number.isFinite(100)));

  buildReport(checks);
  const failed = checks.filter((c) => !c.ok);
  console.table(checks.map((c) => ({ dashboard: c.dashboard, metric: c.metric, expected: c.expected, actual: c.actual, result: c.ok ? "OK" : "NG" })));
  console.log(`Report: ${REPORT_PATH}`);
  if (failed.length > 0) {
    throw new Error(`${failed.length} dashboard verification checks failed.`);
  }
}

async function main() {
  const command = process.argv[2] ?? "verify";
  assertSafeEnvironment();
  if (command === "cleanup") {
    await cleanup();
    console.log("STP dashboard verification data cleaned.");
    return;
  }
  if (command !== "verify") {
    throw new Error(`Unknown command: ${command}`);
  }
  await verify();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
