// フィールドコードの型定義（DBのStaffFieldDefinitionと同期）
// 新規フィールド追加時はDBのstaff_field_definitionsにINSERTする
export type AssignableFieldCode =
  | "STP_COMPANY_SALES"
  | "STP_COMPANY_ADMIN"
  | "MASTER_COMPANY_STAFF"
  | "CONTRACT_HISTORY_SALES"
  | "CONTRACT_HISTORY_OPERATION"
  | "STP_AGENT_STAFF"
  | "STP_AGENT_ADMIN"
  | "PROPOSAL_STAFF";

// 後方互換: ハードコード定義（UIのフォールバック用）
export const ASSIGNABLE_FIELDS: Record<AssignableFieldCode, { label: string }> = {
  STP_COMPANY_SALES: { label: "STP企業 担当営業" },
  STP_COMPANY_ADMIN: { label: "STP企業 担当事務" },
  MASTER_COMPANY_STAFF: { label: "全顧客マスタ 担当者" },
  CONTRACT_HISTORY_SALES: { label: "契約履歴 担当営業" },
  CONTRACT_HISTORY_OPERATION: { label: "契約履歴 担当運用" },
  STP_AGENT_STAFF: { label: "代理店 担当営業" },
  STP_AGENT_ADMIN: { label: "代理店 担当事務" },
  PROPOSAL_STAFF: { label: "提案書 担当者" },
};
