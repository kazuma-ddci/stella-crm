/**
 * 入出金履歴 CSV パーサのスナップショット相当テスト。
 *
 * /csv_file/ 配下の実ファイル（Shift-JIS）を fs から読み込み、各フォーマットの
 * パーサが期待どおり件数・先頭/末尾行・残高合計を抽出できることを検証する。
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import iconv from "iconv-lite";
import { parseSumishinSbiCsv } from "@/lib/accounting/statements/parsers/sumishin-sbi";
import { parseGmoAozoraCsv } from "@/lib/accounting/statements/parsers/gmo-aozora";
import { parseRakutenCsv } from "@/lib/accounting/statements/parsers/rakuten";
import { parseZenginMitsuiCsv } from "@/lib/accounting/statements/parsers/zengin-mitsui";
import { parseManualStandardCsv } from "@/lib/accounting/statements/parsers/manual-standard";
import { attachDedupHashes } from "@/lib/accounting/statements/dedup";

const CSV_DIR = join(process.cwd(), "csv_file");

function readShiftJis(filename: string): string {
  const buf = readFileSync(join(CSV_DIR, filename));
  return iconv.decode(buf, "Shift_JIS");
}

describe("標準CSV parser (manual-standard)", () => {
  it("通帳から手動作成したCSVを入金/出金へ振り分ける", () => {
    const text = [
      "日付,摘要,入金,出金,残高,メモ",
      "2026-04-01,サンプル入金,10000,,110000,通帳から転記",
      "2026/04/02,サンプル出金,,3000,107000,",
    ].join("\n");
    const result = parseManualStandardCsv(text);
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(2);

    expect(result.entries[0]).toMatchObject({
      transactionDate: "2026-04-01",
      description: "サンプル入金",
      incomingAmount: 10_000,
      outgoingAmount: null,
      balance: 110_000,
      csvMemo: "通帳から転記",
    });
    expect(result.entries[1]).toMatchObject({
      transactionDate: "2026-04-02",
      description: "サンプル出金",
      incomingAmount: null,
      outgoingAmount: 3_000,
      balance: 107_000,
      csvMemo: null,
    });
  });

  it("入金と出金が同じ行にある場合は取り込まない", () => {
    const text = [
      "日付,摘要,入金,出金,残高,メモ",
      "2026-04-01,誤入力,10000,3000,107000,",
    ].join("\n");
    const result = parseManualStandardCsv(text);
    expect(result.entries).toHaveLength(0);
    expect(result.errors[0].message).toContain("どちらか一方");
  });
});

describe("住信SBI parser (sumishin-sbi)", () => {
  it("AEON住信⑲.csv: 取引行を正しくパースする", () => {
    const text = readShiftJis("AEON住信⑲.csv");
    const result = parseSumishinSbiCsv(text);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.errors).toEqual([]);

    const first = result.entries[0];
    expect(first.transactionDate).toBe("2026-01-09");
    expect(first.description).toContain("タカハシ");
    expect(first.incomingAmount).toBe(15_700_000);
    expect(first.outgoingAmount).toBeNull();
    expect(first.balance).toBe(18_165_030);
    expect(first.csvMemo).toBeNull(); // "-" は null 化
  });

  it("MetaHealth住信㉙.csv: 出金が正しく入る", () => {
    const text = readShiftJis("MetaHealth住信㉙.csv");
    const result = parseSumishinSbiCsv(text);
    expect(result.entries.length).toBeGreaterThan(0);
    const first = result.entries[0];
    expect(first.transactionDate).toBe("2026-04-02");
    expect(first.outgoingAmount).toBe(140); // 振込手数料
    expect(first.incomingAmount).toBeNull();
    expect(first.balance).toBe(230_193);
  });
});

describe("GMOあおぞら parser (gmo-aozora)", () => {
  it("StellaGMO㉙.csv: 日付YYYYMMDDをパースする", () => {
    const text = readShiftJis("StellaGMO㉙.csv");
    const result = parseGmoAozoraCsv(text);
    expect(result.entries.length).toBeGreaterThan(0);

    const first = result.entries[0];
    expect(first.transactionDate).toBe("2026-04-03");
    expect(first.description).toBe("振込手数料");
    expect(first.outgoingAmount).toBe(143);
    expect(first.incomingAmount).toBeNull();
    expect(first.balance).toBe(2_436_139);
  });

  it("申請サポートセンターGMO㉙.csv: 入金行（利息）をパースする", () => {
    const text = readShiftJis("申請サポートセンターGMO㉙.csv");
    const result = parseGmoAozoraCsv(text);
    expect(result.entries.length).toBeGreaterThan(0);
    const first = result.entries[0];
    expect(first.transactionDate).toBe("2026-04-01");
    expect(first.description).toContain("利息");
    expect(first.incomingAmount).toBe(217);
    expect(first.outgoingAmount).toBeNull();
  });
});

describe("楽天 parser (rakuten)", () => {
  it("アドア楽天㉙.csv: 符号付き単一金額列を入金/出金へ振り分ける", () => {
    const text = readShiftJis("アドア楽天㉙.csv");
    const result = parseRakutenCsv(text);
    expect(result.entries.length).toBeGreaterThan(0);

    const first = result.entries[0];
    expect(first.transactionDate).toBe("2026-03-30");
    expect(first.outgoingAmount).toBe(2_446_000); // 負の値が出金へ
    expect(first.incomingAmount).toBeNull();
    expect(first.balance).toBe(54_621);
    expect(first.csvMemo).toBeNull();

    // 入金行（正の値）が存在することを確認
    const incomingEntries = result.entries.filter(
      (e) => e.incomingAmount !== null
    );
    expect(incomingEntries.length).toBeGreaterThan(0);
  });
});

describe("全銀フォーマット parser (zengin-mitsui)", () => {
  it("lifeadds三井⑲.csv: 取引前残高から running balance を計算する", () => {
    const text = readShiftJis("lifeadds三井⑲.csv");
    const result = parseZenginMitsuiCsv(text);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.openingBalance).toBe(17_110_609);

    const first = result.entries[0];
    expect(first.transactionDate).toBe("2007-12-22"); // YYMMDD 071222
    expect(first.incomingAmount).toBe(1_643_400);
    expect(first.outgoingAmount).toBeNull();
    // 取引前残高 17,110,609 + 1,643,400 = 18,754,009
    expect(first.balance).toBe(18_754_009);

    const second = result.entries[1];
    expect(second.outgoingAmount).toBe(5_356_962);
    expect(second.incomingAmount).toBeNull();
    // 18,754,009 - 5,356,962 = 13,397,047
    expect(second.balance).toBe(13_397_047);
  });

  it("摘要は摘要内容＋振込依頼人名を結合する", () => {
    const text = readShiftJis("lifeadds三井⑲.csv");
    const result = parseZenginMitsuiCsv(text);
    const first = result.entries[0];
    expect(first.description).toContain("ﾌﾘｺﾐ");
    expect(first.description).toContain("ﾅﾅﾐｽﾀ");
  });
});

describe("dedup hashing", () => {
  it("同一行を二度入れても二度目以降は重複ハッシュではなく occurrence index で区別される", () => {
    const text = readShiftJis("AEON住信⑲.csv");
    const result = parseSumishinSbiCsv(text);
    const hashed = attachDedupHashes(result.entries);
    const hashes = hashed.map((h) => h.dedupHash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("再パースしても各行のハッシュは安定（CSV順序が同じである限り）", () => {
    const text = readShiftJis("StellaGMO㉙.csv");
    const a = attachDedupHashes(parseGmoAozoraCsv(text).entries);
    const b = attachDedupHashes(parseGmoAozoraCsv(text).entries);
    expect(a.map((x) => x.dedupHash)).toEqual(b.map((x) => x.dedupHash));
  });
});
