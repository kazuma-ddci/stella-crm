export const ASSIGNABLE_FIELDS = {
  STP_COMPANY_SALES: { label: "STP企業 担当営業" },
  STP_COMPANY_ADMIN: { label: "STP企業 担当事務" },
  MASTER_COMPANY_STAFF: { label: "全顧客マスタ 担当者" },
  CONTRACT_HISTORY_SALES: { label: "契約履歴 担当営業" },
  CONTRACT_HISTORY_OPERATION: { label: "契約履歴 担当運用" },
  STP_AGENT_STAFF: { label: "代理店 担当営業" },
  STP_AGENT_ADMIN: { label: "代理店 担当事務" },
  PROPOSAL_STAFF: { label: "提案書 担当者" },
} as const;

export type AssignableFieldCode = keyof typeof ASSIGNABLE_FIELDS;
