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
  type DwellTimeRow,
  type FunnelRate,
  type FunnelTargetValues,
  type LostReasonResult,
  type NewDashboardData,
  type StaffProgressRow,
} from "./types";

const STP_PROJECT_ID = 1;
const MEETING_CATEGORY_NAME = "商談";

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
  leadAcquiredDate: Date | null;
  leadValidity: string | null;
  leadSourceId: number | null;
  currentStage: { id: number; name: string; stageType: string } | null;
  salesStaffId: number | null;
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
  const [meetingHistories, contractHistories, lostHistories, stageHistories] = await Promise.all([
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
        leadAcquiredDate: true,
        leadValidity: true,
        leadSourceId: true,
        salesStaffId: true,
        currentStage: { select: { id: true, name: true, stageType: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.stpCompany.findMany({
      select: {
        id: true,
        companyId: true,
        leadAcquiredDate: true,
        leadValidity: true,
        leadSourceId: true,
        salesStaffId: true,
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
