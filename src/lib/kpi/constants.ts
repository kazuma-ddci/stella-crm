/** 月次KPI目標のキー（KGI） */
export const MONTHLY_KPI_KEYS = {
  MONTHLY_REVENUE: "monthly_revenue",
  MONTHLY_GROSS_PROFIT: "monthly_gross_profit",
  NEW_CONTRACTS: "new_contracts",
  FIXED_COST: "fixed_cost",
  MONTHLY_LEADS: "monthly_leads",
} as const;

export type MonthlyKpiKey =
  (typeof MONTHLY_KPI_KEYS)[keyof typeof MONTHLY_KPI_KEYS];

/** 部門別KPIキー */
export const DEPT_KPI_KEYS = {
  // Alliance
  ALLIANCE_VALID_LEADS: "alliance_valid_leads",
  ALLIANCE_MEETINGS: "alliance_meetings",
  ALLIANCE_SQL_RATE: "alliance_sql_rate",
  // Sales
  SALES_CLOSE_RATE: "sales_close_rate",
  SALES_NEW_CONTRACTS: "sales_new_contracts",
  SALES_MEETING_TO_CONTRACT_LT: "sales_meeting_to_contract_lt",
  // バックオフィス
  BO_OPERATION_START_LT: "bo_operation_start_lt",
  BO_COLLECTION_DELAY_RATE: "bo_collection_delay_rate",
  BO_MEETING_TO_CONTRACT_LT: "bo_meeting_to_contract_lt",
} as const;

export type DeptKpiKey =
  (typeof DEPT_KPI_KEYS)[keyof typeof DEPT_KPI_KEYS];

/** グローバル設定を含む全KPIキー */
export const KPI_KEYS = {
  ...MONTHLY_KPI_KEYS,
  ...DEPT_KPI_KEYS,
  FISCAL_YEAR_START: "fiscal_year_start",
} as const;

export type KpiKey = (typeof KPI_KEYS)[keyof typeof KPI_KEYS];

export const KPI_LABELS: Record<KpiKey, string> = {
  [KPI_KEYS.MONTHLY_REVENUE]: "月次売上目標",
  [KPI_KEYS.MONTHLY_GROSS_PROFIT]: "月次粗利目標",
  [KPI_KEYS.NEW_CONTRACTS]: "新規契約目標",
  [KPI_KEYS.FIXED_COST]: "固定費",
  [KPI_KEYS.MONTHLY_LEADS]: "月間リード目標",
  [KPI_KEYS.FISCAL_YEAR_START]: "決算期首月",
  // Alliance
  [KPI_KEYS.ALLIANCE_VALID_LEADS]: "有効リード",
  [KPI_KEYS.ALLIANCE_MEETINGS]: "商談数",
  [KPI_KEYS.ALLIANCE_SQL_RATE]: "SQL化率",
  // Sales
  [KPI_KEYS.SALES_CLOSE_RATE]: "成約率",
  [KPI_KEYS.SALES_NEW_CONTRACTS]: "新規契約数",
  [KPI_KEYS.SALES_MEETING_TO_CONTRACT_LT]: "商談→契約LT",
  // バックオフィス
  [KPI_KEYS.BO_OPERATION_START_LT]: "運用開始LT",
  [KPI_KEYS.BO_COLLECTION_DELAY_RATE]: "回収遅延率",
  [KPI_KEYS.BO_MEETING_TO_CONTRACT_LT]: "商談→契約LT",
};

/** 部門KPIの単位 */
export const DEPT_KPI_UNITS: Record<DeptKpiKey, string> = {
  [DEPT_KPI_KEYS.ALLIANCE_VALID_LEADS]: "件",
  [DEPT_KPI_KEYS.ALLIANCE_MEETINGS]: "件",
  [DEPT_KPI_KEYS.ALLIANCE_SQL_RATE]: "%",
  [DEPT_KPI_KEYS.SALES_CLOSE_RATE]: "%",
  [DEPT_KPI_KEYS.SALES_NEW_CONTRACTS]: "社",
  [DEPT_KPI_KEYS.SALES_MEETING_TO_CONTRACT_LT]: "日",
  [DEPT_KPI_KEYS.BO_OPERATION_START_LT]: "日",
  [DEPT_KPI_KEYS.BO_COLLECTION_DELAY_RATE]: "%",
  [DEPT_KPI_KEYS.BO_MEETING_TO_CONTRACT_LT]: "日",
};

/** 部門KPIのデフォルト目標値（目標が未設定の場合に使用） */
export const DEPT_KPI_DEFAULT_TARGETS: Partial<Record<DeptKpiKey, number>> = {
  [DEPT_KPI_KEYS.ALLIANCE_SQL_RATE]: 80,
  [DEPT_KPI_KEYS.SALES_CLOSE_RATE]: 60,
  [DEPT_KPI_KEYS.SALES_MEETING_TO_CONTRACT_LT]: 14,
  [DEPT_KPI_KEYS.BO_OPERATION_START_LT]: 5,
  [DEPT_KPI_KEYS.BO_COLLECTION_DELAY_RATE]: 3,
  [DEPT_KPI_KEYS.BO_MEETING_TO_CONTRACT_LT]: 14,
};

/** KPIの方向性（低い方が良い指標） */
export const DEPT_KPI_INVERTED: Partial<Record<DeptKpiKey, boolean>> = {
  [DEPT_KPI_KEYS.SALES_MEETING_TO_CONTRACT_LT]: true,
  [DEPT_KPI_KEYS.BO_OPERATION_START_LT]: true,
  [DEPT_KPI_KEYS.BO_COLLECTION_DELAY_RATE]: true,
  [DEPT_KPI_KEYS.BO_MEETING_TO_CONTRACT_LT]: true,
};

/** 部門グルーピング定義 */
export const DEPT_KPI_GROUPS = {
  alliance: {
    tabKey: "alliance",
    departmentName: "Alliance",
    managerName: "宮原",
    kpiKeys: [
      DEPT_KPI_KEYS.ALLIANCE_VALID_LEADS,
      DEPT_KPI_KEYS.ALLIANCE_MEETINGS,
      DEPT_KPI_KEYS.ALLIANCE_SQL_RATE,
    ] as DeptKpiKey[],
    observationKeys: [
      "alliance_agent_count",
      "alliance_channel_cac",
      "alliance_partner_sql_rate",
    ] as const,
  },
  sales: {
    tabKey: "sales",
    departmentName: "Sales",
    managerName: "青山",
    kpiKeys: [
      DEPT_KPI_KEYS.SALES_CLOSE_RATE,
      DEPT_KPI_KEYS.SALES_NEW_CONTRACTS,
      DEPT_KPI_KEYS.SALES_MEETING_TO_CONTRACT_LT,
    ] as DeptKpiKey[],
    observationKeys: [] as const,
  },
  backoffice: {
    tabKey: "backoffice",
    departmentName: "バックオフィス",
    managerName: "吉川",
    kpiKeys: [
      DEPT_KPI_KEYS.BO_OPERATION_START_LT,
      DEPT_KPI_KEYS.BO_COLLECTION_DELAY_RATE,
      DEPT_KPI_KEYS.BO_MEETING_TO_CONTRACT_LT,
    ] as DeptKpiKey[],
    observationKeys: [] as const,
  },
  cs: {
    tabKey: "cs",
    departmentName: "CS",
    managerName: "東田",
    kpiKeys: [] as DeptKpiKey[],
    observationKeys: [] as const,
  },
} as const;

/** 観測指標のラベル定義 */
export const OBSERVATION_LABELS: Record<string, { name: string; unit: string; description: string }> = {
  alliance_agent_count: { name: "代理店社数", unit: "社", description: "アクティブな代理店数" },
  alliance_channel_cac: { name: "チャネル別CAC", unit: "円", description: "代理店への支払額÷代理店経由契約数" },
  alliance_partner_sql_rate: { name: "パートナー経由SQL化率", unit: "%", description: "代理店経由の商談化率" },
};

export const DEFAULT_FIXED_COST = 1_080_000; // 108万円
