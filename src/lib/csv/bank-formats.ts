/**
 * Bank CSV format definitions for Japanese bank transaction imports.
 */

export type BankCsvFormat = {
  id: string;
  bankName: string;
  encoding: "utf-8" | "shift-jis";
  headerRows: number; // rows to skip before data
  columns: {
    date: number; // column index (0-based)
    description: number;
    incoming: number; // deposit column
    outgoing: number; // withdrawal column
    balance: number; // balance column
    memo?: number; // memo column
  };
  dateFormat: string; // "YYYY/MM/DD" | "YYYY-MM-DD" | "YYYY年MM月DD日"
};

/**
 * Preset formats for common Japanese banks.
 */
export const BANK_FORMATS: Record<string, BankCsvFormat> = {
  generic: {
    id: "generic",
    bankName: "汎用フォーマット",
    encoding: "utf-8",
    headerRows: 1,
    columns: {
      date: 0,
      description: 1,
      incoming: 2,
      outgoing: 3,
      balance: 4,
      memo: 5,
    },
    dateFormat: "YYYY/MM/DD",
  },
  mufg: {
    id: "mufg",
    bankName: "三菱UFJ銀行",
    encoding: "shift-jis",
    headerRows: 1,
    columns: {
      date: 0,
      description: 1,
      incoming: 3,
      outgoing: 2,
      balance: 4,
    },
    dateFormat: "YYYY/MM/DD",
  },
  smbc: {
    id: "smbc",
    bankName: "三井住友銀行",
    encoding: "shift-jis",
    headerRows: 1,
    columns: {
      date: 0,
      description: 1,
      incoming: 3,
      outgoing: 2,
      balance: 4,
    },
    dateFormat: "YYYY/MM/DD",
  },
  mizuho: {
    id: "mizuho",
    bankName: "みずほ銀行",
    encoding: "shift-jis",
    headerRows: 1,
    columns: {
      date: 0,
      description: 2,
      incoming: 3,
      outgoing: 4,
      balance: 5,
    },
    dateFormat: "YYYY/MM/DD",
  },
  rakuten: {
    id: "rakuten",
    bankName: "楽天銀行",
    encoding: "shift-jis",
    headerRows: 1,
    columns: {
      date: 0,
      description: 1,
      incoming: 2,
      outgoing: 3,
      balance: 4,
    },
    dateFormat: "YYYY/MM/DD",
  },
  moneyforward: {
    id: "moneyforward",
    bankName: "マネーフォワード（エクスポート）",
    encoding: "utf-8",
    headerRows: 1,
    columns: {
      date: 1,
      description: 3,
      incoming: 4,
      outgoing: 4,
      balance: 5,
      memo: 6,
    },
    dateFormat: "YYYY/MM/DD",
  },
};

/**
 * Create a custom bank CSV format.
 */
export function createCustomFormat(
  params: Omit<BankCsvFormat, "id"> & { id?: string }
): BankCsvFormat {
  return {
    id: params.id ?? "custom",
    ...params,
  };
}

/**
 * Get all available format options for UI display.
 */
export function getFormatOptions(): { id: string; label: string }[] {
  return Object.values(BANK_FORMATS).map((f) => ({
    id: f.id,
    label: f.bankName,
  }));
}
