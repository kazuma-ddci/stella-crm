import type { InsightCategory, InsightItem } from "./types";

// ============================================
// カテゴリ定義
// ============================================

export const INSIGHT_CATEGORIES: InsightCategory[] = [
  {
    id: "revenue",
    name: "売上・収益",
    description: "売上実績、見込み、推移、内訳",
    icon: "💰",
  },
  {
    id: "pipeline",
    name: "営業パイプライン",
    description: "ファネル、リード、受注、商談",
    icon: "📊",
  },
  {
    id: "lost",
    name: "失注分析",
    description: "失注率、理由、ステージ分布",
    icon: "❌",
  },
  {
    id: "customer",
    name: "顧客・企業",
    description: "顧客数、ランキング、契約状況",
    icon: "🏢",
  },
  {
    id: "agent",
    name: "代理店",
    description: "リード獲得、受注、支払い、ROI",
    icon: "🤝",
  },
  {
    id: "contract",
    name: "契約書",
    description: "未締結、締結状況、CloudSign",
    icon: "📝",
  },
  {
    id: "expense",
    name: "経費・支払",
    description: "経費合計、種別内訳、未払い",
    icon: "💸",
  },
  {
    id: "activity",
    name: "活動・接触",
    description: "接触件数、担当者別、未接触",
    icon: "📞",
  },
  {
    id: "kpi",
    name: "KPI・採用",
    description: "目標達成、候補者、メディア別",
    icon: "📈",
  },
];

// ============================================
// 項目定義
// ============================================

export const INSIGHT_ITEMS: InsightItem[] = [
  // === 売上・収益 ===
  {
    id: "revenue_actual",
    categoryId: "revenue",
    name: "今月の売上実績",
    description: "当月の売上合計と前月比",
    resultType: "number",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "revenue_forecast",
    categoryId: "revenue",
    name: "売上見込み（未確定含む）",
    description: "scheduled含む全契約の見込み金額",
    resultType: "number",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "revenue_breakdown",
    categoryId: "revenue",
    name: "売上内訳（初期/月額/成果）",
    description: "売上タイプ別の内訳と比率",
    resultType: "breakdown",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "revenue_trend",
    categoryId: "revenue",
    name: "月別売上推移（直近12ヶ月）",
    description: "目標と実績の月別推移",
    resultType: "trend",
    params: [{ key: "yearMonth", label: "基準月", type: "month" }],
  },
  {
    id: "revenue_target_rate",
    categoryId: "revenue",
    name: "売上目標達成率",
    description: "当月の目標に対する達成率",
    resultType: "summary",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "gross_profit",
    categoryId: "revenue",
    name: "粗利（売上−固定費）",
    description: "売上から固定費を差し引いた粗利",
    resultType: "number",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "receivables",
    categoryId: "revenue",
    name: "売掛金残高（未回収）",
    description: "未入金の請求書一覧と合計金額",
    resultType: "table",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "overdue_invoices",
    categoryId: "revenue",
    name: "入金遅延リスト",
    description: "支払期限超過の請求書",
    resultType: "table",
  },

  // === 営業パイプライン ===
  {
    id: "sales_funnel",
    categoryId: "pipeline",
    name: "セールスファネル",
    description: "ステージ別の企業数と転換率",
    resultType: "table",
  },
  {
    id: "new_leads",
    categoryId: "pipeline",
    name: "今月の新規リード数",
    description: "当月に獲得したリード数と前月比",
    resultType: "number",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "conversion_rate",
    categoryId: "pipeline",
    name: "リード→受注の転換率",
    description: "リードから受注に至った割合",
    resultType: "number",
  },
  {
    id: "pipeline_by_staff",
    categoryId: "pipeline",
    name: "営業担当者別パイプライン",
    description: "担当者ごとのステージ別案件数",
    resultType: "table",
  },
  {
    id: "avg_deal_days",
    categoryId: "pipeline",
    name: "平均商談期間",
    description: "リード獲得から受注までの平均日数",
    resultType: "number",
  },
  {
    id: "won_this_month",
    categoryId: "pipeline",
    name: "今月の受注実績",
    description: "当月の受注件数と受注金額",
    resultType: "summary",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "progressed_this_month",
    categoryId: "pipeline",
    name: "今月ステージ前進した企業",
    description: "当月にステージが前進した企業リスト",
    resultType: "table",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "stale_deals",
    categoryId: "pipeline",
    name: "滞留案件（30日以上停滞）",
    description: "同じステージに30日以上滞在中の案件",
    resultType: "table",
  },

  // === 失注分析 ===
  {
    id: "lost_count",
    categoryId: "lost",
    name: "今月の失注数",
    description: "当月の失注件数と前月比",
    resultType: "number",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "lost_rate",
    categoryId: "lost",
    name: "失注率",
    description: "全商談に対する失注の割合",
    resultType: "number",
  },
  {
    id: "top_lost_reasons",
    categoryId: "lost",
    name: "失注理由TOP5",
    description: "直近の失注理由ランキング",
    resultType: "ranking",
  },
  {
    id: "lost_stage_distribution",
    categoryId: "lost",
    name: "失注ステージ分布",
    description: "どのステージで失注が多いか",
    resultType: "breakdown",
  },
  {
    id: "pending_deals",
    categoryId: "lost",
    name: "検討中案件リスト",
    description: "現在「検討中」ステータスの案件",
    resultType: "table",
  },
  {
    id: "revived_deals",
    categoryId: "lost",
    name: "復活案件（失注→再開）",
    description: "失注後に再開された案件の履歴",
    resultType: "table",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },

  // === 顧客・企業 ===
  {
    id: "active_customers",
    categoryId: "customer",
    name: "アクティブ顧客数",
    description: "現在契約中の顧客数と推移",
    resultType: "number",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "customer_revenue_ranking",
    categoryId: "customer",
    name: "顧客別月額売上ランキング",
    description: "月額売上が高い顧客TOP10",
    resultType: "ranking",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "expiring_contracts",
    categoryId: "customer",
    name: "契約終了間近の顧客",
    description: "30日以内に契約終了する顧客",
    resultType: "table",
  },
  {
    id: "contract_plan_distribution",
    categoryId: "customer",
    name: "契約プラン別顧客分布",
    description: "月額/成果報酬の顧客数",
    resultType: "breakdown",
  },
  {
    id: "avg_contract_value",
    categoryId: "customer",
    name: "平均契約単価",
    description: "初期費用・月額・成果報酬の平均",
    resultType: "summary",
  },
  {
    id: "industry_distribution",
    categoryId: "customer",
    name: "業種区分別顧客分布",
    description: "一般/派遣の顧客数",
    resultType: "breakdown",
  },

  // === 代理店 ===
  {
    id: "agent_lead_ranking",
    categoryId: "agent",
    name: "代理店別リード獲得ランキング",
    description: "リード獲得数TOP10の代理店",
    resultType: "ranking",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "agent_won_ranking",
    categoryId: "agent",
    name: "代理店別受注件数ランキング",
    description: "受注につながった代理店TOP10",
    resultType: "ranking",
  },
  {
    id: "agent_payment_total",
    categoryId: "agent",
    name: "代理店への支払総額（今月）",
    description: "当月の代理店報酬合計",
    resultType: "number",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "active_agents",
    categoryId: "agent",
    name: "アクティブ代理店数",
    description: "現在アクティブな代理店の数",
    resultType: "summary",
  },
  {
    id: "agent_category_distribution",
    categoryId: "agent",
    name: "代理店カテゴリ別分布",
    description: "代理店/顧問の内訳",
    resultType: "breakdown",
  },

  // === 契約書 ===
  {
    id: "unsigned_contracts",
    categoryId: "contract",
    name: "未締結契約書リスト",
    description: "進行中ステータスの契約書一覧",
    resultType: "table",
  },
  {
    id: "cloudsign_pending",
    categoryId: "contract",
    name: "CloudSign送付中の契約書",
    description: "CloudSign経由で送付中の契約書",
    resultType: "table",
  },
  {
    id: "avg_signing_days",
    categoryId: "contract",
    name: "平均締結日数",
    description: "契約書作成から締結までの平均日数",
    resultType: "number",
  },
  {
    id: "signed_this_month",
    categoryId: "contract",
    name: "今月締結された契約書",
    description: "当月に締結完了した契約書リスト",
    resultType: "table",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },

  // === 経費・支払 ===
  {
    id: "monthly_expenses",
    categoryId: "expense",
    name: "今月の経費合計",
    description: "当月の経費合計と前月比",
    resultType: "number",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "expense_type_breakdown",
    categoryId: "expense",
    name: "経費種別内訳",
    description: "代理店報酬タイプ別の内訳",
    resultType: "breakdown",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "unpaid_expenses",
    categoryId: "expense",
    name: "未払い経費リスト",
    description: "支払いが完了していない経費",
    resultType: "table",
  },

  // === 活動・接触 ===
  {
    id: "contact_count",
    categoryId: "activity",
    name: "今月の接触件数",
    description: "当月の接触件数と方法別内訳",
    resultType: "summary",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "contact_ranking_by_staff",
    categoryId: "activity",
    name: "担当者別接触件数ランキング",
    description: "接触件数が多い担当者TOP10",
    resultType: "ranking",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "inactive_customers",
    categoryId: "activity",
    name: "最近接触がない顧客（30日以上）",
    description: "30日以上接触記録がない顧客",
    resultType: "table",
  },
  {
    id: "contact_method_distribution",
    categoryId: "activity",
    name: "接触方法別分布",
    description: "電話/訪問/メール等の割合",
    resultType: "breakdown",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },

  // === KPI・採用 ===
  {
    id: "kpi_achievement",
    categoryId: "kpi",
    name: "KPI目標 vs 実績一覧",
    description: "全KPI項目の目標と実績の対比",
    resultType: "table",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "candidate_join_count",
    categoryId: "kpi",
    name: "入社実績（候補者）",
    description: "当月の入社者数と推移",
    resultType: "number",
    params: [{ key: "yearMonth", label: "対象月", type: "month" }],
  },
  {
    id: "candidate_media_breakdown",
    categoryId: "kpi",
    name: "メディア別応募実績",
    description: "Indeed/doda等のメディア別候補者数",
    resultType: "breakdown",
  },
];

/** カテゴリIDで項目を取得 */
export function getItemsByCategory(categoryId: string): InsightItem[] {
  return INSIGHT_ITEMS.filter((item) => item.categoryId === categoryId);
}

/** 項目IDで項目を取得 */
export function getItemById(itemId: string): InsightItem | undefined {
  return INSIGHT_ITEMS.find((item) => item.id === itemId);
}
