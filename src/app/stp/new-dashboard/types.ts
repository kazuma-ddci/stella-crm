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
};
