/**
 * クライアント側で使うフォーマットID列挙とラベル定義のみを切り出したモジュール。
 * 実パーサ実装をブラウザバンドルに含めないために formats.ts と分離している。
 */

export type BankStatementFormatId =
  | "manual_standard"
  | "sumishin_sbi"
  | "gmo_aozora"
  | "rakuten"
  | "zengin_mitsui";

export const BANK_STATEMENT_FORMAT_OPTIONS: {
  id: BankStatementFormatId;
  label: string;
}[] = [
  { id: "manual_standard", label: "標準CSV（手動作成用）" },
  { id: "sumishin_sbi", label: "住信SBIネット銀行" },
  { id: "gmo_aozora", label: "GMOあおぞらネット銀行" },
  { id: "rakuten", label: "楽天銀行" },
  { id: "zengin_mitsui", label: "三井住友銀行（全銀フォーマット）" },
];
