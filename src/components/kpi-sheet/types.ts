// KPIシート関連の型定義

export type KpiMetricKey =
  | "impressions"
  | "cpm"
  | "clicks"
  | "ctr"
  | "cpc"
  | "applications"
  | "cvr"
  | "cpa"
  | "cost";

export type KpiDataType = "target" | "actual";

// 手入力項目（オレンジ背景）
export const MANUAL_INPUT_METRICS: KpiMetricKey[] = [
  "impressions", // 表示回数
  "clicks", // クリック数
  "applications", // 応募数
  "cost", // 費用（運用費込み）
];

// 計算項目（白背景）- 数式で自動算出
export const CALCULATED_METRICS: KpiMetricKey[] = [
  "cpm", // 表示単価 = 費用 ÷ 表示回数
  "ctr", // クリック率 = クリック数 ÷ 表示回数
  "cpc", // クリック単価 = 費用 ÷ クリック数
  "cvr", // 応募率 = 応募数 ÷ クリック数
  "cpa", // 応募単価 = 費用 ÷ 応募数
];

// 手入力かどうかを判定
export function isManualInput(metricKey: KpiMetricKey): boolean {
  return MANUAL_INPUT_METRICS.includes(metricKey);
}

// KPIメトリクス定義
export const KPI_METRICS: {
  key: KpiMetricKey;
  label: string;
  unit: string;
  type: "integer" | "decimal" | "percentage" | "currency";
}[] = [
  { key: "impressions", label: "表示回数", unit: "", type: "integer" },
  { key: "cpm", label: "表示単価", unit: "円", type: "currency" },
  { key: "clicks", label: "クリック数", unit: "", type: "integer" },
  { key: "ctr", label: "クリック率", unit: "%", type: "percentage" },
  { key: "cpc", label: "クリック単価", unit: "円", type: "currency" },
  { key: "applications", label: "応募数", unit: "", type: "integer" },
  { key: "cvr", label: "応募率", unit: "%", type: "percentage" },
  { key: "cpa", label: "応募単価", unit: "円", type: "currency" },
  { key: "cost", label: "費用（運用費込み）", unit: "円", type: "currency" },
];

// 週次データ型
export interface KpiWeeklyData {
  id: number;
  weekStartDate: string; // ISO date string
  weekEndDate: string;
  // 目標値
  targetImpressions: number | null;
  targetCpm: number | null;
  targetClicks: number | null;
  targetCtr: number | null;
  targetCpc: number | null;
  targetApplications: number | null;
  targetCvr: number | null;
  targetCpa: number | null;
  targetCost: number | null;
  // 実績値
  actualImpressions: number | null;
  actualCpm: number | null;
  actualClicks: number | null;
  actualCtr: number | null;
  actualCpc: number | null;
  actualApplications: number | null;
  actualCvr: number | null;
  actualCpa: number | null;
  actualCost: number | null;
}

// KPIシート型
export interface KpiSheet {
  id: number;
  stpCompanyId: number;
  name: string;
  weeklyData: KpiWeeklyData[];
  createdAt: string;
  updatedAt: string;
}

// 共有リンク型
export interface KpiShareLink {
  id: number;
  token: string;
  expiresAt: string;
  createdAt: string;
}

// セル更新用の型
export interface KpiCellUpdate {
  weeklyDataId: number;
  field: string;
  value: number | null;
}

// フィールド名のマッピング（target/actualプレフィックス付き）
export function getFieldName(
  dataType: KpiDataType,
  metricKey: KpiMetricKey
): string {
  const capitalizedKey =
    metricKey.charAt(0).toUpperCase() + metricKey.slice(1);
  return `${dataType}${capitalizedKey}`;
}

// 値のフォーマット
export function formatKpiValue(
  value: number | null,
  type: "integer" | "decimal" | "percentage" | "currency"
): string {
  if (value === null || value === undefined) return "-";

  switch (type) {
    case "integer":
      return value.toLocaleString();
    case "decimal":
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case "percentage":
      return `${value.toFixed(2)}%`;
    case "currency":
      return `¥${value.toLocaleString()}`;
    default:
      return String(value);
  }
}

// 差分計算
export function calculateDiff(
  target: number | null,
  actual: number | null
): number | null {
  if (target === null || actual === null) return null;
  return actual - target;
}

// 計算項目の値を算出（IFERROR相当）
// 数式:
// - cpm (表示単価) = cost / impressions
// - ctr (クリック率) = clicks / impressions * 100
// - cpc (クリック単価) = cost / clicks
// - cvr (応募率) = applications / clicks * 100
// - cpa (応募単価) = cost / applications
export function calculateMetricValue(
  metricKey: KpiMetricKey,
  data: {
    impressions: number | null;
    clicks: number | null;
    applications: number | null;
    cost: number | null;
  }
): number | null {
  const { impressions, clicks, applications, cost } = data;

  switch (metricKey) {
    case "cpm": // 表示単価 = 費用 ÷ 表示回数
      if (cost === null || impressions === null || impressions === 0)
        return null;
      return cost / impressions;

    case "ctr": // クリック率 = クリック数 ÷ 表示回数 × 100
      if (clicks === null || impressions === null || impressions === 0)
        return null;
      return (clicks / impressions) * 100;

    case "cpc": // クリック単価 = 費用 ÷ クリック数
      if (cost === null || clicks === null || clicks === 0) return null;
      return cost / clicks;

    case "cvr": // 応募率 = 応募数 ÷ クリック数 × 100
      if (applications === null || clicks === null || clicks === 0) return null;
      return (applications / clicks) * 100;

    case "cpa": // 応募単価 = 費用 ÷ 応募数
      if (cost === null || applications === null || applications === 0)
        return null;
      return cost / applications;

    default:
      return null;
  }
}
