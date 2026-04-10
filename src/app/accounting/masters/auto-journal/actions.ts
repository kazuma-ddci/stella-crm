"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

const VALID_TRANSACTION_TYPES = ["revenue", "expense"] as const;

// ============================================
// 1. createAutoJournalRule（新規ルール作成）
// ============================================

export async function createAutoJournalRule(
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    const counterpartyId = data.counterpartyId
      ? Number(data.counterpartyId)
      : null;
    const transactionType = data.transactionType
      ? (data.transactionType as string)
      : null;
    const expenseCategoryId = data.expenseCategoryId
      ? Number(data.expenseCategoryId)
      : null;
    const debitAccountId = Number(data.debitAccountId);
    const creditAccountId = Number(data.creditAccountId);
    const priority = data.priority ? Number(data.priority) : 100;
    const isActive = data.isActive !== false && data.isActive !== "false";

    // 必須チェック
    if (!debitAccountId || isNaN(debitAccountId)) {
      return err("借方科目は必須です");
    }
    if (!creditAccountId || isNaN(creditAccountId)) {
      return err("貸方科目は必須です");
    }

    // transactionType の値チェック
    if (
      transactionType &&
      !(VALID_TRANSACTION_TYPES as readonly string[]).includes(transactionType)
    ) {
      return err("無効な取引種別です");
    }

    // 借方・貸方が同じ科目でないかチェック
    if (debitAccountId === creditAccountId) {
      return err("借方科目と貸方科目は異なる科目を指定してください");
    }

    // 勘定科目の存在チェック
    const accounts = await prisma.account.findMany({
      where: { id: { in: [debitAccountId, creditAccountId] }, isActive: true },
      select: { id: true },
    });
    const foundIds = new Set(accounts.map((a) => a.id));
    if (!foundIds.has(debitAccountId)) {
      return err("指定された借方科目が見つかりません");
    }
    if (!foundIds.has(creditAccountId)) {
      return err("指定された貸方科目が見つかりません");
    }

    // 取引先の存在チェック
    if (counterpartyId) {
      const cp = await prisma.counterparty.findFirst({
        where: { id: counterpartyId, deletedAt: null },
        select: { id: true },
      });
      if (!cp) {
        return err("指定された取引先が見つかりません");
      }
    }

    // 費目の存在チェック
    if (expenseCategoryId) {
      const ec = await prisma.expenseCategory.findFirst({
        where: { id: expenseCategoryId, deletedAt: null },
        select: { id: true },
      });
      if (!ec) {
        return err("指定された費目が見つかりません");
      }
    }

    await prisma.autoJournalRule.create({
      data: {
        counterpartyId,
        transactionType,
        expenseCategoryId,
        debitAccountId,
        creditAccountId,
        priority,
        isActive,
        createdBy: staffId,
      },
    });

    revalidatePath("/accounting/masters/auto-journal");
    return ok();
  } catch (e) {
    console.error("[createAutoJournalRule] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 2. updateAutoJournalRule（ルール更新）
// ============================================

export async function updateAutoJournalRule(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    const existing = await prisma.autoJournalRule.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, debitAccountId: true, creditAccountId: true },
    });
    if (!existing) {
      return err("ルールが見つかりません");
    }

    const updateData: Record<string, unknown> = {};

    if ("counterpartyId" in data) {
      const counterpartyId = data.counterpartyId
        ? Number(data.counterpartyId)
        : null;
      if (counterpartyId) {
        const cp = await prisma.counterparty.findFirst({
          where: { id: counterpartyId, deletedAt: null },
          select: { id: true },
        });
        if (!cp) {
          return err("指定された取引先が見つかりません");
        }
      }
      updateData.counterpartyId = counterpartyId;
    }

    if ("transactionType" in data) {
      const transactionType = data.transactionType
        ? (data.transactionType as string)
        : null;
      if (
        transactionType &&
        !(VALID_TRANSACTION_TYPES as readonly string[]).includes(transactionType)
      ) {
        return err("無効な取引種別です");
      }
      updateData.transactionType = transactionType;
    }

    if ("expenseCategoryId" in data) {
      const expenseCategoryId = data.expenseCategoryId
        ? Number(data.expenseCategoryId)
        : null;
      if (expenseCategoryId) {
        const ec = await prisma.expenseCategory.findFirst({
          where: { id: expenseCategoryId, deletedAt: null },
          select: { id: true },
        });
        if (!ec) {
          return err("指定された費目が見つかりません");
        }
      }
      updateData.expenseCategoryId = expenseCategoryId;
    }

    if ("debitAccountId" in data) {
      const debitAccountId = Number(data.debitAccountId);
      if (!debitAccountId || isNaN(debitAccountId)) {
        return err("借方科目は必須です");
      }
      const account = await prisma.account.findFirst({
        where: { id: debitAccountId, isActive: true },
        select: { id: true },
      });
      if (!account) {
        return err("指定された借方科目が見つかりません");
      }
      updateData.debitAccountId = debitAccountId;
    }

    if ("creditAccountId" in data) {
      const creditAccountId = Number(data.creditAccountId);
      if (!creditAccountId || isNaN(creditAccountId)) {
        return err("貸方科目は必須です");
      }
      const account = await prisma.account.findFirst({
        where: { id: creditAccountId, isActive: true },
        select: { id: true },
      });
      if (!account) {
        return err("指定された貸方科目が見つかりません");
      }
      updateData.creditAccountId = creditAccountId;
    }

    // 借方・貸方が同じ科目でないかチェック
    const finalDebit =
      (updateData.debitAccountId as number) ?? existing.debitAccountId;
    const finalCredit =
      (updateData.creditAccountId as number) ?? existing.creditAccountId;
    if (finalDebit === finalCredit) {
      return err("借方科目と貸方科目は異なる科目を指定してください");
    }

    if ("priority" in data) {
      updateData.priority = Number(data.priority) || 100;
    }

    if ("isActive" in data) {
      updateData.isActive = toBoolean(data.isActive);
    }

    updateData.updatedBy = staffId;

    await prisma.autoJournalRule.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/accounting/masters/auto-journal");
    return ok();
  } catch (e) {
    console.error("[updateAutoJournalRule] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 3. deleteAutoJournalRule（ルール論理削除）
// ============================================

export async function deleteAutoJournalRule(
  id: number
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    const existing = await prisma.autoJournalRule.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      return err("ルールが見つかりません");
    }

    await prisma.autoJournalRule.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: staffId,
      },
    });

    revalidatePath("/accounting/masters/auto-journal");
    return ok();
  } catch (e) {
    console.error("[deleteAutoJournalRule] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 4. reorderAutoJournalRules（優先度並び替え）
// ============================================

export async function reorderAutoJournalRules(
  orderedIds: number[]
): Promise<ActionResult> {
  try {
    const session = await getSession();
    const staffId = session.id;

    // 連番で優先度を再採番（1, 2, 3, ...）
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.autoJournalRule.update({
          where: { id },
          data: { priority: index + 1, updatedBy: staffId },
        })
      )
    );

    revalidatePath("/accounting/masters/auto-journal");
    return ok();
  } catch (e) {
    console.error("[reorderAutoJournalRules] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 5. checkConflictingRules（競合ルールチェック）
// ============================================

export async function checkConflictingRules(data: {
  counterpartyId: number | null;
  transactionType: string | null;
  expenseCategoryId: number | null;
  excludeId?: number;
}) {
  // 同じ条件粒度のルールを検索
  // 取引先 × 種別 × 費目の一致度が同等のルールを見つける
  const where: Record<string, unknown> = {
    deletedAt: null,
    isActive: true,
  };

  // null条件の処理：nullは「全対象」なので、同じ粒度のルールを検索
  if (data.counterpartyId !== null) {
    where.counterpartyId = data.counterpartyId;
  } else {
    where.counterpartyId = null;
  }

  if (data.transactionType !== null) {
    where.transactionType = data.transactionType;
  } else {
    where.transactionType = null;
  }

  if (data.expenseCategoryId !== null) {
    where.expenseCategoryId = data.expenseCategoryId;
  } else {
    where.expenseCategoryId = null;
  }

  if (data.excludeId) {
    where.id = { not: data.excludeId };
  }

  const conflicting = await prisma.autoJournalRule.findMany({
    where,
    include: {
      counterparty: { select: { name: true } },
      expenseCategory: { select: { name: true } },
      debitAccount: { select: { code: true, name: true } },
      creditAccount: { select: { code: true, name: true } },
    },
    orderBy: { priority: "asc" },
  });

  return conflicting.map((rule) => ({
    id: rule.id,
    counterpartyName: rule.counterparty?.name ?? "（全取引先）",
    transactionType: rule.transactionType,
    expenseCategoryName: rule.expenseCategory?.name ?? "（全費目）",
    debitAccountName: `${rule.debitAccount.code} - ${rule.debitAccount.name}`,
    creditAccountName: `${rule.creditAccount.code} - ${rule.creditAccount.name}`,
    priority: rule.priority,
  }));
}

// ============================================
// 6. executeAutoJournal（自動仕訳実行）
// ============================================

type ExecuteAutoJournalResult = {
  matched: { transactionId: number; journalEntryId: number; ruleId: number }[];
  unmatched: { transactionId: number; description: string }[];
  skipped: { transactionId: number; description: string }[];
};

export async function executeAutoJournal(
  transactionIds: number[]
): Promise<ActionResult<ExecuteAutoJournalResult>> {
  try {
    const session = await getSession();
    const staffId = session.id;

    if (!transactionIds.length) {
      return err("対象取引が選択されていません");
    }

    // 対象取引を取得（経理処理待ちステータスで未仕訳のもの）
    const transactions = await prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        deletedAt: null,
        status: "awaiting_accounting",
      },
      select: {
        id: true,
        type: true,
        amount: true,
        taxAmount: true,
        counterpartyId: true,
        expenseCategoryId: true,
        note: true,
        counterparty: { select: { name: true } },
        expenseCategory: { select: { name: true } },
      },
    });

    if (!transactions.length) {
      return err("経理処理待ちの取引が見つかりません");
    }

    // 既に自動生成仕訳がある取引を除外（重複生成防止）
    const existingJournals = await prisma.journalEntry.findMany({
      where: {
        transactionId: { in: transactions.map((tx) => tx.id) },
        isAutoGenerated: true,
        deletedAt: null,
      },
      select: { transactionId: true },
    });
    const alreadyJournaled = new Set(
      existingJournals.map((j) => j.transactionId)
    );
    const eligibleTransactions = transactions.filter(
      (tx) => !alreadyJournaled.has(tx.id)
    );
    const skipped = transactions
      .filter((tx) => alreadyJournaled.has(tx.id))
      .map((tx) => ({
        transactionId: tx.id,
        description: `${tx.counterparty.name} / ${tx.expenseCategory?.name ?? "費目なし"}（自動仕訳済み）`,
      }));

    if (!eligibleTransactions.length) {
      return ok({ matched: [], unmatched: [], skipped });
    }

    // 有効なルールを優先度順に取得
    const rules = await prisma.autoJournalRule.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { priority: "asc" },
      select: {
        id: true,
        counterpartyId: true,
        transactionType: true,
        expenseCategoryId: true,
        debitAccountId: true,
        creditAccountId: true,
      },
    });

    const results: ExecuteAutoJournalResult = {
      matched: [],
      unmatched: [],
      skipped,
    };

    // 各取引についてルールマッチング
    for (const tx of eligibleTransactions) {
      const matchedRule = findMatchingRule(rules, tx);

      if (matchedRule) {
        // マッチしたルールで仕訳下書きを自動生成
        const totalAmount = tx.amount + tx.taxAmount;
        const journalEntry = await prisma.$transaction(async (prismaClient) => {
          const entry = await prismaClient.journalEntry.create({
            data: {
              transactionId: tx.id,
              journalDate: new Date(),
              description: buildAutoDescription(tx),
              isAutoGenerated: true,
              status: "draft",
              autoJournalRuleId: matchedRule.id,
              createdBy: staffId,
            },
          });

          await prismaClient.journalEntryLine.createMany({
            data: [
              {
                journalEntryId: entry.id,
                side: "debit",
                accountId: matchedRule.debitAccountId,
                amount: totalAmount,
                createdBy: staffId,
              },
              {
                journalEntryId: entry.id,
                side: "credit",
                accountId: matchedRule.creditAccountId,
                amount: totalAmount,
                createdBy: staffId,
              },
            ],
          });

          return entry;
        });

        results.matched.push({
          transactionId: tx.id,
          journalEntryId: journalEntry.id,
          ruleId: matchedRule.id,
        });
      } else {
        results.unmatched.push({
          transactionId: tx.id,
          description: `${tx.counterparty.name} / ${tx.expenseCategory?.name ?? "費目なし"}`,
        });
      }
    }

    revalidatePath("/accounting/journal");
    revalidatePath("/accounting/masters/auto-journal");

    return ok(results);
  } catch (e) {
    console.error("[executeAutoJournal] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ルールマッチングロジック
// 取引先 × 種別 × 費目で検索（priority昇順で最初にマッチしたルール）
function findMatchingRule(
  rules: {
    id: number;
    counterpartyId: number | null;
    transactionType: string | null;
    expenseCategoryId: number | null;
    debitAccountId: number;
    creditAccountId: number;
  }[],
  transaction: {
    counterpartyId: number;
    type: string;
    expenseCategoryId: number | null;
  }
) {
  for (const rule of rules) {
    // 取引先: nullなら全取引先にマッチ、指定ありなら一致のみ
    if (
      rule.counterpartyId !== null &&
      rule.counterpartyId !== transaction.counterpartyId
    ) {
      continue;
    }

    // 種別: nullなら両方にマッチ、指定ありなら一致のみ
    if (
      rule.transactionType !== null &&
      rule.transactionType !== transaction.type
    ) {
      continue;
    }

    // 費目: nullなら全費目にマッチ、指定ありなら一致のみ
    if (
      rule.expenseCategoryId !== null &&
      rule.expenseCategoryId !== transaction.expenseCategoryId
    ) {
      continue;
    }

    return rule;
  }

  return null;
}

// 自動仕訳の摘要を生成
function buildAutoDescription(tx: {
  type: string;
  counterparty: { name: string };
  expenseCategory: { name: string } | null;
  note: string | null;
}) {
  const typeLabel = tx.type === "revenue" ? "売上" : "経費";
  const parts = [
    `【自動仕訳】${typeLabel}`,
    tx.counterparty.name,
    tx.expenseCategory?.name,
  ].filter(Boolean);

  if (tx.note) {
    parts.push(tx.note);
  }

  return parts.join(" / ");
}

// ============================================
// 7. suggestRuleFromJournal（手動仕訳からルール追加提案）
// ============================================

type SuggestRuleResult = {
  suggestion: {
    counterpartyId: number;
    counterpartyName: string;
    transactionType: string;
    expenseCategoryId: number | null;
    expenseCategoryName: string | null;
    debitAccountId: number;
    debitAccountName: string;
    creditAccountId: number;
    creditAccountName: string;
    priority: number;
  };
  conflicts: Awaited<ReturnType<typeof checkConflictingRules>>;
};

export async function suggestRuleFromJournal(
  journalEntryId: number
): Promise<ActionResult<SuggestRuleResult>> {
  try {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: journalEntryId, deletedAt: null },
      include: {
        transaction: {
          select: {
            id: true,
            type: true,
            counterpartyId: true,
            expenseCategoryId: true,
            counterparty: { select: { id: true, name: true } },
            expenseCategory: { select: { id: true, name: true } },
          },
        },
        lines: {
          select: {
            side: true,
            accountId: true,
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!entry) {
      return err("仕訳が見つかりません");
    }

    if (!entry.transaction) {
      return err("取引に紐づいていない仕訳からはルール提案できません");
    }

    // 借方・貸方の最初の行から科目を取得
    const debitLine = entry.lines.find((l) => l.side === "debit");
    const creditLine = entry.lines.find((l) => l.side === "credit");

    if (!debitLine || !creditLine) {
      return err("借方または貸方の明細がありません");
    }

    const suggestion = {
      counterpartyId: entry.transaction.counterpartyId,
      counterpartyName: entry.transaction.counterparty.name,
      transactionType: entry.transaction.type,
      expenseCategoryId: entry.transaction.expenseCategoryId,
      expenseCategoryName: entry.transaction.expenseCategory?.name ?? null,
      debitAccountId: debitLine.accountId,
      debitAccountName: `${debitLine.account.code} - ${debitLine.account.name}`,
      creditAccountId: creditLine.accountId,
      creditAccountName: `${creditLine.account.code} - ${creditLine.account.name}`,
      priority: 100,
    };

    // 既存の競合ルールも返す
    const conflicts = await checkConflictingRules({
      counterpartyId: suggestion.counterpartyId,
      transactionType: suggestion.transactionType,
      expenseCategoryId: suggestion.expenseCategoryId,
    });

    return ok({ suggestion, conflicts });
  } catch (e) {
    console.error("[suggestRuleFromJournal] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
