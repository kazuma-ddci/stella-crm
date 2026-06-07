import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
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
  type FunnelRate,
  type FunnelTargetValues,
  type LostReasonResult,
  type NewDashboardData,
  type StaffProgressRow,
} from "./types";

const STP_PROJECT_ID = 1;
const MEETING_CATEGORY_NAME = "商談";
const SCHEDULED_CONTRACT_STATUS = "scheduled";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const EMPTY_TARGET_VALUES: FunnelTargetValues = {
  lead: null,
  validLead: null,
  meeting: null,
  pending: null,
  contract: null,
  lost: null,
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

type EventMaps = {
  firstMeetingByCompanyId: Map<number, Date>;
  latestContactByCompanyId: Map<number, Date>;
  firstContractByCompanyId: Map<number, Date>;
  firstContractValueByCompanyId: Map<number, ContractValue>;
  firstLostByStpCompanyId: Map<number, { recordedAt: Date; reasonName: string }>;
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
        lostReasonOption: { select: { name: true } },
      },
      orderBy: { recordedAt: "asc" },
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

  const firstLostByStpCompanyId = new Map<number, { recordedAt: Date; reasonName: string }>();
  for (const history of lostHistories) {
    if (!firstLostByStpCompanyId.has(history.stpCompanyId)) {
      firstLostByStpCompanyId.set(history.stpCompanyId, {
        recordedAt: history.recordedAt,
        reasonName: history.lostReasonOption?.name ?? "未選択",
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
    firstLostByStpCompanyId,
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
  const contractCount = scopeCompanies.filter((company) =>
    isInRange(eventMaps.firstContractByCompanyId.get(company.companyId), range)
  ).length;
  const lostCompanies = scopeCompanies.filter((company) =>
    isInRange(eventMaps.firstLostByStpCompanyId.get(company.id)?.recordedAt, range)
  );

  return {
    scopeLabel: range.label,
    metrics: [
      { key: "lead", label: "リード", value: scopeCompanies.length, unit: "件", subLabel: "リード獲得日基準", tone: "blue", target: null, gap: null },
      { key: "validLead", label: "有効リード", value: validLeadCount, unit: "件", subLabel: "有効性=有効", tone: "blue", target: null, gap: null },
      { key: "meeting", label: "商談実施", value: meetingCount, unit: "件", subLabel: "初回商談日基準", tone: "blue", target: null, gap: null },
      { key: "pending", label: "検討中", value: pendingCount, unit: "件", subLabel: "現在パイプライン", tone: "orange", target: null, gap: null },
      { key: "contract", label: "契約", value: contractCount, unit: "件", subLabel: "契約日基準", tone: "green", target: null, gap: null },
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
        value: roundRate(
          scopeCompanies.filter(
            (company) =>
              company.leadValidity === "有効" &&
              isInRange(eventMaps.firstContractByCompanyId.get(company.companyId), range)
          ).length,
          validLeadCount
        ),
        previousValue: null,
        previousDiffPt: null,
        numerator: scopeCompanies.filter(
          (company) =>
            company.leadValidity === "有効" &&
            isInRange(eventMaps.firstContractByCompanyId.get(company.companyId), range)
        ).length,
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
  const contract = scopeCompanies.filter((company) => eventMaps.firstContractByCompanyId.has(company.companyId)).length;
  const validContract = scopeCompanies.filter(
    (company) => company.leadValidity === "有効" && eventMaps.firstContractByCompanyId.has(company.companyId)
  ).length;
  const lost = scopeCompanies.filter((company) => company.currentStage?.stageType === "closed_lost").length;

  return {
    month: yearMonth,
    lead: scopeCompanies.length,
    validLead,
    meeting,
    pending,
    contract,
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
    const label = eventMaps.firstLostByStpCompanyId.get(company.id)?.reasonName ?? "未選択";
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
  const validContractCompanies = scopeCompanies.filter(
    (company) => company.leadValidity === "有効" && params.eventMaps.firstContractByCompanyId.has(company.companyId)
  );
  const acquiredMrr = validContractCompanies.reduce(
    (sum, company) => sum + (params.eventMaps.firstContractValueByCompanyId.get(company.companyId)?.monthlyFee ?? 0),
    0
  );
  const averageContractValue = averageCurrency(
    validContractCompanies.map((company) => {
      const contract = params.eventMaps.firstContractValueByCompanyId.get(company.companyId);
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
    const sourceContractCompanies = sourceCompanies.filter(
      (company) => company.leadValidity === "有効" && params.eventMaps.firstContractByCompanyId.has(company.companyId)
    );
    const sourceMrr = sourceContractCompanies.reduce(
      (sum, company) => sum + (params.eventMaps.firstContractValueByCompanyId.get(company.companyId)?.monthlyFee ?? 0),
      0
    );

    return {
      id: source.id,
      leadSourceId: source.id,
      leadSourceName: source.name,
      leadCount: sourceCompanies.length,
      validRate: roundRate(sourceValidLeadCount, sourceValiditySetCount),
      meetingRate: roundRate(sourceMeetingCount, sourceCompanies.length),
      contractRate: roundRate(sourceContractCompanies.length, sourceValidLeadCount),
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
    const staffContractCompanies = staffCompanies.filter((company) => params.eventMaps.firstContractByCompanyId.has(company.companyId));
    const staffMrr = staffContractCompanies.reduce(
      (sum, company) => sum + (params.eventMaps.firstContractValueByCompanyId.get(company.companyId)?.monthlyFee ?? 0),
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
