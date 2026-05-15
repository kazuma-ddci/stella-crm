import { describe, expect, it } from "vitest";
import {
  buildPlReportJournalEntryWhere,
  getPlPeriodRange,
  normalizePlReportMode,
} from "@/lib/accounting/pl-report";

describe("社内P/L未適用フラグ", () => {
  const startDate = new Date(2026, 0, 1);
  const endDate = new Date(2026, 1, 1);

  it("決算提出用P/Lは請求/支払グループの除外フラグに影響されない", () => {
    const where = buildPlReportJournalEntryWhere({
      startDate,
      endDate,
      mode: "statutory",
    });

    expect(where).toEqual({
      deletedAt: null,
      journalDate: { gte: startDate, lt: endDate },
    });
  });

  it("社内用P/Lは社内P/L未適用の請求/支払グループを除外する", () => {
    const where = buildPlReportJournalEntryWhere({
      startDate,
      endDate,
      mode: "internal",
    });

    expect(where).toEqual({
      deletedAt: null,
      journalDate: { gte: startDate, lt: endDate },
      AND: [
        {
          OR: [
            { invoiceGroupId: null },
            { invoiceGroup: { excludeFromInternalPl: false } },
          ],
        },
        {
          OR: [
            { transactionId: null },
            { transaction: { invoiceGroupId: null } },
            { transaction: { invoiceGroup: { excludeFromInternalPl: false } } },
          ],
        },
        {
          OR: [
            { paymentGroupId: null },
            { paymentGroup: { excludeFromInternalPl: false } },
          ],
        },
        {
          OR: [
            { transactionId: null },
            { transaction: { paymentGroupId: null } },
            { transaction: { paymentGroup: { excludeFromInternalPl: false } } },
          ],
        },
      ],
    });
  });

  it("法人指定時は取引やプロジェクト経由の法人紐付けもP/L対象に含める", () => {
    const where = buildPlReportJournalEntryWhere({
      startDate,
      endDate,
      mode: "statutory",
      operatingCompanyId: 1,
    });

    expect(where).toEqual({
      deletedAt: null,
      journalDate: { gte: startDate, lt: endDate },
      OR: [
        { operatingCompanyId: 1 },
        { invoiceGroup: { operatingCompanyId: 1 } },
        { paymentGroup: { operatingCompanyId: 1 } },
        { project: { operatingCompanyId: 1 } },
        { transaction: { invoiceGroup: { operatingCompanyId: 1 } } },
        { transaction: { paymentGroup: { operatingCompanyId: 1 } } },
        { transaction: { project: { operatingCompanyId: 1 } } },
      ],
    });
  });

  it("プロジェクト指定時は仕訳・グループ・取引・配賦結果のプロジェクト紐付けを対象に含める", () => {
    const where = buildPlReportJournalEntryWhere({
      startDate,
      endDate,
      mode: "statutory",
      projectId: 10,
    });

    expect(where).toEqual({
      deletedAt: null,
      journalDate: { gte: startDate, lt: endDate },
      AND: [
        {
          OR: [
            { projectId: 10 },
            { invoiceGroup: { projectId: 10 } },
            { paymentGroup: { projectId: 10 } },
            { transaction: { projectId: 10 } },
            { transaction: { costCenter: { projectId: 10 } } },
            { lines: { some: { plAllocations: { some: { projectId: 10 } } } } },
            {
              lines: {
                some: {
                  plAllocations: {
                    some: { costCenter: { projectId: 10 } },
                  },
                },
              },
            },
          ],
        },
      ],
    });
  });

  it("不明なP/L種別は決算提出用として扱う", () => {
    expect(normalizePlReportMode("internal")).toBe("internal");
    expect(normalizePlReportMode("statutory")).toBe("statutory");
    expect(normalizePlReportMode("unknown")).toBe("statutory");
    expect(normalizePlReportMode(undefined)).toBe("statutory");
  });

  it("3月決算の年度P/Lは4月1日から翌年4月1日未満を対象にする", () => {
    const period = getPlPeriodRange({
      periodType: "fiscalYear",
      year: 2026,
      month: 5,
      fiscalClosingMonth: 3,
    });

    expect(period).toEqual({
      startDate: new Date(2026, 3, 1),
      endDate: new Date(2027, 3, 1),
      label: "2026年度",
    });
  });
});
