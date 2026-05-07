/**
 * 入出金履歴 CSV フォーマットレジストリ。
 *
 * UI のドロップダウンとサーバ側のパース呼び出しの両方で利用する。
 */

import type { BankStatementFormat, BankStatementFormatId } from "./types";
import { parseManualStandardCsv } from "./parsers/manual-standard";
import { parseSumishinSbiCsv } from "./parsers/sumishin-sbi";
import { parseGmoAozoraCsv } from "./parsers/gmo-aozora";
import { parseRakutenCsv } from "./parsers/rakuten";
import { parseZenginMitsuiCsv } from "./parsers/zengin-mitsui";

export const BANK_STATEMENT_FORMATS: Record<
  BankStatementFormatId,
  BankStatementFormat
> = {
  manual_standard: {
    id: "manual_standard",
    label: "標準CSV（手動作成用）",
    parse: parseManualStandardCsv,
  },
  sumishin_sbi: {
    id: "sumishin_sbi",
    label: "住信SBIネット銀行",
    parse: parseSumishinSbiCsv,
  },
  gmo_aozora: {
    id: "gmo_aozora",
    label: "GMOあおぞらネット銀行",
    parse: parseGmoAozoraCsv,
  },
  rakuten: {
    id: "rakuten",
    label: "楽天銀行",
    parse: parseRakutenCsv,
  },
  zengin_mitsui: {
    id: "zengin_mitsui",
    label: "三井住友銀行（全銀フォーマット）",
    parse: parseZenginMitsuiCsv,
  },
};

export const BANK_STATEMENT_FORMAT_OPTIONS: {
  id: BankStatementFormatId;
  label: string;
}[] = (
  Object.keys(BANK_STATEMENT_FORMATS) as BankStatementFormatId[]
).map((id) => ({
  id,
  label: BANK_STATEMENT_FORMATS[id].label,
}));

export function isBankStatementFormatId(
  v: string
): v is BankStatementFormatId {
  return v in BANK_STATEMENT_FORMATS;
}
