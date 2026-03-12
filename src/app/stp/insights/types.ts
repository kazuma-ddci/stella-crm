// ============================================
// 経営インサイト チャットUI 型定義
// ============================================

/** インサイトカテゴリ */
export type InsightCategoryId =
  | "revenue"
  | "pipeline"
  | "lost"
  | "customer"
  | "agent"
  | "contract"
  | "expense"
  | "activity"
  | "kpi";

export type InsightCategory = {
  id: InsightCategoryId;
  name: string;
  description: string;
  icon: string;
};

/** インサイト項目 */
export type InsightItemId = string;

export type InsightItem = {
  id: InsightItemId;
  categoryId: InsightCategoryId;
  name: string;
  description: string;
  /** パラメータが必要な場合の定義 */
  params?: InsightParamDef[];
  /** 結果の表示タイプ */
  resultType: InsightResultType;
};

/** パラメータ定義 */
export type InsightParamDef = {
  key: string;
  label: string;
  type: "month" | "number";
  defaultValue?: string | number;
};

/** 結果表示タイプ */
export type InsightResultType =
  | "number"      // 単一数値（前月比付き）
  | "breakdown"   // 内訳（比率バー付き）
  | "table"       // テーブル表示
  | "ranking"     // ランキング表示
  | "trend"       // 月別推移
  | "summary";    // 複合サマリー

/** 結果データ */
export type InsightResult =
  | NumberResult
  | BreakdownResult
  | TableResult
  | RankingResult
  | TrendResult
  | SummaryResult;

export type NumberResult = {
  type: "number";
  title: string;
  value: number;
  format: "currency" | "count" | "percent" | "days";
  comparison?: {
    label: string;
    value: number;
    changePercent: number;
  };
  subItems?: { label: string; value: number; format: "currency" | "count" | "percent" | "days" }[];
};

export type BreakdownResult = {
  type: "breakdown";
  title: string;
  total: number;
  format: "currency" | "count";
  items: { label: string; value: number; percent: number; color?: string }[];
};

export type TableResult = {
  type: "table";
  title: string;
  columns: { key: string; label: string; format?: "currency" | "count" | "percent" | "date" | "text" | "days" }[];
  rows: Record<string, string | number | null>[];
  emptyMessage?: string;
};

export type RankingResult = {
  type: "ranking";
  title: string;
  valueLabel: string;
  format: "currency" | "count" | "percent";
  items: { rank: number; name: string; value: number; detail?: string }[];
  emptyMessage?: string;
};

export type TrendResult = {
  type: "trend";
  title: string;
  format: "currency" | "count";
  months: { label: string; value: number | null; target?: number | null }[];
};

export type SummaryResult = {
  type: "summary";
  title: string;
  cards: { label: string; value: number; format: "currency" | "count" | "percent" | "days"; changePercent?: number }[];
  details?: { label: string; value: string }[];
};

/** チャットメッセージ */
export type ChatMessage =
  | SystemMessage
  | UserMessage
  | ResultMessage
  | LoadingMessage;

export type SystemMessage = {
  id: string;
  role: "system";
  content: string;
  categories?: InsightCategory[];
  items?: InsightItem[];
  params?: InsightParamDef[];
};

export type UserMessage = {
  id: string;
  role: "user";
  content: string;
};

export type ResultMessage = {
  id: string;
  role: "result";
  result: InsightResult;
  commentary: string;
};

export type LoadingMessage = {
  id: string;
  role: "loading";
  step: number;
  steps: string[];
};
