export const ALL_STAFF = "__all_staff__";
export const FALLBACK_PRODUCT = "recruitment-boost";

export type DashboardOption = {
  value: string;
  label: string;
};

export type DashboardMode = "current" | "cohort" | "snapshot";

export type FunnelMetric = {
  key: FunnelTargetMetricKey;
  label: string;
  value: number;
  unit: "件" | "%";
  subLabel: string;
  tone: "blue" | "green" | "orange" | "red" | "purple" | "gray";
  target: number | null;
  gap: number | null;
};

export type FunnelRate = {
  key: string;
  label: string;
  value: number | null;
  previousValue: number | null;
  previousDiffPt: number | null;
  numerator: number;
  denominator: number;
  note?: string;
};

export type FunnelTargetMetricKey = "lead" | "validLead" | "meeting" | "pending" | "contract" | "lost";

export type FunnelTargetValues = Record<FunnelTargetMetricKey, number | null>;

export type FunnelTargetContext = {
  targetMonth: string;
  productKey: string;
  productName: string;
  staffKey: string;
  staffName: string;
  values: FunnelTargetValues;
};

export type DwellTimeRow = {
  label: string;
  averageDays: number | null;
  sampleCount: number;
};

export type CohortMonthResult = {
  month: string;
  lead: number;
  validLead: number;
  meeting: number;
  pending: number;
  contract: number;
  lost: number;
  validRate: number | null;
  meetingRate: number | null;
  contractRate: number | null;
};

export type LostReasonResult = {
  label: string;
  count: number;
  percent: number;
};

export type CurrentFunnelResult = {
  scopeLabel: string;
  metrics: FunnelMetric[];
  rates: FunnelRate[];
  dwellTimes: DwellTimeRow[];
  lostReasons: LostReasonResult[];
};

export type SnapshotResult = {
  exists: boolean;
  targetMonth: string;
  capturedAt: string | null;
  data: CurrentFunnelResult | null;
};

export type ChannelSummaryMetric = {
  key: string;
  label: string;
  value: number | null;
  format: "count" | "rate" | "currency";
  note?: string;
};

export type ChannelAnalysisRow = {
  leadSourceId: number;
  leadSourceName: string;
  leadCount: number;
  validRate: number | null;
  meetingRate: number | null;
  contractRate: number | null;
  contractCount: number;
  acquiredMrr: number;
  mrrShare: number | null;
  cacLabel: string;
  rating: "S" | "A" | "B" | "C" | "D";
};

export type StaffProgressRow = {
  staffId: number;
  staffName: string;
  meetingCount: number;
  contractCount: number;
  contractRate: number | null;
  newMrr: number;
  achievementLabel: string;
};

export type ChannelAnalysisData = {
  scopeLabel: string;
  summary: ChannelSummaryMetric[];
  rows: ChannelAnalysisRow[];
  staffProgress: StaffProgressRow[];
  unassignedLeadCount: number;
};

export type DealPriority = "高" | "中" | "低";

export type DealManagementSummaryMetric = {
  key: string;
  label: string;
  value: number;
  tone: "blue" | "green" | "orange" | "red" | "purple" | "gray";
};

export type DealStageCountRow = {
  stageId: number;
  stageName: string;
  stageType: string;
  count: number;
};

export type DealFocusConditionKey =
  | "overdueContact"
  | "noAction30Days"
  | "pendingHighProbability"
  | "contractWithin30Days";

export type DealFocusCondition = {
  key: DealFocusConditionKey;
  label: string;
  description: string;
  count: number;
  rowIds: number[];
};

export type DealManagementRow = {
  id: number;
  priority: DealPriority;
  priorityReasons: string[];
  leadAcquiredDate: string | null;
  leadValidity: string | null;
  firstMeetingDate: string | null;
  asStaffName: string | null;
  salesStaffName: string | null;
  companyName: string;
  companyCode: string | null;
  agentName: string | null;
  leadSourceName: string | null;
  industryLabel: string | null;
  stageName: string | null;
  stageType: string | null;
  dealProbability: number | null;
  nextContactDate: string | null;
  latestContactDate: string | null;
  scheduledContractDate: string | null;
  searchText: string;
};

export type DealManagementData = {
  staffLabel: string;
  summary: DealManagementSummaryMetric[];
  stageCounts: DealStageCountRow[];
  focusConditions: DealFocusCondition[];
  rows: DealManagementRow[];
};

export type ExitKpiMetricKey =
  | "currentMrr"
  | "arrRunRate"
  | "nrr"
  | "monthlyChurnRate"
  | "grossMargin"
  | "ebitdaMargin";

export type ExitKpiTargetValues = Record<ExitKpiMetricKey, number | null>;

export type ExitKpiMetric = {
  key: ExitKpiMetricKey;
  label: string;
  actual: number | null;
  target: number | null;
  achievementRate: number | null;
  diff: number | null;
  format: "currency" | "rate";
  inverted: boolean;
  comment: string;
  status: "good" | "warning" | "danger" | "neutral";
};

export type ExitKpiDecisionRow = {
  category: "growth" | "profitability" | "retention" | "efficiency";
  categoryLabel: string;
  mainMetrics: string;
  goodCriteria: string;
  currentValue: string;
  evaluation: "good" | "warning" | "danger" | "neutral";
};

export type ExitKpiEvaluationRow = {
  category: string;
  metric: string;
  actualLabel: string;
  benchmark: string;
  evaluation: "good" | "warning" | "danger" | "neutral";
};

export type ExitKpiAlert = {
  key: string;
  tone: "info" | "success" | "warning" | "danger";
  title: string;
  description: string;
};

export type ExitKpiData = {
  targetMonth: string;
  targetValues: ExitKpiTargetValues;
  metrics: ExitKpiMetric[];
  decisionSummary: ExitKpiDecisionRow[];
  evaluationRows: ExitKpiEvaluationRow[];
  alerts: ExitKpiAlert[];
  details: {
    monthStartMrr: number;
    monthEndExistingMrr: number;
    expansionMrr: number;
    contractionMrr: number;
    churnMrr: number;
    newMrr: number;
    previousMonthEndMrr: number;
    revenue: number;
    expense: number;
    fixedCost: number;
    grossProfit: number;
    ebitdaLikeProfit: number;
    mrrGrowthRate: number | null;
    netNewMrrRate: number | null;
    ruleOf40: number | null;
    twelveMonthRetentionRate: number | null;
  };
};

export type ManagementMetricKey =
  | "revenue"
  | "grossProfit"
  | "grossMargin"
  | "sellingGeneralAdministrativeExpense"
  | "operatingProfit"
  | "contractCount";

export type ManagementMetric = {
  key: ManagementMetricKey;
  label: string;
  actual: number | null;
  target: number | null;
  achievementRate: number | null;
  diff: number | null;
  format: "currency" | "rate" | "count" | "placeholder";
  status: "good" | "warning" | "danger" | "neutral" | "pending";
};

export type ManagementProgressRow = {
  key: ManagementMetricKey;
  label: string;
  actualLabel: string;
  targetLabel: string;
  achievementRateLabel: string;
  forecastLabel: string;
  status: ManagementMetric["status"];
};

export type ManagementFunnelRow = {
  key: FunnelTargetMetricKey;
  label: string;
  actual: number;
  target: number | null;
  achievementRate: number | null;
};

export type ManagementRateRow = {
  key: string;
  label: string;
  value: number | null;
  numerator: number;
  denominator: number;
};

export type ManagementRevenueStructureRow = {
  key: "revenue" | "cost" | "grossProfit" | "sellingGeneralAdministrativeExpense" | "operatingProfit";
  label: string;
  amount: number | null;
  percent: number | null;
  status: "actual" | "pending";
};

export type ManagementChannelRow = {
  leadSourceId: number | null;
  leadSourceName: string;
  leadCount: number;
  meetingCount: number;
  contractCount: number;
  revenue: number;
  grossMargin: number | null;
};

export type ManagementStaffRow = {
  staffId: number | null;
  staffName: string;
  contractCount: number;
  revenue: number;
  achievementLabel: string;
};

export type ManagementDashboardData = {
  scopeLabel: string;
  productLabel: string;
  metrics: ManagementMetric[];
  progressRows: ManagementProgressRow[];
  funnelRows: ManagementFunnelRow[];
  rateRows: ManagementRateRow[];
  revenueStructureRows: ManagementRevenueStructureRow[];
  channelRows: ManagementChannelRow[];
  staffRows: ManagementStaffRow[];
  totals: {
    revenue: number;
    cost: number;
    grossProfit: number;
    grossMargin: number | null;
    contractCount: number;
  };
};

export type NewDashboardData = {
  periodOptions: DashboardOption[];
  productOptions: DashboardOption[];
  staffOptions: DashboardOption[];
  selectedPeriod: string;
  selectedProduct: string;
  selectedStaff: string;
  targetContext: FunnelTargetContext;
  current: CurrentFunnelResult;
  cohort: {
    months: CohortMonthResult[];
    dwellTimes: DwellTimeRow[];
    lostReasons: LostReasonResult[];
  };
  snapshot: SnapshotResult;
  channelAnalysis: ChannelAnalysisData;
  dealManagement: DealManagementData;
  exitKpi: ExitKpiData;
  management: ManagementDashboardData;
};
