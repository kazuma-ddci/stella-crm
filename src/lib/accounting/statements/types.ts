/**
 * Bank statement (入出金履歴) CSV import types.
 *
 * 既存の src/lib/csv/parser.ts は汎用カラムマッピング型のジェネリックパーサ。
 * 楽天の符号付き単一金額列、全銀フォーマットの多レコード型などを表現できないため、
 * フォーマットごとにパース関数を持つ別系統として用意する。
 */

export type BankStatementFormatId =
  | "manual_standard"
  | "sumishin_sbi"
  | "gmo_aozora"
  | "rakuten"
  | "zengin_mitsui";

/**
 * 1取引行のパース結果。法人・銀行口座は呼び出し側で付与する。
 */
export type ParsedStatementEntry = {
  transactionDate: string; // ISO YYYY-MM-DD
  description: string;
  incomingAmount: number | null; // 入金（円）
  outgoingAmount: number | null; // 出金（円）
  balance: number | null; // 残高（円）
  csvMemo: string | null;
  rowOrder: number; // CSV内の出現順 0-based
};

export type ParseStatementResult = {
  entries: ParsedStatementEntry[];
  /** 全銀フォーマットの「取引前残高」など、Import に保存しておきたい補助情報 */
  openingBalance: number | null;
  /** スキップ・無効行などの統計情報 */
  totalLines: number;
  skippedLines: number;
  /** 行単位エラー（行番号は 1-based） */
  errors: { line: number; message: string }[];
};

export type BankStatementFormat = {
  id: BankStatementFormatId;
  label: string; // UI 表示名
  /** デコード済みテキスト（UTF-8）を受け取り、行配列に変換した結果を返す */
  parse: (csvText: string) => ParseStatementResult;
};
