/**
 * SPEC-STP-001: 顧問の区分表示形式
 *
 * @see docs/specs/SPEC-STP-001.md
 *
 * このテストは確定仕様のガードテストです。
 * 仕様を変更する場合は、必ずユーザー承認を得てください。
 */

import { describe, it, expect } from "vitest";
import {
  formatAdvisorDisplay,
  formatCurrency,
} from "@/lib/format/advisor-display";

describe("SPEC-STP-001: 顧問の区分表示形式", () => {
  describe("formatAdvisorDisplay", () => {
    it("両方入力済み: 顧問（10件 / ¥100,000）", () => {
      const result = formatAdvisorDisplay(10, 100000);
      expect(result).toBe("顧問（10件 / ¥100,000）");
    });

    it("件数のみ入力: 顧問（10件 / -）", () => {
      const result = formatAdvisorDisplay(10, null);
      expect(result).toBe("顧問（10件 / -）");
    });

    it("金額のみ入力: 顧問（- / ¥100,000）", () => {
      const result = formatAdvisorDisplay(null, 100000);
      expect(result).toBe("顧問（- / ¥100,000）");
    });

    it("両方未入力: 顧問（- / -）", () => {
      const result = formatAdvisorDisplay(null, null);
      expect(result).toBe("顧問（- / -）");
    });

    it("undefinedも未入力として扱う", () => {
      expect(formatAdvisorDisplay(undefined, undefined)).toBe("顧問（- / -）");
      expect(formatAdvisorDisplay(10, undefined)).toBe("顧問（10件 / -）");
      expect(formatAdvisorDisplay(undefined, 100000)).toBe("顧問（- / ¥100,000）");
    });
  });

  describe("フォーマット詳細の検証", () => {
    it("括弧は全角を使用", () => {
      const result = formatAdvisorDisplay(10, 100000);
      expect(result).toContain("（");
      expect(result).toContain("）");
      expect(result).not.toContain("(");
      expect(result).not.toContain(")");
    });

    it("区切りは ` / ` を使用", () => {
      const result = formatAdvisorDisplay(10, 100000);
      expect(result).toContain(" / ");
      // スペース区切りではないことを確認
      expect(result).not.toMatch(/\d件 \d/);
    });

    it("金額はカンマ区切りで円マーク付き", () => {
      const result = formatAdvisorDisplay(null, 1000000);
      expect(result).toContain("¥1,000,000");
    });

    it("件数には「件」が付く", () => {
      const result = formatAdvisorDisplay(5, null);
      expect(result).toContain("5件");
    });
  });

  describe("禁止事項の検証", () => {
    it("❌ 未入力時に括弧を省略してはいけない", () => {
      const result = formatAdvisorDisplay(null, null);
      // 「顧問」だけで終わっていないこと
      expect(result).not.toBe("顧問");
      // 括弧が含まれていること
      expect(result).toContain("（");
      expect(result).toContain("）");
    });

    it("❌ 片方のみ入力時に - を省略してはいけない", () => {
      const casesOnly = formatAdvisorDisplay(10, null);
      expect(casesOnly).toContain("-");

      const feeOnly = formatAdvisorDisplay(null, 100000);
      expect(feeOnly).toContain("-");
    });
  });

  describe("formatCurrency", () => {
    it("金額を円マーク付きカンマ区切りでフォーマット", () => {
      expect(formatCurrency(100000)).toBe("¥100,000");
      expect(formatCurrency(1000)).toBe("¥1,000");
      expect(formatCurrency(100)).toBe("¥100");
      expect(formatCurrency(0)).toBe("¥0");
    });
  });
});
