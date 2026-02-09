// 企業統合（マージ）関連の型定義

/** 企業の関連データ件数 */
export type CompanyRelatedData = {
  locations: number;
  contacts: number;
  bankAccounts: number;
  stpCompanies: number;
  stpAgents: number;
  contractHistories: number;
  contactHistories: number;
  contracts: number;
  externalUsers: number;
  registrationTokens: number;
  referredAgents: number;
  leadFormSubmissions: number;
};

/** StpCompanyの衝突情報 */
export type StpCompanyConflict = {
  survivorStpCompanyId: number;
  duplicateStpCompanyId: number;
  survivorStageName: string | null;
  duplicateStageName: string | null;
};

/** StpAgentの衝突情報 */
export type StpAgentConflict = {
  survivorAgentId: number;
  duplicateAgentId: number;
  survivorCategory: string;
  duplicateCategory: string;
};

/** 基本情報フィールドの差分 */
export type FieldDiff = {
  field: string;
  label: string;
  survivorValue: string | null;
  duplicateValue: string | null;
};

/** マージプレビュー */
export type MergePreview = {
  survivor: {
    id: number;
    companyCode: string;
    name: string;
    relatedData: CompanyRelatedData;
  };
  duplicate: {
    id: number;
    companyCode: string;
    name: string;
    relatedData: CompanyRelatedData;
  };
  stpCompanyConflicts: StpCompanyConflict[];
  stpAgentConflicts: StpAgentConflict[];
  fieldDiffs: FieldDiff[];
};

/** ユーザーのマージ解決選択 */
export type MergeResolution = {
  /** StpCompany衝突の解決: keep_a=統合先を残す, keep_b=統合元を残す, keep_both=両方残す */
  stpCompanyResolution?: "keep_a" | "keep_b" | "keep_both";
  /** StpAgent衝突の解決: keep_a=統合先を残す, keep_b=統合元を残す, keep_both=両方残す */
  stpAgentResolution?: "keep_a" | "keep_b" | "keep_both";
};

/** マージ実行結果 */
export type MergeResult = {
  success: boolean;
  error?: string;
  movedRecords?: {
    locations: number;
    contacts: number;
    bankAccounts: number;
    contractHistories: number;
    contactHistories: number;
    contracts: number;
    externalUsers: number;
    registrationTokens: number;
    referredAgents: number;
    leadFormSubmissions: number;
  };
  warnings?: string[];
};
