"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordChangeLog } from "@/app/finance/changelog/actions";
import {
  generateOtherCounterpartyDisplayId,
  createCounterpartyForCompany,
  updateCounterpartyForCompany,
  syncCounterpartiesForCostCenters,
} from "@/lib/counterparty-sync";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

const VALID_TYPES = ["customer", "vendor", "service", "project", "other"] as const;

type StellaCompanyForAccounting = Awaited<
  ReturnType<typeof fetchStellaCompaniesForAccounting>
>[number];

function parseCompanyCode(code: string | null | undefined) {
  const match = code?.match(/^SC-(\d+)$/);
  if (!match) {
    return { hasCode: false, number: Number.MAX_SAFE_INTEGER };
  }
  return { hasCode: true, number: Number(match[1]) };
}

function compareStellaCompanies(
  a: StellaCompanyForAccounting,
  b: StellaCompanyForAccounting
) {
  const codeA = parseCompanyCode(a.companyCode);
  const codeB = parseCompanyCode(b.companyCode);

  if (codeA.hasCode !== codeB.hasCode) {
    return codeA.hasCode ? -1 : 1;
  }
  if (codeA.number !== codeB.number) {
    return codeA.number - codeB.number;
  }
  return a.id - b.id;
}

// 正規化比較用（設計書5.7: 全角/半角、カタカナ/ひらがな等の正規化後マッチング）
function normalizeCounterpartyName(name: string): string {
  let normalized = name;
  // スペース除去（全角・半角）
  normalized = normalized.replace(/[\s\u3000]+/g, "");
  // 全角英数字を半角に変換
  normalized = normalized.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
  // カタカナをひらがなに変換（ァ-ヶ → ぁ-ゖ）
  normalized = normalized.replace(/[\u30A1-\u30F6]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0x60)
  );
  // 小文字化
  normalized = normalized.toLowerCase();
  return normalized;
}

// 類似名称チェック（部分一致・正規化比較 — 設計書5.7）
export async function checkSimilarCounterparties(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const normalizedInput = normalizeCounterpartyName(trimmed);

  // 全取引先を取得して正規化比較（DBレベルの正規化が難しいため）
  // TODO: 取引先が数千件を超えた場合はnormalized_nameカラム追加でDB側検索に移行
  const allCounterparties = await prisma.counterparty.findMany({
    where: {
      deletedAt: null,
      mergedIntoId: null,
    },
    select: {
      id: true,
      name: true,
      counterpartyType: true,
      isActive: true,
      company: { select: { id: true, name: true } },
    },
    take: 5000,
  });

  const candidates = allCounterparties.filter((cp) => {
    const normalizedExisting = normalizeCounterpartyName(cp.name);
    return (
      normalizedExisting.includes(normalizedInput) ||
      normalizedInput.includes(normalizedExisting)
    );
  });

  return candidates.slice(0, 10);
}

// 新規作成
export async function createCounterparty(
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await requireStaffForAccounting("edit");
    const staffId = session.id;

    const name = (data.name as string).trim();
    const counterpartyType = data.counterpartyType as string;
    const memo = data.memo ? (data.memo as string).trim() : null;
    const isActive = data.isActive !== false && data.isActive !== "false";

    if (!name || !counterpartyType) {
      return err("名称と種別は必須です");
    }

    if (!(VALID_TYPES as readonly string[]).includes(counterpartyType)) {
      return err("無効な種別です");
    }

    // 名称重複チェック（論理削除・統合済みを除く）
    const existing = await prisma.counterparty.findFirst({
      where: { name, deletedAt: null, mergedIntoId: null },
      select: { id: true },
    });
    if (existing) {
      return err(`取引先「${name}」は既に登録されています`);
    }

    // TP-X displayId 自動採番
    const displayId = await generateOtherCounterpartyDisplayId();

    const isInvoiceRegistered = toBoolean(data.isInvoiceRegistered);
    const invoiceRegistrationNumber = data.invoiceRegistrationNumber
      ? (data.invoiceRegistrationNumber as string).trim() || null
      : null;

    await prisma.counterparty.create({
      data: {
        displayId,
        name,
        counterpartyType,
        memo: memo || null,
        isActive,
        isInvoiceRegistered,
        invoiceRegistrationNumber,
        createdBy: staffId,
      },
    });

    revalidatePath("/accounting/masters/counterparties");
    return ok();
  } catch (e) {
    console.error("[createCounterparty] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// 更新（部分更新対応）
export async function updateCounterparty(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await requireStaffForAccounting("edit");
    const staffId = session.id;

    const updateData: Record<string, unknown> = {};

    if ("name" in data) {
      const name = (data.name as string).trim();
      if (!name) return err("名称は必須です");

      // 名称重複チェック（自分自身は除く）
      const existing = await prisma.counterparty.findFirst({
        where: { name, deletedAt: null, mergedIntoId: null, id: { not: id } },
        select: { id: true },
      });
      if (existing) {
        return err(`取引先「${name}」は既に登録されています`);
      }
      updateData.name = name;
    }

    if ("counterpartyType" in data) {
      const counterpartyType = data.counterpartyType as string;
      if (!(VALID_TYPES as readonly string[]).includes(counterpartyType)) {
        return err("無効な種別です");
      }
      updateData.counterpartyType = counterpartyType;
    }

    if ("memo" in data) {
      updateData.memo = data.memo ? (data.memo as string).trim() || null : null;
    }

    if ("isActive" in data) {
      updateData.isActive = toBoolean(data.isActive);
    }

    if ("isInvoiceRegistered" in data) {
      updateData.isInvoiceRegistered = toBoolean(data.isInvoiceRegistered);
    }

    if ("invoiceRegistrationNumber" in data) {
      updateData.invoiceRegistrationNumber = data.invoiceRegistrationNumber
        ? (data.invoiceRegistrationNumber as string).trim() || null
        : null;
    }

    if ("invoiceEffectiveDate" in data) {
      updateData.invoiceEffectiveDate = data.invoiceEffectiveDate
        ? new Date(data.invoiceEffectiveDate as string)
        : null;
    }

    updateData.updatedBy = staffId;

    await prisma.counterparty.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/accounting/masters/counterparties");
    return ok();
  } catch (e) {
    console.error("[updateCounterparty] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// MasterStellaCompanyとの同期処理（設計書8.6）
// UIからの手動実行用
export async function syncCounterparties() {
  const session = await requireStaffForAccounting("edit");
  const result = await syncCounterpartiesCore(session.id);
  revalidatePath("/accounting/masters/counterparties");
  return result;
}

// Cron/内部呼び出し用（セッション不要）
export async function syncCounterpartiesCore(staffId: number) {
  const companies = await prisma.masterStellaCompany.findMany({
    where: { deletedAt: null, mergedIntoId: null },
    select: { id: true, name: true },
  });

  const existingLinks = await prisma.counterparty.findMany({
    where: { companyId: { not: null }, deletedAt: null },
    select: { id: true, companyId: true, name: true },
  });

  const linkedCompanyIds = new Set(
    existingLinks.map((link) => link.companyId as number)
  );

  let created = 0;
  let updated = 0;

  for (const company of companies) {
    if (linkedCompanyIds.has(company.id)) {
      const existing = existingLinks.find((link) => link.companyId === company.id);
      if (existing && existing.name !== company.name) {
        await updateCounterpartyForCompany(company.id, company.name, staffId);
        updated++;
      }
    } else {
      await createCounterpartyForCompany(company.id, company.name, staffId);
      created++;
    }
  }

  return { created, updated, total: companies.length };
}

// CostCenter → 取引先の同期（経理プロジェクト按分先用）
export async function syncCostCenterCounterparties() {
  const session = await requireStaffForAccounting("edit");
  const result = await syncCounterpartiesForCostCenters(session.id);

  revalidatePath("/accounting/masters/counterparties");

  return result;
}

// ============================================
// 全顧客マスタ（MasterStellaCompany）のインボイス情報更新
// ============================================

async function fetchStellaCompaniesForAccounting() {
  return prisma.masterStellaCompany.findMany({
    where: { deletedAt: null, mergedIntoId: null },
    select: {
      id: true,
      companyCode: true,
      name: true,
      corporateNumber: true,
      isInvoiceRegistered: true,
      invoiceRegistrationNumber: true,
      invoiceEffectiveDate: true,
      closingDay: true,
      paymentMonthOffset: true,
      paymentDay: true,
      bankAccounts: {
        where: { deletedAt: null },
        select: {
          id: true,
          bankName: true,
          bankCode: true,
          branchName: true,
          branchCode: true,
          accountNumber: true,
          accountHolderName: true,
          note: true,
        },
      },
      counterparties: {
        where: { deletedAt: null },
        select: { id: true, displayId: true },
        take: 1,
      },
    },
    orderBy: [{ id: "asc" }],
  });
}

export async function getStellaCompaniesForAccounting() {
  const companies = await fetchStellaCompaniesForAccounting();
  return [...companies].sort(compareStellaCompanies);
}

export async function updateStellaCompanyInvoiceInfo(
  id: number,
  data: {
    isInvoiceRegistered?: boolean;
    invoiceRegistrationNumber?: string | null;
    invoiceEffectiveDate?: Date | string | null;
  }
): Promise<ActionResult<void>> {
  try {
    await requireStaffForAccounting("edit");
    const updateData: Record<string, unknown> = {};

    if ("isInvoiceRegistered" in data) {
      updateData.isInvoiceRegistered = data.isInvoiceRegistered === true;
    }

    if ("invoiceRegistrationNumber" in data) {
      updateData.invoiceRegistrationNumber = data.invoiceRegistrationNumber?.trim() || null;
    }

    if ("invoiceEffectiveDate" in data) {
      updateData.invoiceEffectiveDate = data.invoiceEffectiveDate
        ? new Date(data.invoiceEffectiveDate)
        : null;
    }

    await prisma.masterStellaCompany.update({
      where: { id },
      data: updateData,
    });

    // 紐づくCounterpartyにも同期
    const counterparty = await prisma.counterparty.findFirst({
      where: { companyId: id, deletedAt: null },
    });
    if (counterparty) {
      const cpUpdate: Record<string, unknown> = {};
      if ("isInvoiceRegistered" in data) {
        cpUpdate.isInvoiceRegistered = data.isInvoiceRegistered === true;
      }
      if ("invoiceRegistrationNumber" in data) {
        cpUpdate.invoiceRegistrationNumber = data.invoiceRegistrationNumber?.trim() || null;
      }
      if ("invoiceEffectiveDate" in data) {
        cpUpdate.invoiceEffectiveDate = data.invoiceEffectiveDate
          ? new Date(data.invoiceEffectiveDate)
          : null;
      }
      if (Object.keys(cpUpdate).length > 0) {
        await prisma.counterparty.update({
          where: { id: counterparty.id },
          data: cpUpdate,
        });
      }
    }

    revalidatePath("/accounting/masters/counterparties");
    return ok();
  } catch (e) {
    console.error("[updateStellaCompanyInvoiceInfo] error:", e);
    return err(
      e instanceof Error ? e.message : "インボイス情報の更新に失敗しました"
    );
  }
}

type BankAccountDto = {
  id: number;
  companyId: number;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountHolderName: string;
  note: string | null;
};

function buildBankAccountData(data: Record<string, unknown>) {
  const bankName = String(data.bankName ?? "").trim();
  const accountNumber = String(data.accountNumber ?? "").trim();

  if (!bankName) return { ok: false as const, error: "銀行名は必須です" };
  if (!accountNumber) return { ok: false as const, error: "口座番号は必須です" };

  return {
    ok: true as const,
    data: {
      bankName,
      bankCode: String(data.bankCode ?? "").trim(),
      branchName: String(data.branchName ?? "").trim(),
      branchCode: String(data.branchCode ?? "").trim(),
      accountNumber,
      accountHolderName: String(data.accountHolderName ?? "").trim(),
      note: String(data.note ?? "").trim() || null,
    },
  };
}

function toBankAccountDto(bankAccount: {
  id: number;
  companyId: number;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountHolderName: string;
  note: string | null;
}): BankAccountDto {
  return {
    id: bankAccount.id,
    companyId: bankAccount.companyId,
    bankName: bankAccount.bankName,
    bankCode: bankAccount.bankCode,
    branchName: bankAccount.branchName,
    branchCode: bankAccount.branchCode,
    accountNumber: bankAccount.accountNumber,
    accountHolderName: bankAccount.accountHolderName,
    note: bankAccount.note,
  };
}

export async function addStellaCompanyBankAccount(
  companyId: number,
  data: Record<string, unknown>
): Promise<ActionResult<BankAccountDto>> {
  try {
    await requireStaffForAccounting("edit");
    const company = await prisma.masterStellaCompany.findFirst({
      where: { id: companyId, deletedAt: null, mergedIntoId: null },
      select: { id: true },
    });
    if (!company) return err("企業が見つかりません");

    const built = buildBankAccountData(data);
    if (!built.ok) return err(built.error);

    const bankAccount = await prisma.stellaCompanyBankAccount.create({
      data: {
        companyId,
        ...built.data,
      },
    });

    revalidatePath("/accounting/masters/counterparties");
    revalidatePath("/companies");
    return ok(toBankAccountDto(bankAccount));
  } catch (e) {
    console.error("[addStellaCompanyBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "銀行口座の追加に失敗しました");
  }
}

export async function updateStellaCompanyBankAccount(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult<BankAccountDto>> {
  try {
    await requireStaffForAccounting("edit");
    const existing = await prisma.stellaCompanyBankAccount.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return err("銀行口座が見つかりません");

    const built = buildBankAccountData(data);
    if (!built.ok) return err(built.error);

    const bankAccount = await prisma.stellaCompanyBankAccount.update({
      where: { id },
      data: built.data,
    });

    revalidatePath("/accounting/masters/counterparties");
    revalidatePath("/companies");
    return ok(toBankAccountDto(bankAccount));
  } catch (e) {
    console.error("[updateStellaCompanyBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "銀行口座の更新に失敗しました");
  }
}

export async function deleteStellaCompanyBankAccount(
  id: number
): Promise<ActionResult> {
  try {
    await requireStaffForAccounting("edit");
    const existing = await prisma.stellaCompanyBankAccount.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return err("銀行口座が見つかりません");

    await prisma.stellaCompanyBankAccount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/accounting/masters/counterparties");
    revalidatePath("/companies");
    return ok();
  } catch (e) {
    console.error("[deleteStellaCompanyBankAccount] error:", e);
    return err(e instanceof Error ? e.message : "銀行口座の削除に失敗しました");
  }
}

// ============================================
// 重複検知・統合フロー（設計書5.7）
// ============================================

export type DuplicatePair = {
  id1: number;
  name1: string;
  type1: string;
  companyName1: string | null;
  id2: number;
  name2: string;
  type2: string;
  companyName2: string | null;
};

// 定期重複チェック: 全取引先の正規化名を比較して重複候補ペアを返す
export async function detectDuplicates(): Promise<DuplicatePair[]> {
  const counterparties = await prisma.counterparty.findMany({
    where: { deletedAt: null, mergedIntoId: null },
    select: {
      id: true,
      name: true,
      counterpartyType: true,
      company: { select: { name: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 5000,
  });

  // 正規化名でグルーピング
  const normalizedMap = new Map<string, typeof counterparties>();
  for (const cp of counterparties) {
    const normalized = normalizeCounterpartyName(cp.name);
    const group = normalizedMap.get(normalized);
    if (group) {
      group.push(cp);
    } else {
      normalizedMap.set(normalized, [cp]);
    }
  }

  // 完全一致グループからペアを生成
  const pairs: DuplicatePair[] = [];
  for (const group of normalizedMap.values()) {
    if (group.length < 2) continue;
    // グループ内の全ペアを生成（IDの小さい方をid1にする）
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.push({
          id1: group[i].id,
          name1: group[i].name,
          type1: group[i].counterpartyType,
          companyName1: group[i].company?.name ?? null,
          id2: group[j].id,
          name2: group[j].name,
          type2: group[j].counterpartyType,
          companyName2: group[j].company?.name ?? null,
        });
      }
    }
  }

  // 部分包含チェック（正規化名が互いに包含関係にある場合）
  const entries = Array.from(normalizedMap.entries());
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [normA, groupA] = entries[i];
      const [normB, groupB] = entries[j];
      if (normA === normB) continue; // 完全一致は上で処理済み
      if (normA.length < 2 || normB.length < 2) continue; // 短すぎる名称はスキップ
      if (normA.includes(normB) || normB.includes(normA)) {
        // 各グループ間のペアを生成
        for (const a of groupA) {
          for (const b of groupB) {
            const [first, second] = a.id < b.id ? [a, b] : [b, a];
            pairs.push({
              id1: first.id,
              name1: first.name,
              type1: first.counterpartyType,
              companyName1: first.company?.name ?? null,
              id2: second.id,
              name2: second.name,
              type2: second.counterpartyType,
              companyName2: second.company?.name ?? null,
            });
          }
        }
      }
    }
  }

  return pairs;
}

export type MergeImpact = {
  source: { id: number; name: string; counterpartyType: string };
  target: { id: number; name: string; counterpartyType: string };
  transactionCount: number;
  recurringTransactionCount: number;
  autoJournalRuleCount: number;
  invoiceGroupCount: number;
  paymentGroupCount: number;
  totalAffected: number;
  duplicateRuleWarning: boolean;
};

// 統合前の影響範囲確認（設計書5.7）
export async function getCounterpartyMergeImpact(
  sourceId: number,
  targetId: number
): Promise<ActionResult<MergeImpact>> {
  try {
  const [source, target] = await Promise.all([
    prisma.counterparty.findUnique({
      where: { id: sourceId },
      select: { id: true, name: true, counterpartyType: true },
    }),
    prisma.counterparty.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, counterpartyType: true },
    }),
  ]);

  if (!source) return err(`統合元の取引先 (ID: ${sourceId}) が見つかりません`);
  if (!target) return err(`統合先の取引先 (ID: ${targetId}) が見つかりません`);

  // 各テーブルの影響件数を並列カウント
  const [
    transactionCount,
    recurringTransactionCount,
    autoJournalRuleCount,
    invoiceGroupCount,
    paymentGroupCount,
  ] = await Promise.all([
    prisma.transaction.count({ where: { counterpartyId: sourceId, deletedAt: null } }),
    prisma.recurringTransaction.count({ where: { counterpartyId: sourceId, deletedAt: null } }),
    prisma.autoJournalRule.count({ where: { counterpartyId: sourceId, deletedAt: null } }),
    prisma.invoiceGroup.count({ where: { counterpartyId: sourceId, deletedAt: null } }),
    prisma.paymentGroup.count({ where: { counterpartyId: sourceId, deletedAt: null } }),
  ]);

  const totalAffected =
    transactionCount +
    recurringTransactionCount +
    autoJournalRuleCount +
    invoiceGroupCount +
    paymentGroupCount;

  // 重複ルール警告: 統合先に既に同じ条件のAutoJournalRuleがある場合
  let duplicateRuleWarning = false;
  if (autoJournalRuleCount > 0) {
    const targetRuleCount = await prisma.autoJournalRule.count({
      where: { counterpartyId: targetId, deletedAt: null },
    });
    if (targetRuleCount > 0) {
      duplicateRuleWarning = true;
    }
  }

    return ok({
      source,
      target,
      transactionCount,
      recurringTransactionCount,
      autoJournalRuleCount,
      invoiceGroupCount,
      paymentGroupCount,
      totalAffected,
      duplicateRuleWarning,
    });
  } catch (e) {
    console.error("[getCounterpartyMergeImpact] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// 統合実行（設計書5.7: FK付け替え + 論理削除 + ChangeLog記録）
export async function mergeCounterparties(
  sourceId: number,
  targetId: number
): Promise<ActionResult<{ totalUpdated: number }>> {
  try {
  const session = await getSession();
  const staffId = session.id;

  if (sourceId === targetId) {
    return err("統合元と統合先が同じです");
  }

  // 統合元・統合先の存在確認
  const [source, target] = await Promise.all([
    prisma.counterparty.findUnique({ where: { id: sourceId } }),
    prisma.counterparty.findUnique({ where: { id: targetId } }),
  ]);

  if (!source || source.deletedAt || source.mergedIntoId) {
    return err("統合元の取引先が存在しないか、既に削除/統合済みです");
  }
  if (!target || target.deletedAt || target.mergedIntoId) {
    return err("統合先の取引先が存在しないか、既に削除/統合済みです");
  }

  // トランザクション内でFK付替え + 統合元の論理削除 + ChangeLog記録
  const result = await prisma.$transaction(async (tx) => {
    // FK付替え
    const [txnResult, recurResult, ruleResult, invResult, payResult] =
      await Promise.all([
        tx.transaction.updateMany({
          where: { counterpartyId: sourceId },
          data: { counterpartyId: targetId },
        }),
        tx.recurringTransaction.updateMany({
          where: { counterpartyId: sourceId },
          data: { counterpartyId: targetId },
        }),
        tx.autoJournalRule.updateMany({
          where: { counterpartyId: sourceId },
          data: { counterpartyId: targetId },
        }),
        tx.invoiceGroup.updateMany({
          where: { counterpartyId: sourceId },
          data: { counterpartyId: targetId },
        }),
        tx.paymentGroup.updateMany({
          where: { counterpartyId: sourceId },
          data: { counterpartyId: targetId },
        }),
      ]);

    const totalUpdated =
      txnResult.count +
      recurResult.count +
      ruleResult.count +
      invResult.count +
      payResult.count;

    // 統合元に mergedIntoId, mergedAt, deletedAt を設定
    const now = new Date();
    await tx.counterparty.update({
      where: { id: sourceId },
      data: {
        mergedIntoId: targetId,
        mergedAt: now,
        deletedAt: now,
        updatedBy: staffId,
      },
    });

    // ChangeLog記録: 統合操作
    await recordChangeLog(
      {
        tableName: "Counterparty",
        recordId: sourceId,
        changeType: "update",
        oldData: {
          name: source.name,
          counterpartyType: source.counterpartyType,
          mergedIntoId: null,
          mergedAt: null,
          deletedAt: null,
        },
        newData: {
          name: source.name,
          counterpartyType: source.counterpartyType,
          mergedIntoId: targetId,
          mergedIntoName: target.name,
          mergedAt: now.toISOString(),
          deletedAt: now.toISOString(),
          action: "merge",
          totalFkUpdated: totalUpdated,
          fkDetails: {
            transactions: txnResult.count,
            recurringTransactions: recurResult.count,
            autoJournalRules: ruleResult.count,
            invoiceGroups: invResult.count,
            paymentGroups: payResult.count,
          },
        },
      },
      staffId,
      tx
    );

    return totalUpdated;
  });

  revalidatePath("/accounting/masters/counterparties");
  revalidatePath("/accounting/masters/counterparties/duplicates");

    return ok({ totalUpdated: result });
  } catch (e) {
    console.error("[mergeCounterparties] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
