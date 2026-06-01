"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";
import {
  syncInvoiceGroupPaymentStateFromRecords,
  syncPaymentGroupPaymentStateFromRecords,
} from "@/lib/accounting/sync-payment-date";
import {
  buildStatementCompletionWarnings,
  recalculateStatementLinkCompleted,
  summarizeStatementLinks,
  type StatementLinkType,
} from "@/lib/accounting/statement-link-completion";
import type { Prisma } from "@prisma/client";

// ============================================
// 共通型
// ============================================

export type GroupKind = "invoice" | "payment";

/** スタッフが選ぶ衝突解決方法 */
export type ConflictResolution = "overwrite" | "keep_both";

/** 紐付け対象グループに残っている手動入力レコード（衝突候補） */
export type LinkConflict = {
  groupKind: GroupKind;
  groupId: number;
  groupLabel: string;
  manualRecords: {
    id: number; // InvoiceGroupReceipt.id or PaymentGroupPayment.id
    date: string; // ISO YYYY-MM-DD
    amount: number;
    comment: string | null;
  }[];
};

export type LinkCandidate = {
  id: number;
  label: string;
  counterpartyName: string;
  operatingCompanyId: number;
  operatingCompanyName: string;
  isCrossCompany: boolean;
  totalAmount: number | null;
  expectedDate: string | null;
  status: string;
  manualPaymentStatus: string;
  alreadyLinkedAmount: number;
  statementLinkCompleted: boolean;
};

// ============================================
// エントリ方向取得
// ============================================

async function getEntryDirection(entryId: number): Promise<{
  direction: GroupKind | null;
  operatingCompanyId: number;
  amount: number;
  transactionDate: Date;
  excluded: boolean;
} | null> {
  const e = await prisma.bankStatementEntry.findUnique({
    where: { id: entryId },
    select: {
      operatingCompanyId: true,
      incomingAmount: true,
      outgoingAmount: true,
      transactionDate: true,
      excluded: true,
    },
  });
  if (!e) return null;
  if ((e.incomingAmount ?? 0) > 0) {
    return {
      direction: "invoice",
      operatingCompanyId: e.operatingCompanyId,
      amount: e.incomingAmount!,
      transactionDate: e.transactionDate,
      excluded: e.excluded,
    };
  }
  if ((e.outgoingAmount ?? 0) > 0) {
    return {
      direction: "payment",
      operatingCompanyId: e.operatingCompanyId,
      amount: e.outgoingAmount!,
      transactionDate: e.transactionDate,
      excluded: e.excluded,
    };
  }
  return {
    direction: null,
    operatingCompanyId: e.operatingCompanyId,
    amount: 0,
    transactionDate: e.transactionDate,
    excluded: e.excluded,
  };
}

function ensureEntryIsLinkable(meta: { excluded: boolean }) {
  if (meta.excluded) {
    return err("除外済みの入出金履歴は紐付けできません。先に除外を解除してください");
  }
  return null;
}

async function recalcStatementCheckAndSyncPaymentState(
  tx: Prisma.TransactionClient,
  groupKind: GroupKind,
  groupId: number
) {
  await recalculateStatementLinkCompleted(tx, groupKind, groupId);
}

async function syncPaymentStateAfterStatementCheckChange(
  tx: Prisma.TransactionClient,
  groupKind: GroupKind,
  groupId: number,
  completed: boolean
) {
  if (groupKind === "invoice") {
    await tx.invoiceGroup.update({
      where: { id: groupId },
      data: { statementLinkCompleted: completed },
    });
    await syncInvoiceGroupPaymentStateFromRecords(tx, groupId);
  } else {
    await tx.paymentGroup.update({
      where: { id: groupId },
      data: { statementLinkCompleted: completed },
    });
    await syncPaymentGroupPaymentStateFromRecords(tx, groupId);
  }
}

function addAffectedGroup(
  map: Map<GroupKind, Set<number>>,
  groupKind: GroupKind,
  groupId: number | null
) {
  if (!groupId) return;
  map.get(groupKind)?.add(groupId);
}

function buildLinkNote(note: string | null | undefined, crossCompanyReason?: string | null) {
  const trimmedNote = note?.trim() || "";
  const trimmedReason = crossCompanyReason?.trim() || "";
  if (!trimmedReason) return trimmedNote || null;
  const prefix = `[別法人紐付け: ${trimmedReason}]`;
  return trimmedNote ? `${prefix} ${trimmedNote}` : prefix;
}

async function detachManualRecordsForLinks(
  tx: Prisma.TransactionClient,
  linkIds: number[]
) {
  if (linkIds.length === 0) return;
  await tx.invoiceGroupReceipt.updateMany({
    where: {
      bankStatementEntryGroupLinkId: { in: linkIds },
      recordSource: "manual",
    },
    data: { bankStatementEntryGroupLinkId: null },
  });
  await tx.paymentGroupPayment.updateMany({
    where: {
      bankStatementEntryGroupLinkId: { in: linkIds },
      recordSource: "manual",
    },
    data: { bankStatementEntryGroupLinkId: null },
  });
}

// ============================================
// 手動入力レコード（バンク紐付け無し）の衝突検出
// ============================================

async function detectManualConflicts(
  tx: Prisma.TransactionClient,
  links: { groupKind: GroupKind; groupId: number }[]
): Promise<LinkConflict[]> {
  const conflicts: LinkConflict[] = [];
  for (const l of links) {
    if (l.groupKind === "invoice") {
      const records = await tx.invoiceGroupReceipt.findMany({
        where: {
          invoiceGroupId: l.groupId,
          bankStatementEntryGroupLinkId: null,
        },
        orderBy: { receivedDate: "desc" },
        select: {
          id: true,
          receivedDate: true,
          amount: true,
          comment: true,
          invoiceGroup: {
            select: { invoiceNumber: true, id: true },
          },
        },
      });
      if (records.length > 0) {
        conflicts.push({
          groupKind: "invoice",
          groupId: l.groupId,
          groupLabel: records[0].invoiceGroup.invoiceNumber ?? `請求#${l.groupId}`,
          manualRecords: records.map((r) => ({
            id: r.id,
            date: r.receivedDate.toISOString().slice(0, 10),
            amount: r.amount,
            comment: r.comment,
          })),
        });
      }
    } else {
      const records = await tx.paymentGroupPayment.findMany({
        where: {
          paymentGroupId: l.groupId,
          bankStatementEntryGroupLinkId: null,
        },
        orderBy: { paidDate: "desc" },
        select: {
          id: true,
          paidDate: true,
          amount: true,
          comment: true,
          paymentGroup: {
            select: { referenceCode: true, id: true },
          },
        },
      });
      if (records.length > 0) {
        conflicts.push({
          groupKind: "payment",
          groupId: l.groupId,
          groupLabel: records[0].paymentGroup.referenceCode ?? `支払#${l.groupId}`,
          manualRecords: records.map((r) => ({
            id: r.id,
            date: r.paidDate.toISOString().slice(0, 10),
            amount: r.amount,
            comment: r.comment,
          })),
        });
      }
    }
  }
  return conflicts;
}

// ============================================
// 候補検索: エントリ視点
// ============================================

export type ListLinkCandidatesInput = {
  entryId: number;
  search?: string;
  limit?: number;
  includeCrossCompany?: boolean;
  includeFeeTargets?: boolean;
};

export async function listLinkCandidatesForEntry(
  input: ListLinkCandidatesInput
): Promise<
  ActionResult<{ direction: GroupKind | null; candidates: LinkCandidate[] }>
> {
  await requireStaffForAccounting("view");
  try {
    const meta = await getEntryDirection(input.entryId);
    if (!meta) return err("取引が見つかりません");
    if (!meta.direction) return ok({ direction: null, candidates: [] });
    if (meta.excluded) return ok({ direction: meta.direction, candidates: [] });

    const limit = Math.min(200, Math.max(20, input.limit ?? 100));
    const search = (input.search ?? "").trim();
    const companyWhere = input.includeCrossCompany
      ? {}
      : { operatingCompanyId: meta.operatingCompanyId };

    if (meta.direction === "invoice") {
      const groups = await prisma.invoiceGroup.findMany({
        where: {
          ...companyWhere,
          deletedAt: null,
          ...(input.includeFeeTargets ? {} : { statementLinkCompleted: false }),
          ...(search
            ? {
                OR: [
                  { invoiceNumber: { contains: search, mode: "insensitive" } },
                  { counterparty: { name: { contains: search, mode: "insensitive" } } },
                ],
              }
            : {}),
        },
        orderBy: [{ invoiceDate: "desc" }, { id: "desc" }],
        take: limit,
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          expectedPaymentDate: true,
          status: true,
          manualPaymentStatus: true,
          statementLinkCompleted: true,
          operatingCompanyId: true,
          operatingCompany: { select: { companyName: true } },
          counterparty: { select: { name: true } },
          bankStatementLinks: {
            where: { linkType: "settlement" },
            select: { amount: true },
          },
        },
      });
      const candidates = groups
        .map((g) => {
          const alreadyLinkedAmount = g.bankStatementLinks.reduce(
            (s, l) => s + l.amount,
            0
          );
          return {
            id: g.id,
            label: g.invoiceNumber ?? `請求#${g.id}`,
            counterpartyName: g.counterparty.name,
            operatingCompanyId: g.operatingCompanyId,
            operatingCompanyName: g.operatingCompany.companyName,
            isCrossCompany: g.operatingCompanyId !== meta.operatingCompanyId,
            totalAmount: g.totalAmount,
            expectedDate: g.expectedPaymentDate
              ? g.expectedPaymentDate.toISOString().slice(0, 10)
              : null,
            status: g.status,
            manualPaymentStatus: g.manualPaymentStatus,
            alreadyLinkedAmount,
            statementLinkCompleted: g.statementLinkCompleted,
          };
        })
        .filter((g) =>
          input.includeFeeTargets ||
          g.totalAmount === null ||
          g.totalAmount - g.alreadyLinkedAmount > 0
        )
        .sort((a, b) => Number(a.isCrossCompany) - Number(b.isCrossCompany));
      return ok({
        direction: "invoice",
        candidates,
      });
    }

    const groups = await prisma.paymentGroup.findMany({
      where: {
      ...companyWhere,
      deletedAt: null,
      ...(input.includeFeeTargets ? {} : { statementLinkCompleted: false }),
        ...(search
          ? {
              OR: [
                { referenceCode: { contains: search, mode: "insensitive" } },
                { customCounterpartyName: { contains: search, mode: "insensitive" } },
                { counterparty: { name: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: [{ expectedPaymentDate: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        referenceCode: true,
        totalAmount: true,
        expectedPaymentDate: true,
        status: true,
        manualPaymentStatus: true,
        statementLinkCompleted: true,
        operatingCompanyId: true,
        operatingCompany: { select: { companyName: true } },
        customCounterpartyName: true,
        counterparty: { select: { name: true } },
        bankStatementLinks: {
          where: { linkType: "settlement" },
          select: { amount: true },
        },
      },
    });
    const candidates = groups
      .map((g) => {
        const alreadyLinkedAmount = g.bankStatementLinks.reduce(
          (s, l) => s + l.amount,
          0
        );
        return {
          id: g.id,
          label: g.referenceCode ?? `支払#${g.id}`,
          counterpartyName:
            g.counterparty?.name ?? g.customCounterpartyName ?? "(取引先未設定)",
          operatingCompanyId: g.operatingCompanyId,
          operatingCompanyName: g.operatingCompany.companyName,
          isCrossCompany: g.operatingCompanyId !== meta.operatingCompanyId,
          totalAmount: g.totalAmount,
          expectedDate: g.expectedPaymentDate
            ? g.expectedPaymentDate.toISOString().slice(0, 10)
            : null,
          status: g.status,
          manualPaymentStatus: g.manualPaymentStatus,
          alreadyLinkedAmount,
          statementLinkCompleted: g.statementLinkCompleted,
        };
      })
      .filter((g) =>
        input.includeFeeTargets ||
        g.totalAmount === null ||
        g.totalAmount - g.alreadyLinkedAmount > 0
      )
      .sort((a, b) => Number(a.isCrossCompany) - Number(b.isCrossCompany));
    return ok({
      direction: "payment",
      candidates,
    });
  } catch (e) {
    console.error("[listLinkCandidatesForEntry] error:", e);
    return err(e instanceof Error ? e.message : "候補取得に失敗しました");
  }
}

// ============================================
// エントリ視点: 既存リンク一覧
// ============================================

export type EntryLinkRow = {
  id: number;
  groupKind: GroupKind;
  groupId: number;
  groupLabel: string;
  counterpartyName: string;
  operatingCompanyName: string | null;
  isCrossCompany: boolean;
  crossCompanyReason: string | null;
  amount: number;
  linkType: StatementLinkType;
  note: string | null;
};

function parseLinkNote(note: string | null): {
  note: string | null;
  crossCompanyReason: string | null;
} {
  if (!note) return { note: null, crossCompanyReason: null };
  const match = note.match(/^\[別法人紐付け: ([^\]]+)\]\s*(.*)$/);
  if (!match) return { note, crossCompanyReason: null };
  return {
    crossCompanyReason: match[1],
    note: match[2]?.trim() || null,
  };
}

export async function listLinksForEntry(
  entryId: number
): Promise<EntryLinkRow[]> {
  await requireStaffForAccounting("view");

  const links = await prisma.bankStatementEntryGroupLink.findMany({
    where: { bankStatementEntryId: entryId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      amount: true,
      linkType: true,
      note: true,
      invoiceGroupId: true,
      paymentGroupId: true,
      bankStatementEntry: { select: { operatingCompanyId: true } },
      invoiceGroup: {
        select: {
          id: true,
          invoiceNumber: true,
          operatingCompanyId: true,
          operatingCompany: { select: { companyName: true } },
          counterparty: { select: { name: true } },
        },
      },
      paymentGroup: {
        select: {
          id: true,
          referenceCode: true,
          operatingCompanyId: true,
          operatingCompany: { select: { companyName: true } },
          customCounterpartyName: true,
          counterparty: { select: { name: true } },
        },
      },
    },
  });

  return links.map((l) => {
    const parsedNote = parseLinkNote(l.note);
    if (l.invoiceGroup) {
      const isCrossCompany =
        l.invoiceGroup.operatingCompanyId !== l.bankStatementEntry.operatingCompanyId;
      return {
        id: l.id,
        groupKind: "invoice" as const,
        groupId: l.invoiceGroup.id,
        groupLabel: l.invoiceGroup.invoiceNumber ?? `請求#${l.invoiceGroup.id}`,
        counterpartyName: l.invoiceGroup.counterparty.name,
        operatingCompanyName: isCrossCompany
          ? l.invoiceGroup.operatingCompany.companyName
          : null,
        isCrossCompany,
        crossCompanyReason: parsedNote.crossCompanyReason,
        amount: l.amount,
        linkType: l.linkType === "fee" ? "fee" : "settlement",
        note: parsedNote.note,
      };
    }
    const isCrossCompany =
      l.paymentGroup!.operatingCompanyId !== l.bankStatementEntry.operatingCompanyId;
    return {
      id: l.id,
      groupKind: "payment" as const,
      groupId: l.paymentGroup!.id,
      groupLabel: l.paymentGroup!.referenceCode ?? `支払#${l.paymentGroup!.id}`,
      counterpartyName:
        l.paymentGroup!.counterparty?.name ??
        l.paymentGroup!.customCounterpartyName ??
        "(取引先未設定)",
      operatingCompanyName: isCrossCompany
        ? l.paymentGroup!.operatingCompany.companyName
        : null,
      isCrossCompany,
      crossCompanyReason: parsedNote.crossCompanyReason,
      amount: l.amount,
      linkType: l.linkType === "fee" ? "fee" : "settlement",
      note: parsedNote.note,
    };
  });
}

// ============================================
// エントリ視点: リンク一括置換 + 自動 receipt/payment 生成
// ============================================

export type ReplaceLinksInput = {
  entryId: number;
  links: {
    groupKind: GroupKind;
    groupId: number;
    amount: number;
    linkType?: StatementLinkType;
    note?: string | null;
    crossCompanyReason?: string | null;
  }[];
  conflictResolution?: ConflictResolution;
};

export type ReplaceLinksResult =
  | { status: "saved"; count: number }
  | { status: "conflicts"; conflicts: LinkConflict[] };

export async function replaceLinksForEntry(
  input: ReplaceLinksInput
): Promise<ActionResult<ReplaceLinksResult>> {
  const session = await requireStaffForAccounting("edit");
  try {
    const meta = await getEntryDirection(input.entryId);
    if (!meta) return err("取引が見つかりません");
    if (!meta.direction) return err("入金/出金が0円のため紐付けできません");
    const entryLinkableError = ensureEntryIsLinkable(meta);
    if (entryLinkableError) return entryLinkableError;

    // バリデーション
    for (const l of input.links) {
      const linkType = l.linkType ?? "settlement";
      if (l.groupKind !== meta.direction) {
        return err(
          meta.direction === "invoice"
            ? "入金取引は請求グループにのみ紐付けできます"
            : "出金取引は支払グループにのみ紐付けできます"
        );
      }
      if (linkType !== "settlement" && linkType !== "fee") {
        return err("紐付け種別が不正です");
      }
      if (!Number.isInteger(l.amount) || l.amount <= 0) {
        return err("金額は1円以上の整数で入力してください");
      }
    }
    const feeLinks = input.links.filter((l) => (l.linkType ?? "settlement") === "fee");
    if (feeLinks.length > 0) {
      if (input.links.length > 1) {
        return err("手数料として紐付ける場合は、入出金履歴1行全体を1つのグループに紐付けてください");
      }
      if (feeLinks[0].amount !== meta.amount) {
        return err("手数料として紐付ける場合は、入出金履歴の全額を指定してください");
      }
    }

    // 分割合計チェック（リンクが0件のときは検証不要）
    if (input.links.length > 0) {
      const sum = input.links.reduce((s, l) => s + l.amount, 0);
      if (sum > meta.amount) {
        return err(
          `紐付け金額の合計（${sum.toLocaleString("ja-JP")}円）が取引金額（${meta.amount.toLocaleString("ja-JP")}円）を超えています`
        );
      }
    }

    // 法人整合性チェック
    const ids = input.links.map((l) => l.groupId);
    if (ids.length > 0) {
      if (meta.direction === "invoice") {
        const found = await prisma.invoiceGroup.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            operatingCompanyId: true,
            totalAmount: true,
            statementLinkCompleted: true,
            bankStatementLinks: {
              where: { bankStatementEntryId: { not: input.entryId }, linkType: "settlement" },
              select: { amount: true },
            },
          },
        });
        if (found.length !== ids.length) return err("一部の請求グループが見つかりません");
        for (const g of found) {
          if (g.operatingCompanyId !== meta.operatingCompanyId) {
            const reason = input.links.find((l) => l.groupId === g.id)?.crossCompanyReason?.trim();
            if (!reason) {
              return err(`請求グループ#${g.id} は別法人のため、別法人紐付け理由を入力してください`);
            }
          }
          const requestedSettlementAmount = input.links
            .filter((link) => link.groupId === g.id && (link.linkType ?? "settlement") === "settlement")
            .reduce((sum, link) => sum + link.amount, 0);
          if (g.statementLinkCompleted && requestedSettlementAmount > 0) {
            return err(`請求グループ#${g.id} は入出金履歴チェック完了済みのため紐付けできません`);
          }
          if (g.totalAmount !== null) {
            const linkedWithoutThisEntry = g.bankStatementLinks.reduce((sum, link) => sum + link.amount, 0);
            if (linkedWithoutThisEntry + requestedSettlementAmount > g.totalAmount) {
              return err(`請求グループ#${g.id} の残り紐付け可能額を超えています`);
            }
          }
        }
      } else {
        const found = await prisma.paymentGroup.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            operatingCompanyId: true,
            totalAmount: true,
            statementLinkCompleted: true,
            bankStatementLinks: {
              where: { bankStatementEntryId: { not: input.entryId }, linkType: "settlement" },
              select: { amount: true },
            },
          },
        });
        if (found.length !== ids.length) return err("一部の支払グループが見つかりません");
        for (const g of found) {
          if (g.operatingCompanyId !== meta.operatingCompanyId) {
            const reason = input.links.find((l) => l.groupId === g.id)?.crossCompanyReason?.trim();
            if (!reason) {
              return err(`支払グループ#${g.id} は別法人のため、別法人紐付け理由を入力してください`);
            }
          }
          const requestedSettlementAmount = input.links
            .filter((link) => link.groupId === g.id && (link.linkType ?? "settlement") === "settlement")
            .reduce((sum, link) => sum + link.amount, 0);
          if (g.statementLinkCompleted && requestedSettlementAmount > 0) {
            return err(`支払グループ#${g.id} は入出金履歴チェック完了済みのため紐付けできません`);
          }
          if (g.totalAmount !== null) {
            const linkedWithoutThisEntry = g.bankStatementLinks.reduce((sum, link) => sum + link.amount, 0);
            if (linkedWithoutThisEntry + requestedSettlementAmount > g.totalAmount) {
              return err(`支払グループ#${g.id} の残り紐付け可能額を超えています`);
            }
          }
        }
      }
    }

    // 衝突検出（解決策が指定されていない場合のみ）
    if (input.links.length > 0 && !input.conflictResolution) {
      const conflicts = await detectManualConflicts(
        prisma,
        input.links.filter((l) => (l.linkType ?? "settlement") === "settlement")
      );
      if (conflicts.length > 0) {
        return ok({ status: "conflicts" as const, conflicts });
      }
    }

    const existingLinks = await prisma.bankStatementEntryGroupLink.findMany({
      where: { bankStatementEntryId: input.entryId },
      select: { id: true, invoiceGroupId: true, paymentGroupId: true },
    });

    // 保存
    await prisma.$transaction(async (tx) => {
      const affectedGroups = new Map<GroupKind, Set<number>>([
        ["invoice", new Set<number>()],
        ["payment", new Set<number>()],
      ]);
      for (const link of existingLinks) {
        addAffectedGroup(affectedGroups, "invoice", link.invoiceGroupId);
        addAffectedGroup(affectedGroups, "payment", link.paymentGroupId);
      }

      await detachManualRecordsForLinks(tx, existingLinks.map((link) => link.id));

      // 既存リンクを削除。自動生成されたreceipt/paymentだけcascadeで消える
      await tx.bankStatementEntryGroupLink.deleteMany({
        where: { bankStatementEntryId: input.entryId },
      });

      // overwriteの場合: 対象グループの手動 receipt/payment も削除
      if (input.conflictResolution === "overwrite") {
        for (const l of input.links.filter((link) => (link.linkType ?? "settlement") === "settlement")) {
          if (l.groupKind === "invoice") {
            await tx.invoiceGroupReceipt.deleteMany({
              where: {
                invoiceGroupId: l.groupId,
                bankStatementEntryGroupLinkId: null,
              },
            });
          } else {
            await tx.paymentGroupPayment.deleteMany({
              where: {
                paymentGroupId: l.groupId,
                bankStatementEntryGroupLinkId: null,
              },
            });
          }
        }
      }

      // リンク作成 + receipt/payment 自動生成
      for (const l of input.links) {
        const linkType = l.linkType ?? "settlement";
        const note = buildLinkNote(l.note, l.crossCompanyReason);
        const link = await tx.bankStatementEntryGroupLink.create({
          data: {
            bankStatementEntryId: input.entryId,
            invoiceGroupId: l.groupKind === "invoice" ? l.groupId : null,
            paymentGroupId: l.groupKind === "payment" ? l.groupId : null,
            amount: l.amount,
            linkType,
            note,
            createdBy: session.id,
          },
        });
        if (linkType === "fee") {
          addAffectedGroup(affectedGroups, l.groupKind, l.groupId);
          continue;
        }
        if (l.groupKind === "invoice") {
          await tx.invoiceGroupReceipt.create({
            data: {
              invoiceGroupId: l.groupId,
              receivedDate: meta.transactionDate,
              amount: l.amount,
              comment: note,
              recordSource: "bank_statement",
              createdById: session.id,
              bankStatementEntryGroupLinkId: link.id,
            },
          });
        } else {
          await tx.paymentGroupPayment.create({
            data: {
              paymentGroupId: l.groupId,
              paidDate: meta.transactionDate,
              amount: l.amount,
              comment: note,
              recordSource: "bank_statement",
              createdById: session.id,
              bankStatementEntryGroupLinkId: link.id,
            },
          });
        }
        addAffectedGroup(affectedGroups, l.groupKind, l.groupId);
      }

      for (const invoiceGroupId of affectedGroups.get("invoice") ?? []) {
        await recalcStatementCheckAndSyncPaymentState(tx, "invoice", invoiceGroupId);
      }
      for (const paymentGroupId of affectedGroups.get("payment") ?? []) {
        await recalcStatementCheckAndSyncPaymentState(tx, "payment", paymentGroupId);
      }
    });

    revalidatePath("/accounting/statements");
    revalidatePath("/accounting/workflow");
    revalidatePath("/stp/finance/invoices");
    revalidatePath("/stp/finance/payment-groups");
    return ok({ status: "saved" as const, count: input.links.length });
  } catch (e) {
    console.error("[replaceLinksForEntry] error:", e);
    return err(e instanceof Error ? e.message : "紐付けの保存に失敗しました");
  }
}

// ============================================
// グループ視点: 既存リンク一覧
// ============================================

export type GroupLinkRow = {
  id: number;
  entryId: number;
  transactionDate: string;
  description: string;
  incomingAmount: number | null;
  outgoingAmount: number | null;
  amount: number;
  linkType: StatementLinkType;
  note: string | null;
  bankAccountLabel: string;
};

export async function listLinksForGroup(
  groupKind: GroupKind,
  groupId: number
): Promise<GroupLinkRow[]> {
  await requireStaffForAccounting("view");

  const links = await prisma.bankStatementEntryGroupLink.findMany({
    where:
      groupKind === "invoice"
        ? { invoiceGroupId: groupId }
        : { paymentGroupId: groupId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      amount: true,
      linkType: true,
      note: true,
      bankStatementEntry: {
        select: {
          id: true,
          transactionDate: true,
          description: true,
          incomingAmount: true,
          outgoingAmount: true,
          bankAccount: {
            select: { bankName: true, branchName: true, accountNumber: true },
          },
        },
      },
    },
  });

  return links.map((l) => ({
    id: l.id,
    entryId: l.bankStatementEntry.id,
    transactionDate: l.bankStatementEntry.transactionDate.toISOString().slice(0, 10),
    description: l.bankStatementEntry.description,
    incomingAmount: l.bankStatementEntry.incomingAmount,
    outgoingAmount: l.bankStatementEntry.outgoingAmount,
    amount: l.amount,
    linkType: l.linkType === "fee" ? "fee" : "settlement",
    note: l.note,
    bankAccountLabel: `${l.bankStatementEntry.bankAccount.bankName} ${l.bankStatementEntry.bankAccount.branchName} ${l.bankStatementEntry.bankAccount.accountNumber}`,
  }));
}

// ============================================
// グループ視点: 候補となるエントリ検索
// ============================================

export type ListEntryCandidatesInput = {
  groupKind: GroupKind;
  groupId: number;
  search?: string;
  limit?: number;
};

export type EntryCandidate = {
  id: number;
  transactionDate: string;
  description: string;
  amount: number;
  balance: number | null;
  bankAccountLabel: string;
  alreadyLinkedAmount: number;
};

export async function listEntryCandidatesForGroup(
  input: ListEntryCandidatesInput
): Promise<ActionResult<EntryCandidate[]>> {
  await requireStaffForAccounting("view");
  try {
    let operatingCompanyId: number;
    if (input.groupKind === "invoice") {
      const g = await prisma.invoiceGroup.findUnique({
        where: { id: input.groupId },
        select: { operatingCompanyId: true, statementLinkCompleted: true },
      });
      if (!g) return err("請求グループが見つかりません");
      if (g.statementLinkCompleted) return ok([]);
      operatingCompanyId = g.operatingCompanyId;
    } else {
      const g = await prisma.paymentGroup.findUnique({
        where: { id: input.groupId },
        select: { operatingCompanyId: true, statementLinkCompleted: true },
      });
      if (!g) return err("支払グループが見つかりません");
      if (g.statementLinkCompleted) return ok([]);
      operatingCompanyId = g.operatingCompanyId;
    }

    const limit = Math.min(200, Math.max(20, input.limit ?? 100));
    const search = (input.search ?? "").trim();

    const entries = await prisma.bankStatementEntry.findMany({
      where: {
        operatingCompanyId,
        excluded: false,
        ...(input.groupKind === "invoice"
          ? { incomingAmount: { gt: 0 } }
          : { outgoingAmount: { gt: 0 } }),
        ...(search
          ? { description: { contains: search, mode: "insensitive" } }
          : {}),
      },
      orderBy: [{ transactionDate: "desc" }, { rowOrder: "desc" }],
      take: limit,
      select: {
        id: true,
        transactionDate: true,
        description: true,
        incomingAmount: true,
        outgoingAmount: true,
        balance: true,
        bankAccount: {
          select: { bankName: true, branchName: true, accountNumber: true },
        },
        groupLinks: { select: { amount: true, linkType: true } },
      },
    });

    return ok(
      entries.map((e) => ({
        id: e.id,
        transactionDate: e.transactionDate.toISOString().slice(0, 10),
        description: e.description,
        amount:
          input.groupKind === "invoice"
            ? e.incomingAmount ?? 0
            : e.outgoingAmount ?? 0,
        balance: e.balance,
        bankAccountLabel: `${e.bankAccount.bankName} ${e.bankAccount.branchName} ${e.bankAccount.accountNumber}`,
        alreadyLinkedAmount: summarizeStatementLinks(e.groupLinks).allocatedAmount,
      }))
    );
  } catch (e) {
    console.error("[listEntryCandidatesForGroup] error:", e);
    return err(e instanceof Error ? e.message : "候補取得に失敗しました");
  }
}

// ============================================
// グループ視点: リンク追加（衝突解決オプション付き）
// ============================================

export type AddLinkInput = {
  groupKind: GroupKind;
  groupId: number;
  entryId: number;
  amount: number;
  linkType?: StatementLinkType;
  note?: string | null;
  conflictResolution?: ConflictResolution;
};

export type AddLinkResult =
  | { status: "saved"; id: number }
  | { status: "conflicts"; conflicts: LinkConflict[] };

export async function addLinkFromGroup(
  input: AddLinkInput
): Promise<ActionResult<AddLinkResult>> {
  const session = await requireStaffForAccounting("edit");
  try {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      return err("金額は1円以上の整数で入力してください");
    }
    const linkType = input.linkType ?? "settlement";
    if (linkType !== "settlement" && linkType !== "fee") {
      return err("紐付け種別が不正です");
    }
    const meta = await getEntryDirection(input.entryId);
    if (!meta) return err("取引が見つかりません");
    if (!meta.direction) return err("入金/出金が0円のため紐付けできません");
    const entryLinkableError = ensureEntryIsLinkable(meta);
    if (entryLinkableError) return entryLinkableError;
    if (meta.direction !== input.groupKind) {
      return err(
        input.groupKind === "invoice"
          ? "出金取引は請求グループに紐付けできません"
          : "入金取引は支払グループに紐付けできません"
      );
    }

    const groupMeta =
      input.groupKind === "invoice"
        ? (
            await prisma.invoiceGroup.findUnique({
              where: { id: input.groupId },
              select: {
                operatingCompanyId: true,
                statementLinkCompleted: true,
                totalAmount: true,
                bankStatementLinks: {
                  where: { linkType: "settlement" },
                  select: { amount: true },
                },
              },
            })
          )
        : (
            await prisma.paymentGroup.findUnique({
              where: { id: input.groupId },
              select: {
                operatingCompanyId: true,
                statementLinkCompleted: true,
                totalAmount: true,
                bankStatementLinks: {
                  where: { linkType: "settlement" },
                  select: { amount: true },
                },
              },
            })
          );
    if (!groupMeta) return err("グループが見つかりません");
    if (groupMeta.operatingCompanyId !== meta.operatingCompanyId) {
      return err("法人が一致しないため紐付けできません");
    }
    if (groupMeta.statementLinkCompleted && linkType === "settlement") {
      return err("入出金履歴チェック完了済みのグループには紐付けを追加できません");
    }
    if (linkType === "fee" && input.amount !== meta.amount) {
      return err("手数料として紐付ける場合は、入出金履歴の全額を指定してください");
    }
    if (groupMeta.totalAmount !== null && linkType === "settlement") {
      const groupLinkedAmount = groupMeta.bankStatementLinks.reduce(
        (sum, link) => sum + link.amount,
        0
      );
      if (groupLinkedAmount + input.amount > groupMeta.totalAmount) {
        return err("グループの残り紐付け可能額を超えています");
      }
    }

    // 取引の合計が割当超過にならないかチェック
    const existingLinkSum = await prisma.bankStatementEntryGroupLink.aggregate({
      where: { bankStatementEntryId: input.entryId },
      _sum: { amount: true },
    });
    const alreadyAllocated = existingLinkSum._sum.amount ?? 0;
    if (alreadyAllocated + input.amount > meta.amount) {
      return err(
        `この取引には既に${alreadyAllocated.toLocaleString("ja-JP")}円が割り当てられており、追加${input.amount.toLocaleString("ja-JP")}円では合計${(alreadyAllocated + input.amount).toLocaleString("ja-JP")}円となり取引金額${meta.amount.toLocaleString("ja-JP")}円を超えます`
      );
    }

    // 衝突検出（解決策が指定されていない場合）
    if (!input.conflictResolution && linkType === "settlement") {
      const conflicts = await detectManualConflicts(prisma, [
        { groupKind: input.groupKind, groupId: input.groupId },
      ]);
      if (conflicts.length > 0) {
        return ok({ status: "conflicts" as const, conflicts });
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      if (input.conflictResolution === "overwrite") {
        if (input.groupKind === "invoice") {
          await tx.invoiceGroupReceipt.deleteMany({
            where: {
              invoiceGroupId: input.groupId,
              bankStatementEntryGroupLinkId: null,
            },
          });
        } else {
          await tx.paymentGroupPayment.deleteMany({
            where: {
              paymentGroupId: input.groupId,
              bankStatementEntryGroupLinkId: null,
            },
          });
        }
      }

      const link = await tx.bankStatementEntryGroupLink.create({
        data: {
          bankStatementEntryId: input.entryId,
          invoiceGroupId: input.groupKind === "invoice" ? input.groupId : null,
          paymentGroupId: input.groupKind === "payment" ? input.groupId : null,
          amount: input.amount,
          linkType,
          note: input.note ?? null,
          createdBy: session.id,
        },
      });

      if (linkType === "fee") {
        await recalcStatementCheckAndSyncPaymentState(tx, input.groupKind, input.groupId);
        return link;
      }

      if (input.groupKind === "invoice") {
        await tx.invoiceGroupReceipt.create({
          data: {
            invoiceGroupId: input.groupId,
            receivedDate: meta.transactionDate,
            amount: input.amount,
            comment: input.note ?? null,
            recordSource: "bank_statement",
            createdById: session.id,
            bankStatementEntryGroupLinkId: link.id,
          },
        });
      } else {
        await tx.paymentGroupPayment.create({
          data: {
            paymentGroupId: input.groupId,
            paidDate: meta.transactionDate,
            amount: input.amount,
            comment: input.note ?? null,
            recordSource: "bank_statement",
            createdById: session.id,
            bankStatementEntryGroupLinkId: link.id,
          },
        });
      }

      await recalcStatementCheckAndSyncPaymentState(tx, input.groupKind, input.groupId);
      return link;
    });

    revalidatePath("/accounting/statements");
    revalidatePath("/accounting/workflow");
    revalidatePath("/stp/finance/invoices");
    revalidatePath("/stp/finance/payment-groups");
    return ok({ status: "saved" as const, id: created.id });
  } catch (e) {
    console.error("[addLinkFromGroup] error:", e);
    return err(e instanceof Error ? e.message : "紐付け追加に失敗しました");
  }
}

export async function attachExistingRecordToStatementEntry(input: {
  groupKind: GroupKind;
  groupId: number;
  recordId: number;
  entryId: number;
}): Promise<ActionResult<void>> {
  const session = await requireStaffForAccounting("edit");
  try {
    const meta = await getEntryDirection(input.entryId);
    if (!meta) return err("取引が見つかりません");
    if (!meta.direction) return err("入金/出金が0円のため紐付けできません");
    const entryLinkableError = ensureEntryIsLinkable(meta);
    if (entryLinkableError) return entryLinkableError;
    if (meta.direction !== input.groupKind) {
      return err(
        input.groupKind === "invoice"
          ? "出金取引は請求グループに紐付けできません"
          : "入金取引は支払グループに紐付けできません"
      );
    }

    const groupCompanyId =
      input.groupKind === "invoice"
        ? (
            await prisma.invoiceGroup.findUnique({
              where: { id: input.groupId },
              select: { operatingCompanyId: true, statementLinkCompleted: true },
            })
          )?.operatingCompanyId
        : (
            await prisma.paymentGroup.findUnique({
              where: { id: input.groupId },
              select: { operatingCompanyId: true, statementLinkCompleted: true },
            })
          )?.operatingCompanyId;
    if (!groupCompanyId) return err("グループが見つかりません");
    if (groupCompanyId !== meta.operatingCompanyId) {
      return err("法人が一致しないため紐付けできません");
    }
    const group =
      input.groupKind === "invoice"
        ? await prisma.invoiceGroup.findUnique({
            where: { id: input.groupId },
            select: { statementLinkCompleted: true },
          })
        : await prisma.paymentGroup.findUnique({
            where: { id: input.groupId },
            select: { statementLinkCompleted: true },
          });
    if (group?.statementLinkCompleted) {
      return err("入出金履歴チェック完了済みのグループには紐付けを追加できません");
    }

    const record =
      input.groupKind === "invoice"
        ? await prisma.invoiceGroupReceipt.findFirst({
            where: {
              id: input.recordId,
              invoiceGroupId: input.groupId,
            },
            select: {
              id: true,
              amount: true,
              comment: true,
              recordSource: true,
              bankStatementEntryGroupLinkId: true,
            },
          })
        : await prisma.paymentGroupPayment.findFirst({
            where: {
              id: input.recordId,
              paymentGroupId: input.groupId,
            },
            select: {
              id: true,
              amount: true,
              comment: true,
              recordSource: true,
              bankStatementEntryGroupLinkId: true,
            },
          });
    if (!record) return err("記録が見つかりません");
    if (record.bankStatementEntryGroupLinkId !== null) {
      return err("この記録は既に入出金履歴に紐付いています");
    }
    if (record.recordSource !== "manual") {
      return err("手動で作成された記録のみ、入出金履歴へ後付け紐付けできます");
    }

    const existingLinkSum = await prisma.bankStatementEntryGroupLink.aggregate({
      where: { bankStatementEntryId: input.entryId },
      _sum: { amount: true },
    });
    const alreadyAllocated = existingLinkSum._sum.amount ?? 0;
    if (alreadyAllocated + record.amount > meta.amount) {
      return err(
        `この取引には既に${alreadyAllocated.toLocaleString("ja-JP")}円が割り当てられており、記録金額${record.amount.toLocaleString("ja-JP")}円を紐付けると取引金額${meta.amount.toLocaleString("ja-JP")}円を超えます`
      );
    }

    await prisma.$transaction(async (tx) => {
      const link = await tx.bankStatementEntryGroupLink.create({
        data: {
          bankStatementEntryId: input.entryId,
          invoiceGroupId: input.groupKind === "invoice" ? input.groupId : null,
          paymentGroupId: input.groupKind === "payment" ? input.groupId : null,
          amount: record.amount,
          linkType: "settlement",
          note: record.comment,
          createdBy: session.id,
        },
      });

      if (input.groupKind === "invoice") {
        await tx.invoiceGroupReceipt.update({
          where: { id: input.recordId },
          data: {
            receivedDate: meta.transactionDate,
            bankStatementEntryGroupLinkId: link.id,
          },
        });
      } else {
        await tx.paymentGroupPayment.update({
          where: { id: input.recordId },
          data: {
            paidDate: meta.transactionDate,
            bankStatementEntryGroupLinkId: link.id,
          },
        });
      }

      await recalcStatementCheckAndSyncPaymentState(tx, input.groupKind, input.groupId);
    });

    revalidatePath("/accounting/statements");
    revalidatePath("/accounting/workflow");
    revalidatePath("/stp/finance/invoices");
    revalidatePath("/stp/finance/payment-groups");
    return ok();
  } catch (e) {
    console.error("[attachExistingRecordToStatementEntry] error:", e);
    return err(e instanceof Error ? e.message : "記録への紐付けに失敗しました");
  }
}

// ============================================
// リンク削除
// ============================================

export async function deleteLink(
  linkId: number
): Promise<ActionResult<void>> {
  await requireStaffForAccounting("edit");
  try {
    // 削除前にどのグループに紐付いていたかを取得
    const link = await prisma.bankStatementEntryGroupLink.findUnique({
      where: { id: linkId },
      select: {
        invoiceGroupId: true,
        paymentGroupId: true,
        invoiceReceipt: { select: { id: true } },
        paymentRecord: { select: { id: true } },
      },
    });
    if (!link) return err("紐付けが見つかりません");

    await prisma.$transaction(async (tx) => {
      await detachManualRecordsForLinks(tx, [linkId]);

      await tx.bankStatementEntryGroupLink.delete({ where: { id: linkId } });

      if (link.invoiceGroupId) {
        await recalcStatementCheckAndSyncPaymentState(tx, "invoice", link.invoiceGroupId);
      }
      if (link.paymentGroupId) {
        await recalcStatementCheckAndSyncPaymentState(tx, "payment", link.paymentGroupId);
      }
    });

    revalidatePath("/accounting/statements");
    revalidatePath("/accounting/workflow");
    revalidatePath("/stp/finance/invoices");
    revalidatePath("/stp/finance/payment-groups");
    return ok();
  } catch (e) {
    console.error("[deleteLink] error:", e);
    return err(e instanceof Error ? e.message : "紐付け削除に失敗しました");
  }
}

// ============================================
// グループ「紐付け完了」フラグ取得
// ============================================

export async function getGroupStatementLinkCompleted(
  groupKind: GroupKind,
  groupId: number
): Promise<boolean> {
  await requireStaffForAccounting("view");
  if (groupKind === "invoice") {
    const g = await prisma.invoiceGroup.findUnique({
      where: { id: groupId },
      select: { statementLinkCompleted: true },
    });
    return g?.statementLinkCompleted ?? false;
  }
  const g = await prisma.paymentGroup.findUnique({
    where: { id: groupId },
    select: { statementLinkCompleted: true },
  });
  return g?.statementLinkCompleted ?? false;
}

export type StatementLinkCompletionCheck = {
  linkCount: number;
  linkedAmount: number;
  settlementAmount: number;
  feeAmount: number;
  allocatedAmount: number;
  recordAmount: number;
  canComplete: boolean;
  warnings: string[];
};

export async function getGroupStatementLinkCompletionCheck(
  groupKind: GroupKind,
  groupId: number
): Promise<ActionResult<StatementLinkCompletionCheck>> {
  await requireStaffForAccounting("view");
  try {
    const label = groupKind === "invoice" ? "入金" : "支払";
    if (groupKind === "invoice") {
      const group = await prisma.invoiceGroup.findFirst({
        where: { id: groupId, deletedAt: null },
        select: {
          receipts: { select: { amount: true } },
          bankStatementLinks: { select: { amount: true, linkType: true } },
        },
      });
      if (!group) return err("請求グループが見つかりません");
      const summary = summarizeStatementLinks(group.bankStatementLinks);
      const recordAmount = group.receipts.reduce((sum, r) => sum + r.amount, 0);
      const warnings = buildStatementCompletionWarnings(label, summary, recordAmount);
      return ok({
        linkCount: summary.linkCount,
        linkedAmount: summary.settlementAmount,
        settlementAmount: summary.settlementAmount,
        feeAmount: summary.feeAmount,
        allocatedAmount: summary.allocatedAmount,
        recordAmount,
        canComplete: warnings.length === 0,
        warnings,
      });
    }

    const group = await prisma.paymentGroup.findFirst({
      where: { id: groupId, deletedAt: null },
      select: {
        payments: { select: { amount: true } },
        bankStatementLinks: { select: { amount: true, linkType: true } },
      },
    });
    if (!group) return err("支払グループが見つかりません");
    const summary = summarizeStatementLinks(group.bankStatementLinks);
    const recordAmount = group.payments.reduce((sum, p) => sum + p.amount, 0);
    const warnings = buildStatementCompletionWarnings(label, summary, recordAmount);
    return ok({
      linkCount: summary.linkCount,
      linkedAmount: summary.settlementAmount,
      settlementAmount: summary.settlementAmount,
      feeAmount: summary.feeAmount,
      allocatedAmount: summary.allocatedAmount,
      recordAmount,
      canComplete: warnings.length === 0,
      warnings,
    });
  } catch (e) {
    console.error("[getGroupStatementLinkCompletionCheck] error:", e);
    return err(e instanceof Error ? e.message : "入出金履歴チェック条件の確認に失敗しました");
  }
}

// ============================================
// グループ「紐付け完了」フラグ切替
// ============================================

export async function toggleGroupStatementLinkCompleted(input: {
  groupKind: GroupKind;
  groupId: number;
  completed: boolean;
}): Promise<ActionResult<void>> {
  await requireStaffForAccounting("edit");
  try {
    if (input.completed) {
      const check = await getGroupStatementLinkCompletionCheck(input.groupKind, input.groupId);
      if (!check.ok) return check;
      if (!check.data.canComplete) {
        return err(check.data.warnings.join("\n"));
      }
    }

    await prisma.$transaction(async (tx) => {
      await syncPaymentStateAfterStatementCheckChange(
        tx,
        input.groupKind,
        input.groupId,
        input.completed
      );
    });
    revalidatePath("/accounting/statements");
    revalidatePath("/accounting/workflow");
    revalidatePath("/stp/finance/invoices");
    revalidatePath("/stp/finance/payment-groups");
    return ok();
  } catch (e) {
    console.error("[toggleGroupStatementLinkCompleted] error:", e);
    return err(
      e instanceof Error ? e.message : "完了状態の更新に失敗しました"
    );
  }
}
