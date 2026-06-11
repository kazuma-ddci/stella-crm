import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { DEFAULT_FIXED_COST, KPI_KEYS } from "@/lib/kpi/constants";
import { calculateProratedFee, getDaysInMonth } from "@/lib/business-days";
import { buildCommissionConfig, calcByType, type ContractPlan } from "@/lib/finance/auto-generate";
import {
  ALL_STAFF,
  FALLBACK_PRODUCT,
  type ChannelAnalysisData,
  type ChannelAnalysisRow,
  type CurrentFunnelResult,
  type CohortMonthResult,
  type DashboardOption,
  type DealFocusCondition,
  type DealManagementData,
  type DealManagementRow,
  type DealPriority,
  type DwellTimeRow,
  type ExitKpiData,
  type ExitKpiDecisionRow,
  type ExitKpiEvaluationRow,
  type ExitKpiMetric,
  type ExitKpiMetricKey,
  type ExitKpiTargetValues,
  type FunnelRate,
  type FunnelTargetValues,
  type LostReasonResult,
  type ManagementDashboardData,
  type ManagementFunnelRow,
  type ManagementMetric,
  type ManagementMetricKey,
  type ManagementProgressRow,
  type ManagementRateRow,
  type NewDashboardData,
  type StaffProgressRow,
} from "./types";

const STP_PROJECT_ID = 1;
const MEETING_CATEGORY_NAME = "商談";
const SCHEDULED_CONTRACT_STATUS = "scheduled";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const CONFIRMED_INVOICE_STATUSES = ["sent", "awaiting_accounting", "partially_paid", "paid"];
const CONFIRMED_PAYMENT_STATUSES = ["confirmed", "paid"];

const EMPTY_TARGET_VALUES: FunnelTargetValues = {
  lead: null,
  validLead: null,
  meeting: null,
  pending: null,
  contract: null,
  lost: null,
};

const EMPTY_EXIT_KPI_TARGET_VALUES: ExitKpiTargetValues = {
  currentMrr: null,
  arrRunRate: null,
  nrr: null,
  monthlyChurnRate: null,
  grossMargin: null,
  ebitdaMargin: null,
};

type ProductScope = {
  key: string;
  name: string;
  id: number | null;
};

type StaffScope = {
  key: string;
  name: string;
  id: number | null;
};

type MonthRange = {
  startMonth: string;
  endMonth: string;
};

type DateRange = {
  start: Date;
  end: Date;
  label: string;
};

type StpCompanyRecord = {
  id: number;
  companyId: number;
  company: { name: string; companyCode: string | null };
  agent: { company: { name: string; companyCode: string | null } } | null;
  leadAcquiredDate: Date | null;
  leadValidity: string | null;
  leadSourceId: number | null;
  leadSource: { name: string } | null;
  industryType: string | null;
  industry: string | null;
  dealProbability: number | null;
  nextContactDate: Date | null;
  currentStage: { id: number; name: string; stageType: string } | null;
  lostReasonOption: { name: string } | null;
  lostReason: string | null;
  salesStaffId: number | null;
  salesStaff: { name: string } | null;
  asStaff: { name: string } | null;
};

type ContractValue = {
  contractDate: Date;
  initialFee: number;
  monthlyFee: number;
  performanceFee: number;
};

type StageInfo = {
  id: number;
  name: string;
  stageType: string;
};

type LostEvent = {
  recordedAt: Date;
  lostReason: string | null;
  lostReasonOptionName: string | null;
};

type EventMaps = {
  firstMeetingByCompanyId: Map<number, Date>;
  latestContactByCompanyId: Map<number, Date>;
  firstContractByCompanyId: Map<number, Date>;
  firstContractValueByCompanyId: Map<number, ContractValue>;
  latestLostByStpCompanyId: Map<number, LostEvent>;
  firstStageEntryByCompanyId: Map<number, Map<number, Date>>;
};

function toYearMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return `${year}年${month}月`;
}

function parseMonth(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function addMonths(yearMonth: string, diff: number) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return toYearMonth(date);
}

function compareMonth(a: string, b: string) {
  return a.localeCompare(b);
}

function isInRange(date: Date | null | undefined, range: DateRange) {
  return !!date && date >= range.start && date <= range.end;
}

function firstContractDate(company: StpCompanyRecord, eventMaps: EventMaps) {
  return eventMaps.firstContractByCompanyId.get(company.companyId);
}

function isFirstContractInRange(company: StpCompanyRecord, eventMaps: EventMaps, range: DateRange) {
  return isInRange(firstContractDate(company, eventMaps), range);
}

function firstContractValue(company: StpCompanyRecord, eventMaps: EventMaps) {
  return eventMaps.firstContractValueByCompanyId.get(company.companyId);
}

function toJstDateKey(date: Date) {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

function todayJstKey() {
  return toJstDateKey(new Date());
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return toJstDateKey(date);
}

function startOfWeekJstKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000+09:00`);
  const day = new Date(date.getTime() + JST_OFFSET_MS).getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysToDateKey(dateKey, diff);
}

function daysFromDateKey(dateKey: string | null, todayKey: string) {
  if (!dateKey) return null;
  const from = new Date(`${dateKey}T00:00:00.000+09:00`).getTime();
  const to = new Date(`${todayKey}T00:00:00.000+09:00`).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

function isoOrNull(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

function roundRate(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function averageCurrency(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function diffPt(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10) / 10;
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function topQuartileIds<T extends { id: number }>(items: T[], getValue: (item: T) => number | null) {
  const ranked = items
    .map((item) => ({ id: item.id, value: getValue(item) }))
    .filter((item): item is { id: number; value: number } => item.value != null)
    .sort((a, b) => b.value - a.value);
  if (ranked.length === 0) return new Set<number>();
  const count = Math.max(1, Math.ceil(ranked.length * 0.25));
  return new Set(ranked.slice(0, count).map((item) => item.id));
}

function normalizeProductScope(product: string, productOptions: DashboardOption[]): ProductScope {
  if (product !== FALLBACK_PRODUCT) {
    const productId = Number(product);
    if (Number.isInteger(productId)) {
      const option = productOptions.find((item) => item.value === product);
      return {
        key: `product:${productId}`,
        name: option?.label ?? `商材ID ${productId}`,
        id: productId,
      };
    }
  }
  const fallback = productOptions[0];
  return {
    key: fallback?.value !== FALLBACK_PRODUCT ? `product:${fallback?.value}` : FALLBACK_PRODUCT,
    name: fallback?.label ?? "採用ブースト",
    id: fallback?.value && fallback.value !== FALLBACK_PRODUCT ? Number(fallback.value) : null,
  };
}

function normalizeStaffScope(staff: string, staffOptions: DashboardOption[]): StaffScope {
  if (staff === ALL_STAFF) return { key: ALL_STAFF, name: "すべて", id: null };
  const staffId = Number(staff);
  const option = staffOptions.find((item) => item.value === staff);
  return {
    key: `staff:${staffId}`,
    name: option?.label ?? `スタッフID ${staffId}`,
    id: Number.isInteger(staffId) ? staffId : null,
  };
}

async function getBaseOptions() {
  const [products, staff, monthAgg] = await Promise.all([
    prisma.stpProduct.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    }),
    prisma.masterStaff.findMany({
      where: {
        isActive: true,
        isSystemUser: false,
        salesStpCompanies: { some: {} },
      },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    }),
    prisma.stpCompany.aggregate({
      where: { leadAcquiredDate: { not: null } },
      _min: { leadAcquiredDate: true },
      _max: { leadAcquiredDate: true },
    }),
  ]);

  const productOptions =
    products.length > 0
      ? products.map((product) => ({ value: String(product.id), label: product.name }))
      : [{ value: FALLBACK_PRODUCT, label: "採用ブースト" }];
  const staffOptions = staff.map((member) => ({ value: String(member.id), label: member.name }));

  const today = new Date();
  const fallbackMonth = toYearMonth(today);
  const monthRange: MonthRange = {
    startMonth: monthAgg._min.leadAcquiredDate ? toYearMonth(monthAgg._min.leadAcquiredDate) : fallbackMonth,
    endMonth: monthAgg._max.leadAcquiredDate ? toYearMonth(monthAgg._max.leadAcquiredDate) : fallbackMonth,
  };
  const periodOptions = buildPeriodOptions(monthRange);

  return { productOptions, staffOptions, monthRange, periodOptions };
}

function buildPeriodOptions(monthRange: MonthRange): DashboardOption[] {
  const options: DashboardOption[] = [
    {
      value: "all",
      label: `全期間(${monthRange.startMonth}〜${monthRange.endMonth})`,
    },
  ];

  let current = monthRange.endMonth;
  while (compareMonth(current, monthRange.startMonth) >= 0) {
    options.push({ value: current, label: monthLabel(current) });
    current = addMonths(current, -1);
  }
  return options;
}

function resolvePeriod(value: string | undefined, monthRange: MonthRange) {
  const selectedPeriod = value === "all" || /^\d{4}-\d{2}$/.test(value ?? "")
    ? value!
    : monthRange.endMonth;
  const targetMonth = selectedPeriod === "all" ? monthRange.endMonth : selectedPeriod;

  if (selectedPeriod === "all") {
    const start = parseMonth(monthRange.startMonth).start;
    const end = parseMonth(monthRange.endMonth).end;
    return {
      selectedPeriod,
      targetMonth,
      range: {
        start,
        end,
        label: `全期間(${monthRange.startMonth}〜${monthRange.endMonth})`,
      },
    };
  }

  const { start, end } = parseMonth(selectedPeriod);
  return {
    selectedPeriod,
    targetMonth,
    range: { start, end, label: monthLabel(selectedPeriod) },
  };
}

async function getEventMaps(companies: StpCompanyRecord[]): Promise<EventMaps> {
  const stpCompanyIds = companies.map((company) => company.id);
  const masterCompanyIds = companies.map((company) => company.companyId);
  const [meetingHistories, contactHistories, contractHistories, lostHistories, stageHistories] = await Promise.all([
    prisma.contactHistory.findMany({
      where: {
        companyId: { in: masterCompanyIds },
        deletedAt: null,
        contactCategory: { name: MEETING_CATEGORY_NAME, projectId: STP_PROJECT_ID },
        roles: {
          some: {
            customerType: {
              projectId: STP_PROJECT_ID,
              name: "企業",
            },
          },
        },
      },
      select: { companyId: true, contactDate: true },
      orderBy: { contactDate: "asc" },
    }),
    prisma.contactHistory.findMany({
      where: {
        companyId: { in: masterCompanyIds },
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
      select: { companyId: true, contactDate: true },
      orderBy: { contactDate: "desc" },
    }),
    prisma.stpContractHistory.findMany({
      where: {
        companyId: { in: masterCompanyIds },
        deletedAt: null,
        contractDate: { not: null },
      },
      select: {
        id: true,
        companyId: true,
        contractDate: true,
        initialFee: true,
        monthlyFee: true,
        performanceFee: true,
      },
      orderBy: [{ contractDate: "asc" }, { id: "asc" }],
    }),
    prisma.stpStageHistory.findMany({
      where: {
        stpCompanyId: { in: stpCompanyIds },
        isVoided: false,
        eventType: "lost",
      },
      select: {
        stpCompanyId: true,
        recordedAt: true,
        lostReason: true,
        lostReasonOption: { select: { name: true } },
      },
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
    }),
    prisma.stpStageHistory.findMany({
      where: {
        stpCompanyId: { in: stpCompanyIds },
        isVoided: false,
        toStageId: { not: null },
      },
      select: {
        stpCompanyId: true,
        toStageId: true,
        recordedAt: true,
      },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  const firstMeetingByCompanyId = new Map<number, Date>();
  for (const history of meetingHistories) {
    if (!firstMeetingByCompanyId.has(history.companyId)) {
      firstMeetingByCompanyId.set(history.companyId, history.contactDate);
    }
  }

  const latestContactByCompanyId = new Map<number, Date>();
  for (const history of contactHistories) {
    if (!latestContactByCompanyId.has(history.companyId)) {
      latestContactByCompanyId.set(history.companyId, history.contactDate);
    }
  }

  const firstContractByCompanyId = new Map<number, Date>();
  const firstContractValueByCompanyId = new Map<number, ContractValue>();
  for (const history of contractHistories) {
    if (history.contractDate && !firstContractByCompanyId.has(history.companyId)) {
      firstContractByCompanyId.set(history.companyId, history.contractDate);
      firstContractValueByCompanyId.set(history.companyId, {
        contractDate: history.contractDate,
        initialFee: history.initialFee,
        monthlyFee: history.monthlyFee,
        performanceFee: history.performanceFee,
      });
    }
  }

  const latestLostByStpCompanyId = new Map<number, LostEvent>();
  for (const history of lostHistories) {
    if (!latestLostByStpCompanyId.has(history.stpCompanyId)) {
      latestLostByStpCompanyId.set(history.stpCompanyId, {
        recordedAt: history.recordedAt,
        lostReason: history.lostReason,
        lostReasonOptionName: history.lostReasonOption?.name ?? null,
      });
    }
  }

  const firstStageEntryByCompanyId = new Map<number, Map<number, Date>>();
  for (const history of stageHistories) {
    if (!history.toStageId) continue;
    if (!firstStageEntryByCompanyId.has(history.stpCompanyId)) {
      firstStageEntryByCompanyId.set(history.stpCompanyId, new Map());
    }
    const entries = firstStageEntryByCompanyId.get(history.stpCompanyId)!;
    if (!entries.has(history.toStageId)) {
      entries.set(history.toStageId, history.recordedAt);
    }
  }

  return {
    firstMeetingByCompanyId,
    latestContactByCompanyId,
    firstContractByCompanyId,
    firstContractValueByCompanyId,
    latestLostByStpCompanyId,
    firstStageEntryByCompanyId,
  };
}

function buildCurrentResult({
  companies,
  stages,
  eventMaps,
  range,
}: {
  companies: StpCompanyRecord[];
  stages: StageInfo[];
  eventMaps: EventMaps;
  range: DateRange;
}): CurrentFunnelResult {
  const scopeCompanies = companies.filter((company) => isInRange(company.leadAcquiredDate, range));
  const validLeadCount = scopeCompanies.filter((company) => company.leadValidity === "有効").length;
  const leadValiditySetCount = scopeCompanies.filter(
    (company) => company.leadValidity === "有効" || company.leadValidity === "無効"
  ).length;
  const meetingCount = scopeCompanies.filter((company) =>
    isInRange(eventMaps.firstMeetingByCompanyId.get(company.companyId), range)
  ).length;
  const pendingCount = scopeCompanies.filter((company) => company.currentStage?.stageType === "pending").length;
  const contractCompanies = companies.filter((company) => isFirstContractInRange(company, eventMaps, range));
  const validContractCount = contractCompanies.filter((company) => company.leadValidity === "有効").length;
  const lostCompanies = companies.filter((company) =>
    isInRange(eventMaps.latestLostByStpCompanyId.get(company.id)?.recordedAt, range)
  );

  return {
    scopeLabel: range.label,
    metrics: [
      { key: "lead", label: "リード", value: scopeCompanies.length, unit: "件", subLabel: "リード獲得日基準", tone: "blue", target: null, gap: null },
      { key: "validLead", label: "有効リード", value: validLeadCount, unit: "件", subLabel: "有効性=有効", tone: "blue", target: null, gap: null },
      { key: "meeting", label: "商談実施", value: meetingCount, unit: "件", subLabel: "初回商談日基準", tone: "blue", target: null, gap: null },
      { key: "pending", label: "検討中", value: pendingCount, unit: "件", subLabel: "現在パイプライン", tone: "orange", target: null, gap: null },
      { key: "contract", label: "契約", value: contractCompanies.length, unit: "件", subLabel: "初回契約日基準", tone: "green", target: null, gap: null },
      { key: "lost", label: "失注", value: lostCompanies.length, unit: "件", subLabel: "失注変更日基準", tone: "red", target: null, gap: null },
    ],
    rates: [
      {
        key: "leadToValid",
        label: "リード→有効率",
        value: roundRate(validLeadCount, leadValiditySetCount),
        previousValue: null,
        previousDiffPt: null,
        numerator: validLeadCount,
        denominator: leadValiditySetCount,
      },
      {
        key: "leadToMeeting",
        label: "リード→商談化率",
        value: roundRate(meetingCount, scopeCompanies.length),
        previousValue: null,
        previousDiffPt: null,
        numerator: meetingCount,
        denominator: scopeCompanies.length,
      },
      {
        key: "validToContract",
        label: "有効リード→契約率",
        value: roundRate(validContractCount, validLeadCount),
        previousValue: null,
        previousDiffPt: null,
        numerator: validContractCount,
        denominator: validLeadCount,
      },
    ],
    dwellTimes: buildDwellTimes(scopeCompanies, stages, eventMaps),
    lostReasons: buildLostReasons(lostCompanies, eventMaps),
  };
}

function buildCohortMonthResult(
  yearMonth: string,
  companies: StpCompanyRecord[],
  eventMaps: EventMaps
): CohortMonthResult {
  const range = { ...parseMonth(yearMonth), label: monthLabel(yearMonth) };
  const scopeCompanies = companies.filter((company) => isInRange(company.leadAcquiredDate, range));
  const validLead = scopeCompanies.filter((company) => company.leadValidity === "有効").length;
  const validitySet = scopeCompanies.filter(
    (company) => company.leadValidity === "有効" || company.leadValidity === "無効"
  ).length;
  const meeting = scopeCompanies.filter((company) => eventMaps.firstMeetingByCompanyId.has(company.companyId)).length;
  const pending = scopeCompanies.filter((company) => company.currentStage?.stageType === "pending").length;
  const contractCompanies = companies.filter((company) => isFirstContractInRange(company, eventMaps, range));
  const validContract = contractCompanies.filter((company) => company.leadValidity === "有効").length;
  const lost = scopeCompanies.filter((company) => company.currentStage?.stageType === "closed_lost").length;

  return {
    month: yearMonth,
    lead: scopeCompanies.length,
    validLead,
    meeting,
    pending,
    contract: contractCompanies.length,
    lost,
    validRate: roundRate(validLead, validitySet),
    meetingRate: roundRate(meeting, scopeCompanies.length),
    contractRate: roundRate(validContract, validLead),
  };
}

function buildDwellTimes(
  companies: StpCompanyRecord[],
  stages: StageInfo[],
  eventMaps: EventMaps
): DwellTimeRow[] {
  const rows: DwellTimeRow[] = [];
  const stageFlow = stages.filter((stage) => stage.stageType !== "pending" && stage.stageType !== "closed_lost");
  const meetingValues = companies
    .map((company) => {
      const meetingAt = eventMaps.firstMeetingByCompanyId.get(company.companyId);
      if (!company.leadAcquiredDate || !meetingAt || meetingAt < company.leadAcquiredDate) return null;
      return daysBetween(company.leadAcquiredDate, meetingAt);
    })
    .filter((value): value is number => value !== null);

  rows.push({
    label: "リード→商談化",
    averageDays: average(meetingValues),
    sampleCount: meetingValues.length,
  });

  const meetingStageIndex = stageFlow.findIndex((stage) => stage.name.includes("商談"));
  const pipelineStartIndex = meetingStageIndex >= 0 ? meetingStageIndex : 1;

  for (let index = pipelineStartIndex; index < stageFlow.length - 1; index += 1) {
    const from = stageFlow[index];
    const to = stageFlow[index + 1];
    const values = companies
      .map((company) => {
        const entries = eventMaps.firstStageEntryByCompanyId.get(company.id);
        const fromAt = entries?.get(from.id);
        const toAt = entries?.get(to.id);
        if (!fromAt || !toAt || toAt < fromAt) return null;
        return daysBetween(fromAt, toAt);
      })
      .filter((value): value is number => value !== null);
    rows.push({
      label: `${from.name}→${to.name}`,
      averageDays: average(values),
      sampleCount: values.length,
    });
  }

  return rows;
}

function buildLostReasons(companies: StpCompanyRecord[], eventMaps: EventMaps): LostReasonResult[] {
  const counts = new Map<string, number>();
  for (const company of companies) {
    const lostEvent = eventMaps.latestLostByStpCompanyId.get(company.id);
    const label =
      lostEvent?.lostReasonOptionName ||
      lostEvent?.lostReason?.trim() ||
      company.lostReasonOption?.name ||
      company.lostReason?.trim() ||
      "未選択";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const total = companies.length;
  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function targetValuesFromRecord(
  target: {
    leadTarget: number | null;
    validLeadTarget: number | null;
    meetingTarget: number | null;
    pendingTarget: number | null;
    contractTarget: number | null;
    lostTarget: number | null;
  } | null
): FunnelTargetValues {
  if (!target) return { ...EMPTY_TARGET_VALUES };
  return {
    lead: target.leadTarget,
    validLead: target.validLeadTarget,
    meeting: target.meetingTarget,
    pending: target.pendingTarget,
    contract: target.contractTarget,
    lost: target.lostTarget,
  };
}

function applyTargets(result: CurrentFunnelResult, targets: FunnelTargetValues): CurrentFunnelResult {
  return {
    ...result,
    metrics: result.metrics.map((metric) => {
      const target = targets[metric.key];
      return {
        ...metric,
        target,
        gap: target == null ? null : metric.value - target,
      };
    }),
  };
}

function applyPreviousRates(result: CurrentFunnelResult, previousRates: FunnelRate[]): CurrentFunnelResult {
  const previousByKey = new Map(previousRates.map((rate) => [rate.key, rate.value]));
  return {
    ...result,
    rates: result.rates.map((rate) => {
      const previousValue = previousByKey.get(rate.key) ?? null;
      return {
        ...rate,
        previousValue,
        previousDiffPt: diffPt(rate.value, previousValue),
      };
    }),
  };
}

function buildChannelAnalysis(params: {
  companies: StpCompanyRecord[];
  leadSources: { id: number; name: string }[];
  staffOptions: DashboardOption[];
  eventMaps: EventMaps;
  range: DateRange;
}): ChannelAnalysisData {
  const scopeCompanies = params.companies.filter((company) => isInRange(company.leadAcquiredDate, params.range));
  const validLeadCount = scopeCompanies.filter((company) => company.leadValidity === "有効").length;
  const leadValiditySetCount = scopeCompanies.filter(
    (company) => company.leadValidity === "有効" || company.leadValidity === "無効"
  ).length;
  const meetingCount = scopeCompanies.filter((company) => params.eventMaps.firstMeetingByCompanyId.has(company.companyId)).length;
  const contractCompanies = params.companies.filter((company) => isFirstContractInRange(company, params.eventMaps, params.range));
  const validContractCompanies = contractCompanies.filter((company) => company.leadValidity === "有効");
  const acquiredMrr = contractCompanies.reduce(
    (sum, company) => sum + (firstContractValue(company, params.eventMaps)?.monthlyFee ?? 0),
    0
  );
  const averageContractValue = averageCurrency(
    contractCompanies.map((company) => {
      const contract = firstContractValue(company, params.eventMaps);
      if (!contract) return 0;
      return contract.initialFee + contract.monthlyFee + contract.performanceFee;
    })
  );

  const rawRows = params.leadSources.map((source) => {
    const sourceCompanies = scopeCompanies.filter((company) => company.leadSourceId === source.id);
    const sourceValidLeadCount = sourceCompanies.filter((company) => company.leadValidity === "有効").length;
    const sourceValiditySetCount = sourceCompanies.filter(
      (company) => company.leadValidity === "有効" || company.leadValidity === "無効"
    ).length;
    const sourceMeetingCount = sourceCompanies.filter((company) =>
      params.eventMaps.firstMeetingByCompanyId.has(company.companyId)
    ).length;
    const sourceContractCompanies = params.companies.filter(
      (company) =>
        company.leadSourceId === source.id &&
        isFirstContractInRange(company, params.eventMaps, params.range)
    );
    const sourceValidContractCount = sourceContractCompanies.filter((company) => company.leadValidity === "有効").length;
    const sourceMrr = sourceContractCompanies.reduce(
      (sum, company) => sum + (firstContractValue(company, params.eventMaps)?.monthlyFee ?? 0),
      0
    );

    return {
      id: source.id,
      leadSourceId: source.id,
      leadSourceName: source.name,
      leadCount: sourceCompanies.length,
      validRate: roundRate(sourceValidLeadCount, sourceValiditySetCount),
      meetingRate: roundRate(sourceMeetingCount, sourceCompanies.length),
      contractRate: roundRate(sourceValidContractCount, sourceValidLeadCount),
      contractCount: sourceContractCompanies.length,
      acquiredMrr: sourceMrr,
      mrrShare: null as number | null,
      cacLabel: "開発中",
      rating: "D" as ChannelAnalysisRow["rating"],
    };
  });

  const totalRowMrr = rawRows.reduce((sum, row) => sum + row.acquiredMrr, 0);
  const activeRows = rawRows.filter((row) => row.leadCount > 0);
  const topContractRateIds = topQuartileIds(activeRows, (row) => row.contractRate);
  const topMrrShareIds = topQuartileIds(activeRows, (row) => (totalRowMrr > 0 ? row.acquiredMrr / totalRowMrr : null));
  const rows: ChannelAnalysisRow[] = rawRows.map((row) => {
    const mrrShare = totalRowMrr > 0 ? Math.round((row.acquiredMrr / totalRowMrr) * 1000) / 10 : null;
    const conditionCount =
      (topContractRateIds.has(row.id) ? 1 : 0) +
      1 +
      (topMrrShareIds.has(row.id) ? 1 : 0);
    const rating: ChannelAnalysisRow["rating"] =
      row.contractCount === 0 ? "D" : conditionCount >= 3 ? "S" : conditionCount === 2 ? "A" : conditionCount === 1 ? "B" : "C";
    return {
      ...row,
      mrrShare,
      rating,
    };
  });

  const staffProgress: StaffProgressRow[] = params.staffOptions.map((staff) => {
    const staffId = Number(staff.value);
    const staffCompanies = scopeCompanies.filter((company) => company.salesStaffId === staffId);
    const staffMeetingCount = staffCompanies.filter((company) => params.eventMaps.firstMeetingByCompanyId.has(company.companyId)).length;
    const staffContractCompanies = params.companies.filter(
      (company) => company.salesStaffId === staffId && isFirstContractInRange(company, params.eventMaps, params.range)
    );
    const staffMrr = staffContractCompanies.reduce(
      (sum, company) => sum + (firstContractValue(company, params.eventMaps)?.monthlyFee ?? 0),
      0
    );
    return {
      staffId,
      staffName: staff.label,
      meetingCount: staffMeetingCount,
      contractCount: staffContractCompanies.length,
      contractRate: roundRate(staffContractCompanies.length, staffMeetingCount),
      newMrr: staffMrr,
      achievementLabel: "???",
    };
  });

  return {
    scopeLabel: params.range.label,
    summary: [
      { key: "totalLead", label: "総リード数", value: scopeCompanies.length, format: "count" },
      { key: "validRate", label: "有効率", value: roundRate(validLeadCount, leadValiditySetCount), format: "rate" },
      { key: "meetingRate", label: "商談化率", value: roundRate(meetingCount, scopeCompanies.length), format: "rate" },
      { key: "contractRate", label: "契約率", value: roundRate(validContractCompanies.length, validLeadCount), format: "rate" },
      { key: "acquiredMrr", label: "獲得MRR", value: acquiredMrr, format: "currency", note: "月額のみ" },
      {
        key: "averageContractValue",
        label: "平均契約単価",
        value: averageContractValue,
        format: "currency",
        note: "※成果報酬は実発生額ではなく契約単価",
      },
    ],
    rows,
    staffProgress,
    unassignedLeadCount: scopeCompanies.filter((company) => company.leadSourceId == null).length,
  };
}

async function buildDealManagement(params: {
  companies: StpCompanyRecord[];
  stages: StageInfo[];
  eventMaps: EventMaps;
  staffScope: StaffScope;
}): Promise<DealManagementData> {
  const todayKey = todayJstKey();
  const yesterdayKey = addDaysToDateKey(todayKey, -1);
  const weekStartKey = startOfWeekJstKey(todayKey);
  const weekEndKey = addDaysToDateKey(weekStartKey, 6);
  const sevenDaysLaterKey = addDaysToDateKey(todayKey, 7);
  const thirtyDaysLaterKey = addDaysToDateKey(todayKey, 30);
  const sixtyDaysLaterKey = addDaysToDateKey(todayKey, 60);
  const ninetyDaysLaterKey = addDaysToDateKey(todayKey, 90);
  const companyIds = params.companies.map((company) => company.companyId);

  const scheduledContracts = await prisma.stpContractHistory.findMany({
    where: {
      companyId: { in: companyIds },
      deletedAt: null,
      status: SCHEDULED_CONTRACT_STATUS,
      contractDate: { not: null },
    },
    select: { id: true, companyId: true, contractDate: true },
    orderBy: [{ contractDate: "asc" }, { id: "asc" }],
  });

  const firstScheduledContractByCompanyId = new Map<number, Date>();
  for (const contract of scheduledContracts) {
    if (contract.contractDate && !firstScheduledContractByCompanyId.has(contract.companyId)) {
      firstScheduledContractByCompanyId.set(contract.companyId, contract.contractDate);
    }
  }

  const isOpen = (company: StpCompanyRecord) =>
    company.currentStage?.stageType !== "closed_lost" && company.currentStage?.stageType !== "completed";
  const openCompanies = params.companies.filter(isOpen);
  const isHighProbability = (company: StpCompanyRecord) => (company.dealProbability ?? 0) >= 70;
  const isScheduledContractWithin = (company: StpCompanyRecord, endKey: string) => {
    const scheduledDate = firstScheduledContractByCompanyId.get(company.companyId);
    if (!scheduledDate) return false;
    const key = toJstDateKey(scheduledDate);
    return key >= todayKey && key <= endKey;
  };
  const hasNoActionForDays = (company: StpCompanyRecord, minDays: number) => {
    const latestContact = params.eventMaps.latestContactByCompanyId.get(company.companyId);
    if (!latestContact) return true;
    const days = daysFromDateKey(toJstDateKey(latestContact), todayKey);
    return days != null && days >= minDays;
  };

  const overdueContactCompanies = openCompanies.filter((company) => {
    if (!company.nextContactDate) return false;
    return toJstDateKey(company.nextContactDate) <= yesterdayKey;
  });
  const noAction30Companies = openCompanies.filter((company) => hasNoActionForDays(company, 30));
  const pendingHighProbabilityCompanies = openCompanies.filter(
    (company) => company.currentStage?.stageType === "pending" && isHighProbability(company)
  );
  const contractWithin30Companies = openCompanies.filter((company) => isScheduledContractWithin(company, thirtyDaysLaterKey));
  const contractWithin90Companies = openCompanies.filter(
    (company) => (company.dealProbability ?? 0) >= 50 && isScheduledContractWithin(company, ninetyDaysLaterKey)
  );

  const stageCounts = params.stages.map((stage) => ({
    stageId: stage.id,
    stageName: stage.name,
    stageType: stage.stageType,
    count: params.companies.filter((company) => company.currentStage?.id === stage.id).length,
  }));

  const focusConditions: DealFocusCondition[] = [
    {
      key: "overdueContact",
      label: "次に連絡する日が過去日",
      description: "次に連絡する日が昨日以前",
      count: overdueContactCompanies.length,
      rowIds: overdueContactCompanies.map((company) => company.id),
    },
    {
      key: "noAction30Days",
      label: "30日以上アクションなし",
      description: "オープン案件で最終接触日から30日以上、または接触履歴なし",
      count: noAction30Companies.length,
      rowIds: noAction30Companies.map((company) => company.id),
    },
    {
      key: "pendingHighProbability",
      label: "検討中かつ高確度",
      description: "パイプラインが検討中、かつ案件確度70%以上",
      count: pendingHighProbabilityCompanies.length,
      rowIds: pendingHighProbabilityCompanies.map((company) => company.id),
    },
    {
      key: "contractWithin30Days",
      label: "契約締結予定日が1ヶ月以内",
      description: "契約予定の契約日が30日以内",
      count: contractWithin30Companies.length,
      rowIds: contractWithin30Companies.map((company) => company.id),
    },
  ];

  const rows = openCompanies
    .map((company): DealManagementRow => {
      const nextContactKey = company.nextContactDate ? toJstDateKey(company.nextContactDate) : null;
      const latestContact = params.eventMaps.latestContactByCompanyId.get(company.companyId) ?? null;
      const latestContactKey = latestContact ? toJstDateKey(latestContact) : null;
      const latestContactDays = daysFromDateKey(latestContactKey, todayKey);
      const scheduledContractDate = firstScheduledContractByCompanyId.get(company.companyId) ?? null;
      const scheduledContractKey = scheduledContractDate ? toJstDateKey(scheduledContractDate) : null;
      const reasons: string[] = [];

      if (nextContactKey && nextContactKey <= yesterdayKey) reasons.push("次回連絡が過去日");
      if (!latestContact || (latestContactDays != null && latestContactDays >= 30)) reasons.push("30日以上アクションなし");
      if (company.currentStage?.stageType === "pending" && isHighProbability(company)) reasons.push("検討中かつ高確度");
      if (scheduledContractKey && scheduledContractKey >= todayKey && scheduledContractKey <= thirtyDaysLaterKey) {
        reasons.push("契約予定日30日以内");
      }

      let priority: DealPriority = "低";
      if (reasons.length > 0) {
        priority = "高";
      } else if (
        (nextContactKey && nextContactKey >= todayKey && nextContactKey <= sevenDaysLaterKey) ||
        (latestContactDays != null && latestContactDays >= 15 && latestContactDays < 30) ||
        (isHighProbability(company) && scheduledContractKey && scheduledContractKey >= todayKey && scheduledContractKey <= sixtyDaysLaterKey)
      ) {
        priority = "中";
      }

      const industryLabel = company.industry || (company.industryType === "general" ? "一般" : company.industryType === "dispatch" ? "派遣" : company.industryType);
      const displayCompanyName = company.company.companyCode
        ? `${company.company.companyCode} - ${company.company.name}`
        : company.company.name;
      const searchText = [
        company.company.name,
        company.company.companyCode,
        company.agent?.company.name,
        company.leadSource?.name,
        industryLabel,
        company.currentStage?.name,
        company.salesStaff?.name,
        company.asStaff?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return {
        id: company.id,
        priority,
        priorityReasons: reasons,
        leadAcquiredDate: isoOrNull(company.leadAcquiredDate),
        leadValidity: company.leadValidity,
        firstMeetingDate: isoOrNull(params.eventMaps.firstMeetingByCompanyId.get(company.companyId)),
        asStaffName: company.asStaff?.name ?? null,
        salesStaffName: company.salesStaff?.name ?? null,
        companyName: displayCompanyName,
        companyCode: company.company.companyCode,
        agentName: company.agent?.company.companyCode
          ? `${company.agent.company.companyCode} - ${company.agent.company.name}`
          : company.agent?.company.name ?? null,
        leadSourceName: company.leadSource?.name ?? null,
        industryLabel,
        stageName: company.currentStage?.name ?? null,
        stageType: company.currentStage?.stageType ?? null,
        dealProbability: company.dealProbability,
        nextContactDate: isoOrNull(company.nextContactDate),
        latestContactDate: isoOrNull(latestContact),
        scheduledContractDate: isoOrNull(scheduledContractDate),
        searchText,
      };
    })
    .sort((a, b) => {
      const priorityOrder: Record<DealPriority, number> = { 高: 0, 中: 1, 低: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const aNext = a.nextContactDate ? toJstDateKey(new Date(a.nextContactDate)) : "9999-12-31";
      const bNext = b.nextContactDate ? toJstDateKey(new Date(b.nextContactDate)) : "9999-12-31";
      if (aNext !== bNext) return aNext.localeCompare(bNext);
      return a.id - b.id;
    });

  return {
    staffLabel: params.staffScope.name,
    summary: [
      { key: "openDeals", label: "オープン案件数", value: openCompanies.length, tone: "blue" },
      { key: "pendingDeals", label: "検討中件数", value: openCompanies.filter((company) => company.currentStage?.stageType === "pending").length, tone: "orange" },
      { key: "highProbability", label: "高確度案件", value: openCompanies.filter(isHighProbability).length, tone: "purple" },
      {
        key: "weeklyActions",
        label: "今週アクション件数",
        value: openCompanies.filter((company) => {
          if (!company.nextContactDate) return false;
          const key = toJstDateKey(company.nextContactDate);
          return key >= weekStartKey && key <= weekEndKey;
        }).length,
        tone: "green",
      },
      { key: "longStagnant", label: "長期滞留案件", value: noAction30Companies.length, tone: "red" },
      { key: "forecastContracts", label: "見込み契約件数", value: contractWithin90Companies.length, tone: "blue" },
    ],
    stageCounts,
    focusConditions,
    rows,
  };
}

function calcTotalWithTax(tx: { amount: number; taxAmount: number; taxType: string }) {
  return tx.taxType === "tax_included" ? tx.amount : tx.amount + tx.taxAmount;
}

function ratePercent(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function formatExitCurrency(value: number | null) {
  if (value == null) return "データ不足";
  return `¥${new Intl.NumberFormat("ja-JP").format(value)}`;
}

function formatExitRate(value: number | null) {
  if (value == null) return "データ不足";
  return `${value.toFixed(1)}%`;
}

function exitTargetValuesFromRecord(
  target: {
    currentMrrTarget: number | null;
    arrRunRateTarget: number | null;
    nrrTarget: Prisma.Decimal | number | null;
    churnRateTarget: Prisma.Decimal | number | null;
    grossMarginTarget: Prisma.Decimal | number | null;
    ebitdaMarginTarget: Prisma.Decimal | number | null;
  } | null
): ExitKpiTargetValues {
  if (!target) return { ...EMPTY_EXIT_KPI_TARGET_VALUES };
  return {
    currentMrr: target.currentMrrTarget,
    arrRunRate: target.arrRunRateTarget,
    nrr: target.nrrTarget == null ? null : Number(target.nrrTarget),
    monthlyChurnRate: target.churnRateTarget == null ? null : Number(target.churnRateTarget),
    grossMargin: target.grossMarginTarget == null ? null : Number(target.grossMarginTarget),
    ebitdaMargin: target.ebitdaMarginTarget == null ? null : Number(target.ebitdaMarginTarget),
  };
}

function buildExitMetric(params: {
  key: ExitKpiMetricKey;
  label: string;
  actual: number | null;
  target: number | null;
  format: "currency" | "rate";
  inverted?: boolean;
}): ExitKpiMetric {
  const inverted = params.inverted ?? false;
  const actual = params.actual;
  const target = params.target;
  let achievementRate: number | null = null;
  if (actual != null && target != null) {
    if (inverted) {
      if (actual === 0) {
        achievementRate = target >= 0 ? 100 : null;
      } else {
        achievementRate = Math.round((target / actual) * 1000) / 10;
      }
    } else {
      achievementRate = target > 0 ? Math.round((actual / target) * 1000) / 10 : actual === 0 ? 100 : null;
    }
  }

  const diff = actual != null && target != null ? Math.round((actual - target) * 10) / 10 : null;
  const status: ExitKpiMetric["status"] =
    actual == null || target == null
      ? "neutral"
      : inverted
        ? actual <= target
          ? "good"
          : actual <= target * 1.25
            ? "warning"
            : "danger"
        : achievementRate == null
          ? "neutral"
          : achievementRate >= 100
            ? "good"
            : achievementRate >= 80
              ? "warning"
              : "danger";

  const comment =
    status === "neutral"
      ? "目標未設定またはデータ不足"
      : status === "good"
        ? inverted
          ? "目標以下で良好に推移"
          : "目標を上回り順調"
        : status === "warning"
          ? "目標近辺で推移、継続確認"
          : "改善が必要";

  return {
    key: params.key,
    label: params.label,
    actual,
    target,
    achievementRate,
    diff,
    format: params.format,
    inverted,
    comment,
    status,
  };
}

function sumActiveMrrAt(
  contracts: { companyId: number; contractStartDate: Date; contractEndDate: Date | null; monthlyFee: number }[],
  date: Date
) {
  const byCompany = new Map<number, number>();
  for (const contract of contracts) {
    if (contract.contractStartDate > date) continue;
    if (contract.contractEndDate && contract.contractEndDate < date) continue;
    byCompany.set(contract.companyId, (byCompany.get(contract.companyId) ?? 0) + contract.monthlyFee);
  }
  return byCompany;
}

async function buildExitKpiData(targetMonth: string): Promise<ExitKpiData> {
  const { start: monthStart, end: monthEnd } = parseMonth(targetMonth);
  const previousMonth = addMonths(targetMonth, -1);
  const { end: previousMonthEnd } = parseMonth(previousMonth);
  const twelveMonthsAgo = addMonths(targetMonth, -12);
  const { start: twelveMonthsAgoStart } = parseMonth(twelveMonthsAgo);
  const past = targetMonth < toYearMonth(new Date());

  const [contracts, transactions, target, fixedCostTarget] = await Promise.all([
    prisma.stpContractHistory.findMany({
      where: {
        deletedAt: null,
        status: "active",
        monthlyFee: { gt: 0 },
        contractStartDate: { lte: monthEnd },
        OR: [{ contractEndDate: null }, { contractEndDate: { gte: twelveMonthsAgoStart } }],
      },
      select: {
        companyId: true,
        contractStartDate: true,
        contractEndDate: true,
        monthlyFee: true,
      },
    }),
    prisma.transaction.findMany({
      where: {
        deletedAt: null,
        periodFrom: { gte: monthStart, lte: monthEnd },
        type: { in: ["revenue", "expense"] },
      },
      select: {
        type: true,
        amount: true,
        taxAmount: true,
        taxType: true,
        invoiceGroupId: true,
        paymentGroupId: true,
        invoiceGroup: { select: { status: true } },
        paymentGroup: { select: { status: true } },
      },
    }),
    prisma.stpExitKpiTarget.findUnique({ where: { targetMonth } }),
    prisma.kpiMonthlyTarget.findUnique({
      where: { yearMonth_kpiKey: { yearMonth: targetMonth, kpiKey: KPI_KEYS.FIXED_COST } },
    }),
  ]);

  const monthStartMrrByCompany = sumActiveMrrAt(contracts, monthStart);
  const monthEndMrrByCompany = sumActiveMrrAt(contracts, monthEnd);
  const previousMonthEndMrrByCompany = sumActiveMrrAt(contracts, previousMonthEnd);
  const twelveMonthsAgoMrrByCompany = sumActiveMrrAt(contracts, twelveMonthsAgoStart);

  const monthStartMrr = [...monthStartMrrByCompany.values()].reduce((sum, value) => sum + value, 0);
  const currentMrr = [...monthEndMrrByCompany.values()].reduce((sum, value) => sum + value, 0);
  const previousMonthEndMrr = [...previousMonthEndMrrByCompany.values()].reduce((sum, value) => sum + value, 0);

  let monthEndExistingMrr = 0;
  let expansionMrr = 0;
  let contractionMrr = 0;
  let churnMrr = 0;
  for (const [companyId, startMrr] of monthStartMrrByCompany.entries()) {
    const endMrr = monthEndMrrByCompany.get(companyId) ?? 0;
    monthEndExistingMrr += endMrr;
    if (endMrr === 0) {
      churnMrr += startMrr;
    } else if (endMrr > startMrr) {
      expansionMrr += endMrr - startMrr;
    } else if (endMrr < startMrr) {
      contractionMrr += startMrr - endMrr;
    }
  }
  const newMrr = [...monthEndMrrByCompany.entries()].reduce(
    (sum, [companyId, endMrr]) => sum + (monthStartMrrByCompany.has(companyId) ? 0 : endMrr),
    0
  );

  const retainedTwelveMonthMrr = [...twelveMonthsAgoMrrByCompany.entries()].reduce(
    (sum, [companyId, oldMrr]) => sum + Math.min(oldMrr, monthEndMrrByCompany.get(companyId) ?? 0),
    0
  );
  const twelveMonthStartMrr = [...twelveMonthsAgoMrrByCompany.values()].reduce((sum, value) => sum + value, 0);

  let revenue = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === "revenue") {
      if (past && tx.invoiceGroupId !== null) {
        if (!tx.invoiceGroup || !CONFIRMED_INVOICE_STATUSES.includes(tx.invoiceGroup.status)) continue;
      }
      revenue += calcTotalWithTax(tx);
    } else if (tx.type === "expense") {
      if (past && tx.paymentGroupId !== null) {
        if (!tx.paymentGroup || !CONFIRMED_PAYMENT_STATUSES.includes(tx.paymentGroup.status)) continue;
      }
      expense += calcTotalWithTax(tx);
    }
  }

  const fixedCost = fixedCostTarget?.targetValue ?? DEFAULT_FIXED_COST;
  const grossProfit = revenue - expense;
  const ebitdaLikeProfit = grossProfit - fixedCost;
  const nrr = ratePercent(monthStartMrr + expansionMrr - contractionMrr - churnMrr, monthStartMrr);
  const monthlyChurnRate = ratePercent(churnMrr, monthStartMrr);
  const grossMargin = ratePercent(grossProfit, revenue);
  const ebitdaMargin = ratePercent(ebitdaLikeProfit, revenue);
  const mrrGrowthRate = ratePercent(currentMrr - previousMonthEndMrr, previousMonthEndMrr);
  const netNewMrrRate = ratePercent(newMrr + expansionMrr - contractionMrr - churnMrr, monthStartMrr);
  const ruleOf40 = mrrGrowthRate != null && ebitdaMargin != null ? Math.round((mrrGrowthRate + ebitdaMargin) * 10) / 10 : null;
  const twelveMonthRetentionRate = ratePercent(retainedTwelveMonthMrr, twelveMonthStartMrr);
  const targetValues = exitTargetValuesFromRecord(target);

  const metrics = [
    buildExitMetric({ key: "currentMrr", label: "現在MRR", actual: currentMrr, target: targetValues.currentMrr, format: "currency" }),
    buildExitMetric({ key: "arrRunRate", label: "ARRランレート", actual: currentMrr * 12, target: targetValues.arrRunRate, format: "currency" }),
    buildExitMetric({ key: "nrr", label: "NRR", actual: nrr, target: targetValues.nrr, format: "rate" }),
    buildExitMetric({ key: "monthlyChurnRate", label: "月次チャーン率", actual: monthlyChurnRate, target: targetValues.monthlyChurnRate, format: "rate", inverted: true }),
    buildExitMetric({ key: "grossMargin", label: "粗利率", actual: grossMargin, target: targetValues.grossMargin, format: "rate" }),
    buildExitMetric({ key: "ebitdaMargin", label: "EBITDA率", actual: ebitdaMargin, target: targetValues.ebitdaMargin, format: "rate" }),
  ];

  const metricByKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const statusOf = (keys: ExitKpiMetricKey[]): ExitKpiMetric["status"] => {
    const statuses = keys.map((key) => metricByKey.get(key)?.status ?? "neutral");
    if (statuses.includes("danger")) return "danger";
    if (statuses.includes("warning")) return "warning";
    if (statuses.includes("good")) return "good";
    return "neutral";
  };

  const decisionSummary: ExitKpiDecisionRow[] = [
    {
      category: "growth",
      categoryLabel: "成長性",
      mainMetrics: "MRR成長率・ARRランレート",
      goodCriteria: "MRR成長率 20%以上",
      currentValue: `MRR成長率 ${formatExitRate(mrrGrowthRate)} / ARR ${formatExitCurrency(currentMrr * 12)}`,
      evaluation: statusOf(["currentMrr", "arrRunRate"]),
    },
    {
      category: "profitability",
      categoryLabel: "収益性",
      mainMetrics: "粗利率・EBITDA率",
      goodCriteria: "粗利率 75%以上 / EBITDA率 25%以上",
      currentValue: `粗利率 ${formatExitRate(grossMargin)} / EBITDA率 ${formatExitRate(ebitdaMargin)}`,
      evaluation: statusOf(["grossMargin", "ebitdaMargin"]),
    },
    {
      category: "retention",
      categoryLabel: "継続性",
      mainMetrics: "NRR・月次チャーン率",
      goodCriteria: "NRR 110%以上 / チャーン率 1%未満",
      currentValue: `NRR ${formatExitRate(nrr)} / チャーン率 ${formatExitRate(monthlyChurnRate)}`,
      evaluation: statusOf(["nrr", "monthlyChurnRate"]),
    },
    {
      category: "efficiency",
      categoryLabel: "効率性",
      mainMetrics: "CAC回収月数・LTV/CAC・Rule of 40",
      goodCriteria: "Rule of 40: 40%以上",
      currentValue: `Rule of 40 ${formatExitRate(ruleOf40)}`,
      evaluation: ruleOf40 == null ? "neutral" : ruleOf40 >= 40 ? "good" : ruleOf40 >= 30 ? "warning" : "danger",
    },
  ];

  const evaluationRows: ExitKpiEvaluationRow[] = [
    { category: "成長性", metric: "MRR成長率 (MoM)", actualLabel: formatExitRate(mrrGrowthRate), benchmark: "20%以上", evaluation: mrrGrowthRate == null ? "neutral" : mrrGrowthRate >= 20 ? "good" : mrrGrowthRate >= 10 ? "warning" : "danger" },
    { category: "成長性", metric: "Net New MRR比率", actualLabel: formatExitRate(netNewMrrRate), benchmark: "100%以上", evaluation: netNewMrrRate == null ? "neutral" : netNewMrrRate >= 100 ? "good" : netNewMrrRate >= 0 ? "warning" : "danger" },
    { category: "収益性", metric: "粗利率", actualLabel: formatExitRate(grossMargin), benchmark: "75%以上", evaluation: grossMargin == null ? "neutral" : grossMargin >= 75 ? "good" : grossMargin >= 60 ? "warning" : "danger" },
    { category: "収益性", metric: "EBITDA率", actualLabel: formatExitRate(ebitdaMargin), benchmark: "25%以上", evaluation: ebitdaMargin == null ? "neutral" : ebitdaMargin >= 25 ? "good" : ebitdaMargin >= 15 ? "warning" : "danger" },
    { category: "継続性", metric: "NRR", actualLabel: formatExitRate(nrr), benchmark: "110%以上", evaluation: nrr == null ? "neutral" : nrr >= 110 ? "good" : nrr >= 100 ? "warning" : "danger" },
    { category: "継続性", metric: "12ヶ月継続率", actualLabel: formatExitRate(twelveMonthRetentionRate), benchmark: "90%以上", evaluation: twelveMonthRetentionRate == null ? "neutral" : twelveMonthRetentionRate >= 90 ? "good" : twelveMonthRetentionRate >= 80 ? "warning" : "danger" },
    { category: "効率性", metric: "CAC回収月数", actualLabel: "データ不足", benchmark: "12ヶ月以内", evaluation: "neutral" },
    { category: "効率性", metric: "LTV/CAC", actualLabel: "データ不足", benchmark: "3.0倍以上", evaluation: "neutral" },
    { category: "効率性", metric: "Rule of 40", actualLabel: formatExitRate(ruleOf40), benchmark: "40%以上", evaluation: ruleOf40 == null ? "neutral" : ruleOf40 >= 40 ? "good" : ruleOf40 >= 30 ? "warning" : "danger" },
  ];

  const alerts: ExitKpiData["alerts"] = [];
  for (const metric of metrics) {
    if (metric.status === "danger") {
      alerts.push({
        key: `danger-${metric.key}`,
        tone: "danger",
        title: `${metric.label}が目標を下回っています`,
        description: `${metric.label}の実績は${metric.format === "currency" ? formatExitCurrency(metric.actual) : formatExitRate(metric.actual)}です。改善アクションを確認してください。`,
      });
    } else if (metric.status === "warning") {
      alerts.push({
        key: `warning-${metric.key}`,
        tone: "warning",
        title: `${metric.label}が目標近辺です`,
        description: "月末までの変動と次月への影響を継続確認してください。",
      });
    }
  }
  if (alerts.length === 0) {
    alerts.push({
      key: "healthy",
      tone: "success",
      title: "主要KPIは良好に推移しています",
      description: "現時点で重大な経営アラートはありません。",
    });
  }
  if (evaluationRows.some((row) => row.actualLabel === "データ不足")) {
    alerts.push({
      key: "data-shortage",
      tone: "info",
      title: "一部の売却評価指標はデータ不足です",
      description: "CAC回収月数とLTV/CACはコストデータの紐付け後に自動算出できます。",
    });
  }

  return {
    targetMonth,
    targetValues,
    metrics,
    decisionSummary,
    evaluationRows,
    alerts,
    details: {
      monthStartMrr,
      monthEndExistingMrr,
      expansionMrr,
      contractionMrr,
      churnMrr,
      newMrr,
      previousMonthEndMrr,
      revenue,
      expense,
      fixedCost,
      grossProfit,
      ebitdaLikeProfit,
      mrrGrowthRate,
      netNewMrrRate,
      ruleOf40,
      twelveMonthRetentionRate,
    },
  };
}

const MANAGEMENT_REVENUE_STATUSES = ["active", "cancelled", "dormant"];

type ManagementMonthContext = DateRange & {
  month: string;
  year: number;
  monthNumber: number;
  daysInMonth: number;
};

type ManagementContract = {
  id: number;
  companyId: number;
  industryType: string;
  contractPlan: string;
  jobMedia: string | null;
  contractStartDate: Date;
  contractEndDate: Date | null;
  initialFee: number;
  monthlyFee: number;
  performanceFee: number;
  status: string;
  contractDate: Date | null;
};

type ManagementCandidate = {
  id: number;
  joinDate: Date | null;
  industryType: string | null;
  jobMedia: string | null;
  stpCompany: { id: number; companyId: number; leadSourceId: number | null; salesStaffId: number | null; agentId: number | null } | null;
};

type ManagementStpCompany = {
  id: number;
  companyId: number;
  leadSourceId: number | null;
  leadSource: { name: string } | null;
  salesStaffId: number | null;
  salesStaff: { name: string } | null;
  agentId: number | null;
};

type ManagementAgentContract = {
  id: number;
  agentId: number;
  contractStartDate: Date;
  contractEndDate: Date | null;
  contractDate: Date | null;
  initialFee: number | null;
  monthlyFee: number | null;
  defaultMpInitialType: string | null;
  defaultMpInitialRate: unknown;
  defaultMpInitialFixed: unknown;
  defaultMpInitialDuration: unknown;
  defaultMpMonthlyType: string | null;
  defaultMpMonthlyRate: unknown;
  defaultMpMonthlyFixed: unknown;
  defaultMpMonthlyDuration: unknown;
  defaultPpInitialType: string | null;
  defaultPpInitialRate: unknown;
  defaultPpInitialFixed: unknown;
  defaultPpInitialDuration: unknown;
  defaultPpPerfType: string | null;
  defaultPpPerfRate: unknown;
  defaultPpPerfFixed: unknown;
  defaultPpPerfDuration: unknown;
};

type ManagementCommissionOverride = {
  agentContractHistoryId: number;
  stpCompanyId: number;
  mpInitialType: string | null;
  mpInitialRate: unknown;
  mpInitialFixed: unknown;
  mpInitialDuration: unknown;
  mpMonthlyType: string | null;
  mpMonthlyRate: unknown;
  mpMonthlyFixed: unknown;
  mpMonthlyDuration: unknown;
  ppInitialType: string | null;
  ppInitialRate: unknown;
  ppInitialFixed: unknown;
  ppInitialDuration: unknown;
  ppPerfType: string | null;
  ppPerfRate: unknown;
  ppPerfFixed: unknown;
  ppPerfDuration: unknown;
};

function enumerateMonthContexts(selectedPeriod: string, monthRange: MonthRange): ManagementMonthContext[] {
  const months: string[] = [];
  if (selectedPeriod === "all") {
    let current = monthRange.startMonth;
    while (compareMonth(current, monthRange.endMonth) <= 0) {
      months.push(current);
      current = addMonths(current, 1);
    }
  } else {
    months.push(selectedPeriod);
  }

  return months.map((month) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const range = parseMonth(month);
    return {
      month,
      year,
      monthNumber,
      daysInMonth: getDaysInMonth(year, monthNumber),
      label: monthLabel(month),
      ...range,
    };
  });
}

function isDateInMonth(date: Date | null | undefined, month: ManagementMonthContext) {
  return !!date && date >= month.start && date <= month.end;
}

function overlapsMonth(start: Date, end: Date | null, month: ManagementMonthContext) {
  if (start > month.end) return false;
  if (end && end < month.start) return false;
  return true;
}

function proratedAmount(amount: number, start: Date, end: Date | null, month: ManagementMonthContext) {
  const isStartMonth = toYearMonth(start) === month.month;
  const isEndMonth = end ? toYearMonth(end) === month.month : false;
  const startDay = isStartMonth ? start.getDate() : 1;
  const endDay = isEndMonth && end ? end.getDate() : month.daysInMonth;
  if (startDay <= 1 && endDay >= month.daysInMonth) return amount;
  return calculateProratedFee(amount, startDay, month.daysInMonth, endDay);
}

function monthsDiff(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function addAmount(map: Map<number, number>, key: number | null | undefined, amount: number) {
  if (key == null || amount === 0) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function addNullableAmount(map: Map<string, number>, key: string, amount: number) {
  if (amount === 0) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function findAgentContract(
  agentContracts: ManagementAgentContract[],
  agentId: number,
  effectiveDate: Date
) {
  return agentContracts.find(
    (history) =>
      history.agentId === agentId &&
      history.contractStartDate <= effectiveDate &&
      (history.contractEndDate == null || history.contractEndDate >= effectiveDate)
  );
}

function findPerformanceContract(candidate: ManagementCandidate, contracts: ManagementContract[]) {
  const joinDate = candidate.joinDate;
  const stpCompany = candidate.stpCompany;
  if (!joinDate || !stpCompany) return null;
  const matches = contracts
    .filter(
      (contract) =>
        contract.companyId === stpCompany.companyId &&
        contract.status === "active" &&
        contract.performanceFee > 0 &&
        contract.contractStartDate <= joinDate &&
        (contract.contractEndDate == null || contract.contractEndDate >= joinDate) &&
        (!candidate.industryType || contract.industryType === candidate.industryType) &&
        (!candidate.jobMedia || contract.jobMedia === candidate.jobMedia)
    )
    .sort((a, b) => b.contractStartDate.getTime() - a.contractStartDate.getTime() || b.id - a.id);
  return matches.length === 1 ? matches[0] : null;
}

function targetMetric(params: {
  key: ManagementMetricKey;
  label: string;
  actual: number | null;
  target: number | null;
  format: ManagementMetric["format"];
}): ManagementMetric {
  const achievementRate =
    params.actual != null && params.target != null && params.target > 0
      ? Math.round((params.actual / params.target) * 1000) / 10
      : null;
  const diff =
    params.actual != null && params.target != null
      ? Math.round((params.actual - params.target) * 10) / 10
      : null;
  const status: ManagementMetric["status"] =
    params.format === "placeholder"
      ? "pending"
      : achievementRate == null
        ? "neutral"
        : achievementRate >= 100
          ? "good"
          : achievementRate >= 80
            ? "warning"
            : "danger";
  return { ...params, achievementRate, diff, status };
}

function formatManagementValue(value: number | null, format: ManagementMetric["format"]) {
  if (format === "placeholder") return "準備中";
  if (value == null) return "-";
  if (format === "currency") return `¥${new Intl.NumberFormat("ja-JP").format(value)}`;
  if (format === "rate") return `${value.toFixed(1)}%`;
  return `${new Intl.NumberFormat("ja-JP").format(value)}件`;
}

function progressRowFromMetric(metric: ManagementMetric): ManagementProgressRow {
  return {
    key: metric.key,
    label: metric.label,
    actualLabel: formatManagementValue(metric.actual, metric.format),
    targetLabel: metric.target == null ? (metric.format === "placeholder" ? "準備中" : "未設定") : formatManagementValue(metric.target, metric.format),
    achievementRateLabel: metric.achievementRate == null ? (metric.format === "placeholder" ? "準備中" : "-") : `${metric.achievementRate.toFixed(1)}%`,
    forecastLabel: "準備中",
    status: metric.status,
  };
}

async function buildManagementDashboardData(params: {
  companies: StpCompanyRecord[];
  stages: StageInfo[];
  leadSources: { id: number; name: string }[];
  staffOptions: DashboardOption[];
  eventMaps: EventMaps;
  range: DateRange;
  selectedPeriod: string;
  monthRange: MonthRange;
  productScope: ProductScope;
}): Promise<ManagementDashboardData> {
  const monthContexts = enumerateMonthContexts(params.selectedPeriod, params.monthRange);
  const months = monthContexts.map((month) => month.month);
  const rangeStart = monthContexts[0]?.start ?? params.range.start;
  const rangeEnd = monthContexts[monthContexts.length - 1]?.end ?? params.range.end;

  const [contracts, candidates, kpiTargets] = await Promise.all([
    prisma.stpContractHistory.findMany({
      where: {
        deletedAt: null,
        OR: [
          { contractDate: { gte: rangeStart, lte: rangeEnd } },
          {
            contractStartDate: { lte: rangeEnd },
            OR: [{ contractEndDate: null }, { contractEndDate: { gte: rangeStart } }],
          },
        ],
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
        status: true,
        contractDate: true,
      },
      orderBy: [{ contractStartDate: "asc" }, { id: "asc" }],
    }),
    prisma.stpCandidate.findMany({
      where: { deletedAt: null, joinDate: { gte: rangeStart, lte: rangeEnd } },
      select: {
        id: true,
        joinDate: true,
        industryType: true,
        jobMedia: true,
        stpCompany: {
          select: {
            id: true,
            companyId: true,
            leadSourceId: true,
            salesStaffId: true,
            agentId: true,
          },
        },
      },
    }),
    prisma.kpiMonthlyTarget.findMany({
      where: {
        yearMonth: { in: months },
        kpiKey: { in: [KPI_KEYS.MONTHLY_REVENUE, KPI_KEYS.MONTHLY_GROSS_PROFIT, KPI_KEYS.NEW_CONTRACTS] },
      },
      select: { yearMonth: true, kpiKey: true, targetValue: true },
    }),
  ]);

  const companyIds = [...new Set(contracts.map((contract) => contract.companyId))];
  const stpCompanies = companyIds.length > 0
    ? await prisma.stpCompany.findMany({
        where: { companyId: { in: companyIds } },
        select: {
          id: true,
          companyId: true,
          leadSourceId: true,
          leadSource: { select: { name: true } },
          salesStaffId: true,
          salesStaff: { select: { name: true } },
          agentId: true,
        },
        orderBy: { id: "asc" },
      })
    : [];
  const stpCompanyByCompanyId = new Map<number, ManagementStpCompany>();
  for (const stpCompany of stpCompanies) {
    if (!stpCompanyByCompanyId.has(stpCompany.companyId)) {
      stpCompanyByCompanyId.set(stpCompany.companyId, stpCompany);
    }
  }

  const agentContracts = await prisma.stpAgentContractHistory.findMany({
    where: {
      deletedAt: null,
      OR: [
        { contractDate: { gte: rangeStart, lte: rangeEnd } },
        {
          contractStartDate: { lte: rangeEnd },
          OR: [{ contractEndDate: null }, { contractEndDate: { gte: rangeStart } }],
        },
      ],
    },
    select: {
      id: true,
      agentId: true,
      contractStartDate: true,
      contractEndDate: true,
      contractDate: true,
      initialFee: true,
      monthlyFee: true,
      defaultMpInitialType: true,
      defaultMpInitialRate: true,
      defaultMpInitialFixed: true,
      defaultMpInitialDuration: true,
      defaultMpMonthlyType: true,
      defaultMpMonthlyRate: true,
      defaultMpMonthlyFixed: true,
      defaultMpMonthlyDuration: true,
      defaultPpInitialType: true,
      defaultPpInitialRate: true,
      defaultPpInitialFixed: true,
      defaultPpInitialDuration: true,
      defaultPpPerfType: true,
      defaultPpPerfRate: true,
      defaultPpPerfFixed: true,
      defaultPpPerfDuration: true,
    },
    orderBy: [{ contractStartDate: "desc" }, { id: "desc" }],
  });
  const overrides = agentContracts.length > 0 && stpCompanies.length > 0
    ? await prisma.stpAgentCommissionOverride.findMany({
        where: {
          agentContractHistoryId: { in: agentContracts.map((history) => history.id) },
          stpCompanyId: { in: stpCompanies.map((company) => company.id) },
        },
      })
    : [];
  const overrideByAgentContractAndCompany = new Map(
    overrides.map((override) => [`${override.agentContractHistoryId}-${override.stpCompanyId}`, override as ManagementCommissionOverride])
  );

  let revenue = 0;
  let commissionCost = 0;
  let directAgentCost = 0;
  const revenueByCompanyId = new Map<number, number>();
  const commissionCostByCompanyId = new Map<number, number>();
  const firstContractCompanies = params.companies.filter((company) =>
    isFirstContractInRange(company, params.eventMaps, params.range)
  );
  const contractCount = firstContractCompanies.length;

  const addRevenue = (companyId: number, amount: number) => {
    revenue += amount;
    addAmount(revenueByCompanyId, companyId, amount);
  };
  const addCommissionCost = (companyId: number, amount: number) => {
    commissionCost += amount;
    addAmount(commissionCostByCompanyId, companyId, amount);
  };

  for (const month of monthContexts) {
    for (const contract of contracts as ManagementContract[]) {
      if (!MANAGEMENT_REVENUE_STATUSES.includes(contract.status)) continue;
      if (isDateInMonth(contract.contractDate, month)) {
        if (contract.initialFee > 0) addRevenue(contract.companyId, contract.initialFee);
      }
      if (contract.monthlyFee > 0 && overlapsMonth(contract.contractStartDate, contract.contractEndDate, month)) {
        addRevenue(contract.companyId, proratedAmount(contract.monthlyFee, contract.contractStartDate, contract.contractEndDate, month));
      }
    }

    for (const candidate of candidates as ManagementCandidate[]) {
      if (!isDateInMonth(candidate.joinDate, month)) continue;
      const contract = findPerformanceContract(candidate, contracts as ManagementContract[]);
      if (contract) addRevenue(contract.companyId, contract.performanceFee);
    }

    for (const contract of contracts as ManagementContract[]) {
      if (contract.status !== "active") continue;
      const stpCompany = stpCompanyByCompanyId.get(contract.companyId);
      if (!stpCompany?.agentId) continue;
      const agentContract = findAgentContract(agentContracts as ManagementAgentContract[], stpCompany.agentId, contract.contractStartDate);
      if (!agentContract) continue;
      const override = overrideByAgentContractAndCompany.get(`${agentContract.id}-${stpCompany.id}`) ?? null;
      const commissionConfig = buildCommissionConfig(contract.contractPlan as ContractPlan, agentContract, override);

      if (toYearMonth(contract.contractStartDate) === month.month && contract.initialFee > 0) {
        const amount = calcByType(contract.initialFee, commissionConfig.initialType, commissionConfig.initialRate, commissionConfig.initialFixed);
        if (amount > 0) addCommissionCost(contract.companyId, amount);
      }
      if (contract.monthlyFee > 0 && contract.contractPlan !== "performance") {
        const diff = monthsDiff(toYearMonth(contract.contractStartDate), month.month);
        const duration = commissionConfig.monthlyDuration ?? 12;
        if (diff >= 0 && diff < duration) {
          const amount = calcByType(contract.monthlyFee, commissionConfig.monthlyType, commissionConfig.monthlyRate, commissionConfig.monthlyFixed);
          if (amount > 0) addCommissionCost(contract.companyId, amount);
        }
      }
    }

    for (const candidate of candidates as ManagementCandidate[]) {
      if (!isDateInMonth(candidate.joinDate, month) || !candidate.stpCompany?.agentId) continue;
      const contract = findPerformanceContract(candidate, contracts as ManagementContract[]);
      if (!contract) continue;
      const agentContract = findAgentContract(agentContracts as ManagementAgentContract[], candidate.stpCompany.agentId, candidate.joinDate!);
      if (!agentContract) continue;
      const override = overrideByAgentContractAndCompany.get(`${agentContract.id}-${candidate.stpCompany.id}`) ?? null;
      const commissionConfig = buildCommissionConfig(contract.contractPlan as ContractPlan, agentContract, override);
      const amount = calcByType(contract.performanceFee, commissionConfig.perfType, commissionConfig.perfRate, commissionConfig.perfFixed);
      if (amount > 0) addCommissionCost(contract.companyId, amount);
    }

    for (const agentContract of agentContracts as ManagementAgentContract[]) {
      const initialFeeDate = agentContract.contractDate ?? agentContract.contractStartDate;
      if (isDateInMonth(initialFeeDate, month) && (agentContract.initialFee ?? 0) > 0) {
        directAgentCost += agentContract.initialFee ?? 0;
      }
      if ((agentContract.monthlyFee ?? 0) > 0 && overlapsMonth(agentContract.contractStartDate, agentContract.contractEndDate, month)) {
        directAgentCost += proratedAmount(agentContract.monthlyFee ?? 0, agentContract.contractStartDate, agentContract.contractEndDate, month);
      }
    }
  }

  const cost = commissionCost + directAgentCost;
  const grossProfit = revenue - cost;
  const grossMargin = ratePercent(grossProfit, revenue);

  const targetMap = new Map<string, number>();
  for (const target of kpiTargets) {
    addNullableAmount(targetMap, target.kpiKey, target.targetValue);
  }
  const revenueTarget = targetMap.get(KPI_KEYS.MONTHLY_REVENUE) ?? null;
  const grossProfitTarget = targetMap.get(KPI_KEYS.MONTHLY_GROSS_PROFIT) ?? null;
  const contractTarget = targetMap.get(KPI_KEYS.NEW_CONTRACTS) ?? null;
  const grossMarginTarget = revenueTarget && grossProfitTarget != null ? ratePercent(grossProfitTarget, revenueTarget) : null;

  const metrics: ManagementMetric[] = [
    targetMetric({ key: "revenue", label: "売上", actual: revenue, target: revenueTarget, format: "currency" }),
    targetMetric({ key: "grossProfit", label: "粗利", actual: grossProfit, target: grossProfitTarget, format: "currency" }),
    targetMetric({ key: "grossMargin", label: "粗利率", actual: grossMargin, target: grossMarginTarget, format: "rate" }),
    targetMetric({ key: "sellingGeneralAdministrativeExpense", label: "販管費", actual: null, target: null, format: "placeholder" }),
    targetMetric({ key: "operatingProfit", label: "営業利益", actual: null, target: null, format: "placeholder" }),
    targetMetric({ key: "contractCount", label: "契約数", actual: contractCount, target: contractTarget, format: "count" }),
  ];

  const currentFunnel = buildCurrentResult({
    companies: params.companies,
    stages: params.stages,
    eventMaps: params.eventMaps,
    range: params.range,
  });
  const funnelTargets = await prisma.stpDashboardFunnelTarget.findMany({
    where: {
      targetMonth: { in: months },
      productKey: params.productScope.key,
      staffKey: ALL_STAFF,
    },
  });
  const targetSum = (key: keyof Pick<typeof funnelTargets[number], "leadTarget" | "validLeadTarget" | "meetingTarget" | "contractTarget" | "lostTarget">) => {
    let found = false;
    const total = funnelTargets.reduce((sum, target) => {
      const value = target[key];
      if (value == null) return sum;
      found = true;
      return sum + value;
    }, 0);
    return found ? total : null;
  };
  const funnelTargetValues = {
    lead: targetSum("leadTarget"),
    validLead: targetSum("validLeadTarget"),
    meeting: targetSum("meetingTarget"),
    pending: null,
    contract: targetSum("contractTarget"),
    lost: targetSum("lostTarget"),
  };
  const funnelRows: ManagementFunnelRow[] = currentFunnel.metrics
    .filter((metric) => metric.key !== "pending")
    .map((metric) => {
      const target = funnelTargetValues[metric.key];
      return {
        key: metric.key,
        label: metric.key === "meeting" ? "商談" : metric.label,
        actual: metric.value,
        target,
        achievementRate: target != null && target > 0 ? Math.round((metric.value / target) * 1000) / 10 : null,
      };
    });
  const metricValue = (key: ManagementFunnelRow["key"]) => funnelRows.find((row) => row.key === key)?.actual ?? 0;
  const rateRows: ManagementRateRow[] = [
    { key: "validRate", label: "有効率", value: roundRate(metricValue("validLead"), metricValue("lead")), numerator: metricValue("validLead"), denominator: metricValue("lead") },
    { key: "meetingRate", label: "商談化率", value: roundRate(metricValue("meeting"), metricValue("validLead")), numerator: metricValue("meeting"), denominator: metricValue("validLead") },
    { key: "contractRate", label: "契約率", value: roundRate(metricValue("contract"), metricValue("meeting")), numerator: metricValue("contract"), denominator: metricValue("meeting") },
    { key: "lostRate", label: "失注率", value: roundRate(metricValue("lost"), metricValue("meeting")), numerator: metricValue("lost"), denominator: metricValue("meeting") },
  ];

  const channelRevenue = new Map<string, number>();
  const channelCost = new Map<string, number>();
  for (const [companyId, amount] of revenueByCompanyId.entries()) {
    const stpCompany = stpCompanyByCompanyId.get(companyId);
    const key = stpCompany?.leadSourceId == null ? "__unassigned__" : String(stpCompany.leadSourceId);
    addNullableAmount(channelRevenue, key, amount);
  }
  for (const [companyId, amount] of commissionCostByCompanyId.entries()) {
    const stpCompany = stpCompanyByCompanyId.get(companyId);
    const key = stpCompany?.leadSourceId == null ? "__unassigned__" : String(stpCompany.leadSourceId);
    addNullableAmount(channelCost, key, amount);
  }
  const channelRows = [
    ...params.leadSources.map((source) => {
      const sourceCompanies = params.companies.filter((company) => company.leadSourceId === source.id && isInRange(company.leadAcquiredDate, params.range));
      const meetingCount = sourceCompanies.filter((company) => params.eventMaps.firstMeetingByCompanyId.has(company.companyId)).length;
      const sourceRevenue = channelRevenue.get(String(source.id)) ?? 0;
      const sourceCost = channelCost.get(String(source.id)) ?? 0;
      return {
        leadSourceId: source.id,
        leadSourceName: source.name,
        leadCount: sourceCompanies.length,
        meetingCount,
        contractCount: firstContractCompanies.filter((company) => company.leadSourceId === source.id).length,
        revenue: sourceRevenue,
        grossMargin: ratePercent(sourceRevenue - sourceCost, sourceRevenue),
      };
    }),
    {
      leadSourceId: null,
      leadSourceName: "流入経路未設定",
      leadCount: params.companies.filter((company) => company.leadSourceId == null && isInRange(company.leadAcquiredDate, params.range)).length,
      meetingCount: params.companies.filter((company) => company.leadSourceId == null && params.eventMaps.firstMeetingByCompanyId.has(company.companyId)).length,
      contractCount: firstContractCompanies.filter((company) => company.leadSourceId == null).length,
      revenue: channelRevenue.get("__unassigned__") ?? 0,
      grossMargin: ratePercent((channelRevenue.get("__unassigned__") ?? 0) - (channelCost.get("__unassigned__") ?? 0), channelRevenue.get("__unassigned__") ?? 0),
    },
  ].filter((row) => row.leadCount > 0 || row.contractCount > 0 || row.revenue > 0);

  const staffRevenue = new Map<string, number>();
  const staffContracts = new Map<string, number>();
  for (const [companyId, amount] of revenueByCompanyId.entries()) {
    const stpCompany = stpCompanyByCompanyId.get(companyId);
    addNullableAmount(staffRevenue, stpCompany?.salesStaffId == null ? "__unassigned__" : String(stpCompany.salesStaffId), amount);
  }
  for (const company of firstContractCompanies) {
    addNullableAmount(staffContracts, company.salesStaffId == null ? "__unassigned__" : String(company.salesStaffId), 1);
  }
  const staffRows = [
    ...params.staffOptions.map((staff) => ({
      staffId: Number(staff.value),
      staffName: staff.label,
      contractCount: staffContracts.get(staff.value) ?? 0,
      revenue: staffRevenue.get(staff.value) ?? 0,
      achievementLabel: "準備中",
    })),
    {
      staffId: null,
      staffName: "担当営業未設定",
      contractCount: staffContracts.get("__unassigned__") ?? 0,
      revenue: staffRevenue.get("__unassigned__") ?? 0,
      achievementLabel: "準備中",
    },
  ].filter((row) => row.contractCount > 0 || row.revenue > 0);

  return {
    scopeLabel: params.range.label,
    productLabel: "採用ブースト",
    metrics,
    progressRows: metrics.map(progressRowFromMetric).filter((row) =>
      ["revenue", "grossProfit", "operatingProfit", "contractCount"].includes(row.key)
    ),
    funnelRows,
    rateRows,
    revenueStructureRows: [
      { key: "revenue", label: "売上", amount: revenue, percent: 100, status: "actual" },
      { key: "cost", label: "原価", amount: cost, percent: ratePercent(cost, revenue), status: "actual" },
      { key: "grossProfit", label: "粗利", amount: grossProfit, percent: grossMargin, status: "actual" },
      { key: "sellingGeneralAdministrativeExpense", label: "販管費", amount: null, percent: null, status: "pending" },
      { key: "operatingProfit", label: "営業利益", amount: null, percent: null, status: "pending" },
    ],
    channelRows,
    staffRows,
    totals: {
      revenue,
      cost,
      grossProfit,
      grossMargin,
      contractCount,
    },
  };
}

async function buildAllComputedData(params: {
  period?: string;
  product?: string;
  staff?: string;
}) {
  const { productOptions, staffOptions, monthRange, periodOptions } = await getBaseOptions();
  const period = resolvePeriod(params.period, monthRange);
  const selectedProduct = productOptions.some((option) => option.value === params.product)
    ? params.product!
    : productOptions[0]?.value ?? FALLBACK_PRODUCT;
  const selectedStaff =
    params.staff === ALL_STAFF || staffOptions.some((option) => option.value === params.staff)
      ? params.staff ?? ALL_STAFF
      : ALL_STAFF;

  const staffScope = normalizeStaffScope(selectedStaff, staffOptions);
  const staffWhere = staffScope.id ? { salesStaffId: staffScope.id } : {};

  const [companies, allCompanies, stages, leadSources] = await Promise.all([
    prisma.stpCompany.findMany({
      where: staffWhere,
      select: {
        id: true,
        companyId: true,
        company: { select: { name: true, companyCode: true } },
        agent: { select: { company: { select: { name: true, companyCode: true } } } },
        leadAcquiredDate: true,
        leadValidity: true,
        leadSourceId: true,
        leadSource: { select: { name: true } },
        industryType: true,
        industry: true,
        dealProbability: true,
        nextContactDate: true,
        salesStaffId: true,
        salesStaff: { select: { name: true } },
        asStaff: { select: { name: true } },
        currentStage: { select: { id: true, name: true, stageType: true } },
        lostReasonOption: { select: { name: true } },
        lostReason: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.stpCompany.findMany({
      select: {
        id: true,
        companyId: true,
        company: { select: { name: true, companyCode: true } },
        agent: { select: { company: { select: { name: true, companyCode: true } } } },
        leadAcquiredDate: true,
        leadValidity: true,
        leadSourceId: true,
        leadSource: { select: { name: true } },
        industryType: true,
        industry: true,
        dealProbability: true,
        nextContactDate: true,
        salesStaffId: true,
        salesStaff: { select: { name: true } },
        asStaff: { select: { name: true } },
        currentStage: { select: { id: true, name: true, stageType: true } },
        lostReasonOption: { select: { name: true } },
        lostReason: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.stpStage.findMany({
      where: { isActive: true },
      select: { id: true, name: true, stageType: true },
      orderBy: [{ displayOrder: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    }),
    prisma.stpLeadSource.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    }),
  ]);

  const eventMaps = await getEventMaps(companies);
  const allEventMaps = selectedStaff === ALL_STAFF ? eventMaps : await getEventMaps(allCompanies);
  const current = buildCurrentResult({ companies, stages, eventMaps, range: period.range });
  const previousMonth = addMonths(period.targetMonth, -1);
  const previousRange = { ...parseMonth(previousMonth), label: monthLabel(previousMonth) };
  const previous = buildCurrentResult({ companies, stages, eventMaps, range: previousRange });
  const currentWithPreviousRates = applyPreviousRates(current, previous.rates);
  const cohortMonths = Array.from({ length: 5 }, (_, index) => addMonths(period.targetMonth, -index)).reverse();
  const cohort = {
    months: cohortMonths.map((month) => buildCohortMonthResult(month, companies, eventMaps)),
    dwellTimes: currentWithPreviousRates.dwellTimes,
    lostReasons: currentWithPreviousRates.lostReasons,
  };
  const channelAnalysis = buildChannelAnalysis({
    companies: allCompanies,
    leadSources,
    staffOptions,
    eventMaps: allEventMaps,
    range: period.range,
  });
  const dealManagement = await buildDealManagement({
    companies,
    stages,
    eventMaps,
    staffScope,
  });
  const exitKpi = await buildExitKpiData(period.targetMonth);
  const productScope = normalizeProductScope(selectedProduct, productOptions);
  const management = await buildManagementDashboardData({
    companies: allCompanies,
    stages,
    leadSources,
    staffOptions,
    eventMaps: allEventMaps,
    range: period.range,
    selectedPeriod: period.selectedPeriod,
    monthRange,
    productScope,
  });

  return {
    productOptions,
    staffOptions,
    periodOptions,
    selectedPeriod: period.selectedPeriod,
    selectedProduct,
    selectedStaff,
    targetMonth: period.targetMonth,
    current: currentWithPreviousRates,
    cohort,
    channelAnalysis,
    dealManagement,
    exitKpi,
    management,
  };
}

export async function getNewDashboardData(params: {
  period?: string;
  product?: string;
  staff?: string;
}): Promise<NewDashboardData> {
  const computed = await buildAllComputedData(params);
  const productScope = normalizeProductScope(computed.selectedProduct, computed.productOptions);
  const staffScope = normalizeStaffScope(computed.selectedStaff, computed.staffOptions);
  const [snapshot, target] = await Promise.all([
    prisma.stpDashboardMonthEndSnapshot.findUnique({
      where: {
        targetMonth_productKey_staffKey: {
          targetMonth: computed.targetMonth,
          productKey: productScope.key,
          staffKey: staffScope.key,
        },
      },
    }),
    prisma.stpDashboardFunnelTarget.findUnique({
      where: {
        targetMonth_productKey_staffKey: {
          targetMonth: computed.targetMonth,
          productKey: productScope.key,
          staffKey: staffScope.key,
        },
      },
    }),
  ]);
  const targetValues = targetValuesFromRecord(target);
  const current = applyTargets(computed.current, targetValues);
  const snapshotData = snapshot ? applyTargets(snapshot.snapshotData as unknown as CurrentFunnelResult, targetValues) : null;

  return {
    periodOptions: computed.periodOptions,
    productOptions: computed.productOptions,
    staffOptions: computed.staffOptions,
    selectedPeriod: computed.selectedPeriod,
    selectedProduct: computed.selectedProduct,
    selectedStaff: computed.selectedStaff,
    targetContext: {
      targetMonth: computed.targetMonth,
      productKey: productScope.key,
      productName: productScope.name,
      staffKey: staffScope.key,
      staffName: staffScope.name,
      values: targetValues,
    },
    current,
    cohort: computed.cohort,
    snapshot: {
      exists: !!snapshot,
      targetMonth: computed.targetMonth,
      capturedAt: snapshot?.capturedAt.toISOString() ?? null,
      data: snapshotData,
    },
    channelAnalysis: computed.channelAnalysis,
    dealManagement: computed.dealManagement,
    exitKpi: computed.exitKpi,
    management: computed.management,
  };
}

async function upsertSnapshot(params: {
  targetMonth: string;
  productScope: ProductScope;
  staffScope: StaffScope;
  data: CurrentFunnelResult;
}) {
  await prisma.stpDashboardMonthEndSnapshot.upsert({
    where: {
      targetMonth_productKey_staffKey: {
        targetMonth: params.targetMonth,
        productKey: params.productScope.key,
        staffKey: params.staffScope.key,
      },
    },
    update: {
      productName: params.productScope.name,
      productId: params.productScope.id,
      staffName: params.staffScope.name,
      salesStaffId: params.staffScope.id,
      snapshotData: params.data as unknown as Prisma.InputJsonValue,
      capturedAt: new Date(),
    },
    create: {
      targetMonth: params.targetMonth,
      productKey: params.productScope.key,
      productName: params.productScope.name,
      productId: params.productScope.id,
      staffKey: params.staffScope.key,
      staffName: params.staffScope.name,
      salesStaffId: params.staffScope.id,
      snapshotData: params.data as unknown as Prisma.InputJsonValue,
      capturedAt: new Date(),
    },
  });
}

export async function saveMonthEndSnapshotForSelection(params: {
  period?: string;
  product?: string;
  staff?: string;
}) {
  "use server";

  await requireEdit("stp");
  const computed = await buildAllComputedData(params);
  const productScope = normalizeProductScope(computed.selectedProduct, computed.productOptions);
  const staffScope = normalizeStaffScope(computed.selectedStaff, computed.staffOptions);
  await upsertSnapshot({
    targetMonth: computed.targetMonth,
    productScope,
    staffScope,
    data: computed.current,
  });
  revalidatePath("/stp/new-dashboard");
}

export async function saveCurrentMonthEndSnapshotsForCron() {
  const { productOptions, staffOptions, monthRange } = await getBaseOptions();
  const targetMonth = monthRange.endMonth;
  const staffScopes = [
    { key: ALL_STAFF, name: "すべて", id: null },
    ...staffOptions.map((staff) => normalizeStaffScope(staff.value, staffOptions)),
  ];
  const productScopes = productOptions.map((product) => normalizeProductScope(product.value, productOptions));

  let saved = 0;
  for (const productScope of productScopes) {
    for (const staffScope of staffScopes) {
      const computed = await buildAllComputedData({
        period: targetMonth,
        product: productScope.id ? String(productScope.id) : FALLBACK_PRODUCT,
        staff: staffScope.id ? String(staffScope.id) : ALL_STAFF,
      });
      await upsertSnapshot({
        targetMonth,
        productScope,
        staffScope,
        data: computed.current,
      });
      saved += 1;
    }
  }

  return { targetMonth, saved };
}
