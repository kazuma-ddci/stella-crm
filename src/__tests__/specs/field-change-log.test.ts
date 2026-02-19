/**
 * フィールド変更履歴機能のテスト
 *
 * テスト対象:
 * 1. 履歴記録 - createFieldChangeLogEntries
 * 2. メモ必須バリデーション - isValidChangeNote
 * 3. 権限制約 - validateStaffForField
 * 4. 複数選択スタッフ履歴 - isStaffSetEqual / formatStaffEntries
 * 5. トランザクションロールバック - createFieldChangeLogEntries 失敗時
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isStaffSetEqual,
  formatStaffEntries,
  isValidChangeNote,
  type FieldChange,
  type StaffEntry,
} from "@/lib/field-change-log.shared";
import { createFieldChangeLogEntries } from "@/lib/field-change-log.server";

// ─────────────────────────────────────────────
// 1. 履歴記録テスト
// ─────────────────────────────────────────────
describe("createFieldChangeLogEntries - 履歴記録", () => {
  let mockTx: { fieldChangeLog: { create: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    mockTx = {
      fieldChangeLog: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };
  });

  it("変更配列の各エントリでfieldChangeLog.createが呼ばれる", async () => {
    const changes: FieldChange[] = [
      {
        fieldName: "salesStaffId",
        displayName: "担当営業",
        oldValue: "山田太郎",
        newValue: "鈴木花子",
        note: "異動のため",
      },
      {
        fieldName: "adminStaffId",
        displayName: "担当事務",
        oldValue: null,
        newValue: "田中次郎",
        note: "新規配属",
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await createFieldChangeLogEntries(mockTx as any, "stp_company", 42, changes);

    expect(mockTx.fieldChangeLog.create).toHaveBeenCalledTimes(2);
    expect(mockTx.fieldChangeLog.create).toHaveBeenCalledWith({
      data: {
        entityType: "stp_company",
        entityId: 42,
        fieldName: "salesStaffId",
        displayName: "担当営業",
        oldValue: "山田太郎",
        newValue: "鈴木花子",
        note: "異動のため",
      },
    });
    expect(mockTx.fieldChangeLog.create).toHaveBeenCalledWith({
      data: {
        entityType: "stp_company",
        entityId: 42,
        fieldName: "adminStaffId",
        displayName: "担当事務",
        oldValue: null,
        newValue: "田中次郎",
        note: "新規配属",
      },
    });
  });

  it("空配列では何も作成しない", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createFieldChangeLogEntries(mockTx as any, "stp_agent", 1, []);
    expect(mockTx.fieldChangeLog.create).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("entityTypeとentityIdが正しく各レコードに渡される", async () => {
    const changes: FieldChange[] = [
      { fieldName: "f1", displayName: "D1", oldValue: "a", newValue: "b", note: "reason" },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await createFieldChangeLogEntries(mockTx as any, "stp_contract_history", 99, changes);

    expect(mockTx.fieldChangeLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "stp_contract_history",
          entityId: 99,
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// 2. メモ必須バリデーション
// ─────────────────────────────────────────────
describe("isValidChangeNote - メモ必須バリデーション", () => {
  it("通常の文字列はvalid", () => {
    expect(isValidChangeNote("異動のため")).toBe(true);
  });

  it("null/undefinedはinvalid", () => {
    expect(isValidChangeNote(null)).toBe(false);
    expect(isValidChangeNote(undefined)).toBe(false);
  });

  it("空文字はinvalid", () => {
    expect(isValidChangeNote("")).toBe(false);
  });

  it("スペースのみはinvalid（トリム後判定）", () => {
    expect(isValidChangeNote("   ")).toBe(false);
    expect(isValidChangeNote("　")).toBe(false); // 全角スペース
    expect(isValidChangeNote(" \t\n ")).toBe(false);
  });

  it("前後にスペースがある文字列はvalid", () => {
    expect(isValidChangeNote("  理由あり  ")).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 3. 権限制約テスト（validateStaffForField）
// ─────────────────────────────────────────────
// validateStaffForFieldはPrismaに依存するため、モジュールモックでテスト
vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffFieldRestriction: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    masterStaff: {
      findMany: vi.fn().mockResolvedValue([
        { id: 1, name: "許可スタッフA" },
        { id: 2, name: "許可スタッフB" },
      ]),
    },
  },
}));

describe("validateStaffForField - 権限制約", () => {
  it("許可リストに含まれるIDはtrueを返す", async () => {
    const { validateStaffForField } = await import("@/lib/staff/get-staff-by-field");
    const result = await validateStaffForField("STP_COMPANY_SALES", 1);
    expect(result).toBe(true);
  });

  it("許可リストに含まれないIDはfalseを返す", async () => {
    const { validateStaffForField } = await import("@/lib/staff/get-staff-by-field");
    const result = await validateStaffForField("STP_COMPANY_SALES", 999);
    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 4. 複数選択スタッフ履歴
// ─────────────────────────────────────────────
describe("isStaffSetEqual - 集合比較（順序無関係）", () => {
  it("同じメンバー・同じ順序はtrue", () => {
    const old: StaffEntry[] = [{ id: 1, name: "山田" }, { id: 2, name: "鈴木" }];
    const newer: StaffEntry[] = [{ id: 1, name: "山田" }, { id: 2, name: "鈴木" }];
    expect(isStaffSetEqual(old, newer)).toBe(true);
  });

  it("同じメンバー・異なる順序はtrue（順序違いは差分にしない）", () => {
    const old: StaffEntry[] = [{ id: 1, name: "山田" }, { id: 2, name: "鈴木" }];
    const newer: StaffEntry[] = [{ id: 2, name: "鈴木" }, { id: 1, name: "山田" }];
    expect(isStaffSetEqual(old, newer)).toBe(true);
  });

  it("メンバーが異なる場合はfalse", () => {
    const old: StaffEntry[] = [{ id: 1, name: "山田" }, { id: 2, name: "鈴木" }];
    const newer: StaffEntry[] = [{ id: 1, name: "山田" }, { id: 3, name: "田中" }];
    expect(isStaffSetEqual(old, newer)).toBe(false);
  });

  it("メンバー数が異なる場合はfalse", () => {
    const old: StaffEntry[] = [{ id: 1, name: "山田" }];
    const newer: StaffEntry[] = [{ id: 1, name: "山田" }, { id: 2, name: "鈴木" }];
    expect(isStaffSetEqual(old, newer)).toBe(false);
  });

  it("両方空はtrue", () => {
    expect(isStaffSetEqual([], [])).toBe(true);
  });

  it("片方だけ空はfalse", () => {
    expect(isStaffSetEqual([], [{ id: 1, name: "山田" }])).toBe(false);
    expect(isStaffSetEqual([{ id: 1, name: "山田" }], [])).toBe(false);
  });
});

describe("formatStaffEntries - ID付きフォーマット", () => {
  it("IDソート順で「名前(ID:xx)」形式の文字列を返す", () => {
    const entries: StaffEntry[] = [{ id: 3, name: "田中" }, { id: 1, name: "山田" }];
    expect(formatStaffEntries(entries)).toBe("山田(ID:1), 田中(ID:3)");
  });

  it("単一エントリ", () => {
    expect(formatStaffEntries([{ id: 5, name: "佐藤" }])).toBe("佐藤(ID:5)");
  });

  it("空配列はnullを返す", () => {
    expect(formatStaffEntries([])).toBeNull();
  });

  it("内部IDがoldValue/newValueに保持される（トレーサビリティ）", () => {
    const entries: StaffEntry[] = [{ id: 10, name: "山田" }, { id: 20, name: "鈴木" }];
    const result = formatStaffEntries(entries);
    expect(result).toContain("ID:10");
    expect(result).toContain("ID:20");
    expect(result).toContain("山田");
    expect(result).toContain("鈴木");
  });

  it("元の配列を変更しない（immutable）", () => {
    const entries: StaffEntry[] = [{ id: 3, name: "C" }, { id: 1, name: "A" }];
    formatStaffEntries(entries);
    expect(entries[0].id).toBe(3); // 元の順序が保持されている
  });
});

// ─────────────────────────────────────────────
// 5. トランザクションロールバックテスト
// ─────────────────────────────────────────────
describe("createFieldChangeLogEntries - トランザクションロールバック", () => {
  it("1件目成功・2件目失敗で全体がrejectされる", async () => {
    const mockTx = {
      fieldChangeLog: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 1 }) // 1件目成功
          .mockRejectedValueOnce(new Error("DB constraint violation")), // 2件目失敗
      },
    };

    const changes: FieldChange[] = [
      { fieldName: "f1", displayName: "D1", oldValue: "a", newValue: "b", note: "r1" },
      { fieldName: "f2", displayName: "D2", oldValue: "c", newValue: "d", note: "r2" },
    ];

    // Promise.allでラップしているため、1件でも失敗すると全体がreject
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createFieldChangeLogEntries(mockTx as any, "stp_company", 1, changes),
    ).rejects.toThrow("DB constraint violation");
  });

  it("全レコード失敗でもPromise.allが正しくrejectを伝播する（トランザクション内で例外→ロールバック）", async () => {
    // prisma.$transaction(async (tx) => { ... }) 内で
    // createFieldChangeLogEntriesがrejectすると例外がthrowされ
    // Prismaがトランザクション全体をロールバックする
    const mockTx = {
      fieldChangeLog: {
        create: vi.fn().mockRejectedValue(new Error("DB write failed")),
      },
    };
    const changes: FieldChange[] = [
      { fieldName: "f", displayName: "D", oldValue: "a", newValue: "b", note: "n" },
    ];

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createFieldChangeLogEntries(mockTx as any, "test", 1, changes),
    ).rejects.toThrow("DB write failed");
  });

  it("$transaction内で履歴保存が失敗すると本体更新もロールバックされる（actions.tsパターン再現）", async () => {
    // actions.ts の updateStpCompany / updateAgent のパターンを再現:
    // prisma.$transaction(async (tx) => {
    //   await createFieldChangeLogEntries(tx, ...);  // ← ここで失敗
    //   await tx.stpCompany.update(...);              // ← ここまで到達しない
    // });
    // → $transaction全体がロールバック

    const updateSpy = vi.fn().mockResolvedValue({ id: 1 });
    const mockTx = {
      fieldChangeLog: {
        create: vi.fn().mockRejectedValue(new Error("FieldChangeLog write error")),
      },
      stpCompany: {
        update: updateSpy,
      },
    };

    // $transactionをシミュレート: コールバック内で例外が発生したらreject
    const mockTransaction = async (callback: (tx: typeof mockTx) => Promise<void>) => {
      await callback(mockTx);
    };

    const changes: FieldChange[] = [
      { fieldName: "salesStaffId", displayName: "担当営業", oldValue: "A", newValue: "B", note: "理由" },
    ];

    // actions.tsと同じパターンで実行
    await expect(
      mockTransaction(async (tx) => {
        // 1. 変更履歴の保存（ここで失敗）
        await createFieldChangeLogEntries(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tx as any, "stp_company", 42, changes,
        );
        // 2. 本体の更新（ここまで到達しないはず）
        await tx.stpCompany.update({
          where: { id: 42 },
          data: { salesStaffId: 2 },
        });
      }),
    ).rejects.toThrow("FieldChangeLog write error");

    // 本体の update は呼ばれていない = ロールバック相当
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
