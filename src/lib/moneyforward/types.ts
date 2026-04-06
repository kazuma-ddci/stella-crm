// ============================================
// MoneyForward API 型定義
// ============================================

/** MF API の取引データ */
export type MFTransaction = {
  id: number;
  date: string; // "YYYY-MM-DD"
  amount: number; // positive or negative
  content: string; // 内容
  memo: string | null;
  large_category_name: string | null;
  middle_category_name: string | null;
  account: {
    id: number;
    name: string; // 口座名
    service_name: string; // 金融機関名
  };
};

/** GET /transactions レスポンス */
export type MFTransactionListResponse = {
  transactions: MFTransaction[];
  total_count: number;
  offset: number;
  limit: number;
};

/** MF API の口座データ */
export type MFAccount = {
  id: number;
  name: string;
  service_name: string;
  sub_type: string;
  status: string;
};

/** GET /accounts レスポンス */
export type MFAccountListResponse = {
  accounts: MFAccount[];
};

/** OAuth トークンレスポンス */
export type MFTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

/** 同期結果 */
export type SyncResult = {
  newCount: number;
  duplicateCount: number;
  totalCount: number;
  batchId: number;
};
