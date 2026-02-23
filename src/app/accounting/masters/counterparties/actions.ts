"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordChangeLog } from "@/app/accounting/changelog/actions";

const VALID_TYPES = ["customer", "vendor", "service", "other"] as const;

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
export async function createCounterparty(data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const name = (data.name as string).trim();
  const counterpartyType = data.counterpartyType as string;
  const companyId = data.companyId ? Number(data.companyId) : null;
  const memo = data.memo ? (data.memo as string).trim() : null;
  const isActive = data.isActive !== false && data.isActive !== "false";

  if (!name || !counterpartyType) {
    throw new Error("名称と種別は必須です");
  }

  if (!(VALID_TYPES as readonly string[]).includes(counterpartyType)) {
    throw new Error("無効な種別です");
  }

  // 名称重複チェック（論理削除・統合済みを除く）
  const existing = await prisma.counterparty.findFirst({
    where: { name, deletedAt: null, mergedIntoId: null },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`取引先「${name}」は既に登録されています`);
  }

  // companyId指定時、既にその企業に紐づく取引先がないかチェック
  if (companyId) {
    const existingCompanyLink = await prisma.counterparty.findFirst({
      where: { companyId, deletedAt: null, mergedIntoId: null },
      select: { id: true, name: true },
    });
    if (existingCompanyLink) {
      throw new Error(
        `この企業は既に取引先「${existingCompanyLink.name}」と紐づいています`
      );
    }
  }

  await prisma.counterparty.create({
    data: {
      name,
      counterpartyType,
      companyId,
      memo: memo || null,
      isActive,
      createdBy: staffId,
    },
  });

  revalidatePath("/accounting/masters/counterparties");
}

// 更新（部分更新対応）
export async function updateCounterparty(
  id: number,
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  const updateData: Record<string, unknown> = {};

  if ("name" in data) {
    const name = (data.name as string).trim();
    if (!name) throw new Error("名称は必須です");

    // 名称重複チェック（自分自身は除く）
    const existing = await prisma.counterparty.findFirst({
      where: { name, deletedAt: null, mergedIntoId: null, id: { not: id } },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`取引先「${name}」は既に登録されています`);
    }
    updateData.name = name;
  }

  if ("counterpartyType" in data) {
    const counterpartyType = data.counterpartyType as string;
    if (!(VALID_TYPES as readonly string[]).includes(counterpartyType)) {
      throw new Error("無効な種別です");
    }
    updateData.counterpartyType = counterpartyType;
  }

  if ("companyId" in data) {
    const companyId = data.companyId ? Number(data.companyId) : null;

    // companyId指定時、既にその企業に紐づく取引先がないかチェック（自分自身除外）
    if (companyId) {
      const existingCompanyLink = await prisma.counterparty.findFirst({
        where: {
          companyId,
          deletedAt: null,
          mergedIntoId: null,
          id: { not: id },
        },
        select: { id: true, name: true },
      });
      if (existingCompanyLink) {
        throw new Error(
          `この企業は既に取引先「${existingCompanyLink.name}」と紐づいています`
        );
      }
    }
    updateData.companyId = companyId;
  }

  if ("memo" in data) {
    updateData.memo = data.memo ? (data.memo as string).trim() || null : null;
  }

  if ("isActive" in data) {
    updateData.isActive = data.isActive === true || data.isActive === "true";
  }

  updateData.updatedBy = staffId;

  await prisma.counterparty.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/accounting/masters/counterparties");
}

// MasterStellaCompanyとの同期処理（設計書8.6）
export async function syncCounterparties() {
  const session = await getSession();
  const staffId = session.id;

  // 全MasterStellaCompany（論理削除されていないもの）を取得
  const companies = await prisma.masterStellaCompany.findMany({
    where: { deletedAt: null, mergedIntoId: null },
    select: { id: true, name: true },
  });

  // 既にcompanyIdが設定されているCounterpartyを取得
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
      // 既存リンクがある → 名称を同期更新
      const existing = existingLinks.find(
        (link) => link.companyId === company.id
      );
      if (existing && existing.name !== company.name) {
        await prisma.counterparty.update({
          where: { id: existing.id },
          data: { name: company.name, updatedBy: staffId },
        });
        updated++;
      }
    } else {
      // 新規作成（companyId紐づき）
      await prisma.counterparty.create({
        data: {
          name: company.name,
          companyId: company.id,
          counterpartyType: "customer",
          isActive: true,
          createdBy: staffId,
        },
      });
      created++;
    }
  }

  revalidatePath("/accounting/masters/counterparties");

  return { created, updated, total: companies.length };
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
  bankTransactionCount: number;
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
): Promise<MergeImpact> {
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

  if (!source) throw new Error(`統合元の取引先 (ID: ${sourceId}) が見つかりません`);
  if (!target) throw new Error(`統合先の取引先 (ID: ${targetId}) が見つかりません`);

  // 各テーブルの影響件数を並列カウント
  const [
    transactionCount,
    recurringTransactionCount,
    bankTransactionCount,
    autoJournalRuleCount,
    invoiceGroupCount,
    paymentGroupCount,
  ] = await Promise.all([
    prisma.transaction.count({ where: { counterpartyId: sourceId, deletedAt: null } }),
    prisma.recurringTransaction.count({ where: { counterpartyId: sourceId, deletedAt: null } }),
    prisma.bankTransaction.count({ where: { counterpartyId: sourceId, deletedAt: null } }),
    prisma.autoJournalRule.count({ where: { counterpartyId: sourceId, deletedAt: null } }),
    prisma.invoiceGroup.count({ where: { counterpartyId: sourceId, deletedAt: null } }),
    prisma.paymentGroup.count({ where: { counterpartyId: sourceId, deletedAt: null } }),
  ]);

  const totalAffected =
    transactionCount +
    recurringTransactionCount +
    bankTransactionCount +
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

  return {
    source,
    target,
    transactionCount,
    recurringTransactionCount,
    bankTransactionCount,
    autoJournalRuleCount,
    invoiceGroupCount,
    paymentGroupCount,
    totalAffected,
    duplicateRuleWarning,
  };
}

// 統合実行（設計書5.7: FK付け替え + 論理削除 + ChangeLog記録）
export async function mergeCounterparties(
  sourceId: number,
  targetId: number
): Promise<{ success: true; totalUpdated: number }> {
  const session = await getSession();
  const staffId = session.id;

  if (sourceId === targetId) {
    throw new Error("統合元と統合先が同じです");
  }

  // 統合元・統合先の存在確認
  const [source, target] = await Promise.all([
    prisma.counterparty.findUnique({ where: { id: sourceId } }),
    prisma.counterparty.findUnique({ where: { id: targetId } }),
  ]);

  if (!source || source.deletedAt || source.mergedIntoId) {
    throw new Error("統合元の取引先が存在しないか、既に削除/統合済みです");
  }
  if (!target || target.deletedAt || target.mergedIntoId) {
    throw new Error("統合先の取引先が存在しないか、既に削除/統合済みです");
  }

  // トランザクション内でFK付替え + 統合元の論理削除 + ChangeLog記録
  const result = await prisma.$transaction(async (tx) => {
    // FK付替え
    const [txnResult, recurResult, bankResult, ruleResult, invResult, payResult] =
      await Promise.all([
        tx.transaction.updateMany({
          where: { counterpartyId: sourceId },
          data: { counterpartyId: targetId },
        }),
        tx.recurringTransaction.updateMany({
          where: { counterpartyId: sourceId },
          data: { counterpartyId: targetId },
        }),
        tx.bankTransaction.updateMany({
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
      bankResult.count +
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
            bankTransactions: bankResult.count,
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

  return { success: true, totalUpdated: result };
}
