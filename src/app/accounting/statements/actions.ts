"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";
import {
  recalcInvoiceGroupActualPaymentDate,
  recalcPaymentGroupActualPaymentDate,
  syncInvoiceGroupPaymentStateFromRecords,
  syncPaymentGroupPaymentStateFromRecords,
} from "@/lib/accounting/sync-payment-date";
import { attachDedupHashes } from "@/lib/accounting/statements/dedup";
import type { ParsedStatementEntry } from "@/lib/accounting/statements/types";
import { EXCLUDED_REASONS, type ExcludedReason } from "./constants";

export type StatementCompanyOption = {
  id: number;
  name: string;
  bankAccounts: {
    id: number;
    bankName: string;
    branchName: string;
    accountNumber: string;
    accountType: string;
    accountHolderName: string;
  }[];
};

/**
 * 法人 → 銀行口座のドロップダウン用データ。
 * 論理削除済み口座は除外。法人は isActive のみ。
 */
export async function listStatementCompanyOptions(): Promise<
  StatementCompanyOption[]
> {
  await requireStaffForAccounting("view");

  const companies = await prisma.operatingCompany.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    select: {
      id: true,
      companyName: true,
      bankAccounts: {
        where: { deletedAt: null },
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
        select: {
          id: true,
          bankName: true,
          branchName: true,
          accountNumber: true,
          accountType: true,
          accountHolderName: true,
        },
      },
    },
  });

  return companies.map((c) => ({
    id: c.id,
    name: c.companyName,
    bankAccounts: c.bankAccounts.map((b) => ({
      id: b.id,
      bankName: b.bankName,
      branchName: b.branchName,
      accountNumber: b.accountNumber,
      accountType: b.accountType,
      accountHolderName: b.accountHolderName,
    })),
  }));
}

/**
 * 行の紐付け状態
 *  - "excluded": 経理が「紐付け不要」とマークした取引（除外）
 *  - "unlinked": リンク0件（または取引額0）
 *  - "partial": リンクあるが合計が取引額未満
 *  - "complete": リンク合計 = 取引額
 *  - "skip": 入金/出金とも0円（手数料逆引き等の極稀ケース、紐付け不要）
 */
export type LinkStatus = "excluded" | "unlinked" | "partial" | "complete" | "skip";

export type StatementEntryRow = {
  id: number;
  transactionDate: string; // ISO YYYY-MM-DD
  description: string;
  incomingAmount: number | null;
  outgoingAmount: number | null;
  balance: number | null;
  csvMemo: string | null;
  staffMemo: string | null;
  importId: number;
  importFileName: string;
  importFormatId: string;
  importedAt: string; // ISO
  linkCount: number; // 紐付け中のグループ数
  linkedAmount: number; // 紐付け済み金額の合計
  linkStatus: LinkStatus;
  excluded: boolean;
  excludedReason: ExcludedReason | null;
  excludedNote: string | null;
};

export type LinkStatusFilter = "all" | "unlinked" | "partial" | "complete" | "excluded";

export type ListEntriesInput = {
  operatingCompanyBankAccountId: number;
  page?: number;
  pageSize?: number;
  linkStatus?: LinkStatusFilter;
  from?: string | null; // ISO YYYY-MM-DD
  to?: string | null;
  q?: string | null;
};

export type LinkStatusCounts = {
  all: number;
  unlinked: number;
  partial: number;
  complete: number;
  excluded: number;
};

export type ListEntriesResult = {
  rows: StatementEntryRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: LinkStatusCounts;
};

export type AddManualStatementEntryInput = {
  operatingCompanyId: number;
  operatingCompanyBankAccountId: number;
  transactionDate: string;
  description: string;
  incomingAmount?: number | null;
  outgoingAmount?: number | null;
  balance?: number | null;
  csvMemo?: string | null;
};

function computeLinkStatus(
  incoming: number | null,
  outgoing: number | null,
  linkedAmount: number,
  excluded: boolean
): LinkStatus {
  if (excluded) return "excluded";
  const total = (incoming ?? 0) > 0 ? incoming! : (outgoing ?? 0) > 0 ? outgoing! : 0;
  if (total === 0) return "skip";
  if (linkedAmount === 0) return "unlinked";
  if (linkedAmount >= total) return "complete";
  return "partial";
}

function buildSearchWhere(
  operatingCompanyBankAccountId: number,
  from: string | null | undefined,
  to: string | null | undefined,
  q: string | null | undefined
): Prisma.BankStatementEntryWhereInput {
  const where: Prisma.BankStatementEntryWhereInput = {
    operatingCompanyBankAccountId,
  };
  if (from || to) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      // 終端は含む（その日の23:59:59.999まで）
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      dateFilter.lte = t;
    }
    where.transactionDate = dateFilter;
  }
  if (q && q.trim().length > 0) {
    const term = q.trim();
    where.OR = [
      { description: { contains: term, mode: "insensitive" } },
      { csvMemo: { contains: term, mode: "insensitive" } },
      { staffMemo: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listStatementEntries(
  input: ListEntriesInput
): Promise<ListEntriesResult> {
  await requireStaffForAccounting("view");

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(500, Math.max(10, input.pageSize ?? 100));
  const filter: LinkStatusFilter = input.linkStatus ?? "all";

  const baseWhere = buildSearchWhere(
    input.operatingCompanyBankAccountId,
    input.from,
    input.to,
    input.q
  );

  const allEntriesForCount = await prisma.bankStatementEntry.findMany({
    where: baseWhere,
    select: {
      id: true,
      incomingAmount: true,
      outgoingAmount: true,
      excluded: true,
      groupLinks: { select: { amount: true } },
    },
  });

  const counts: LinkStatusCounts = {
    all: 0,
    unlinked: 0,
    partial: 0,
    complete: 0,
    excluded: 0,
  };
  for (const e of allEntriesForCount) {
    const linkedSum = e.groupLinks.reduce((s, l) => s + l.amount, 0);
    const status = computeLinkStatus(
      e.incomingAmount,
      e.outgoingAmount,
      linkedSum,
      e.excluded
    );
    if (status === "skip") continue;
    if (status === "excluded") {
      counts.excluded++;
      continue;
    }
    counts.all++;
    if (status === "unlinked") counts.unlinked++;
    else if (status === "partial") counts.partial++;
    else if (status === "complete") counts.complete++;
  }

  const eligibleIds: number[] = [];
  for (const e of allEntriesForCount) {
    const linkedSum = e.groupLinks.reduce((s, l) => s + l.amount, 0);
    const status = computeLinkStatus(
      e.incomingAmount,
      e.outgoingAmount,
      linkedSum,
      e.excluded
    );
    if (filter === "all") {
      // 「すべて」表示時は除外行を含めない（excluded タブで別表示）
      if (status === "excluded") continue;
      eligibleIds.push(e.id);
    } else if (filter === status) {
      eligibleIds.push(e.id);
    }
  }

  const total = eligibleIds.length;

  const rowsRaw = await prisma.bankStatementEntry.findMany({
    where: {
      id: { in: eligibleIds },
    },
    orderBy: [{ transactionDate: "desc" }, { rowOrder: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      transactionDate: true,
      description: true,
      incomingAmount: true,
      outgoingAmount: true,
      balance: true,
      csvMemo: true,
      staffMemo: true,
      importId: true,
      excluded: true,
      excludedReason: true,
      excludedNote: true,
      import: {
        select: { fileName: true, bankFormatId: true, importedAt: true },
      },
      groupLinks: { select: { amount: true } },
    },
  });

  return {
    rows: rowsRaw.map((r) => {
      const linkedAmount = r.groupLinks.reduce((s, l) => s + l.amount, 0);
      return {
        id: r.id,
        transactionDate: r.transactionDate.toISOString().slice(0, 10),
        description: r.description,
        incomingAmount: r.incomingAmount,
        outgoingAmount: r.outgoingAmount,
        balance: r.balance,
        csvMemo: r.csvMemo,
        staffMemo: r.staffMemo,
        importId: r.importId,
        importFileName: r.import.fileName,
        importFormatId: r.import.bankFormatId,
        importedAt: r.import.importedAt.toISOString(),
        linkCount: r.groupLinks.length,
        linkedAmount,
        linkStatus: computeLinkStatus(
          r.incomingAmount,
          r.outgoingAmount,
          linkedAmount,
          r.excluded
        ),
        excluded: r.excluded,
        excludedReason: (r.excludedReason as ExcludedReason | null) ?? null,
        excludedNote: r.excludedNote,
      };
    }),
    total,
    page,
    pageSize,
    counts,
  };
}

/**
 * 取引を「除外（紐付け不要）」マーク。
 * 紐付けが既にある場合は除外不可（先に解除を促す）。
 */
export async function markEntryExcluded(
  entryId: number,
  reason: ExcludedReason,
  note?: string | null
): Promise<ActionResult<void>> {
  await requireStaffForAccounting("edit");
  try {
    const session = await getSession();
    const staffId = session.id;
    if (!(EXCLUDED_REASONS as readonly string[]).includes(reason)) {
      return err("除外理由が不正です");
    }
    const entry = await prisma.bankStatementEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        groupLinks: { select: { id: true } },
      },
    });
    if (!entry) return err("取引が見つかりません");
    if (entry.groupLinks.length > 0) {
      return err("紐付けがあるため除外できません。先に紐付けを解除してください");
    }
    await prisma.bankStatementEntry.update({
      where: { id: entryId },
      data: {
        excluded: true,
        excludedReason: reason,
        excludedNote: note?.trim() || null,
        excludedAt: new Date(),
        excludedBy: staffId,
      },
    });
    revalidatePath("/accounting/statements");
    revalidatePath("/stp/finance/invoices");
    revalidatePath("/stp/finance/payment-groups");
    return ok();
  } catch (e) {
    console.error("[markEntryExcluded] error:", e);
    return err(e instanceof Error ? e.message : "除外マークの設定に失敗しました");
  }
}

export async function unmarkEntryExcluded(
  entryId: number
): Promise<ActionResult<void>> {
  await requireStaffForAccounting("edit");
  try {
    await prisma.bankStatementEntry.update({
      where: { id: entryId },
      data: {
        excluded: false,
        excludedReason: null,
        excludedNote: null,
        excludedAt: null,
        excludedBy: null,
      },
    });
    revalidatePath("/accounting/statements");
    return ok();
  } catch (e) {
    console.error("[unmarkEntryExcluded] error:", e);
    return err(e instanceof Error ? e.message : "除外解除に失敗しました");
  }
}

/**
 * 全法人・全銀行口座を横断して「未紐付け or 部分紐付け」の件数を返す。
 * 除外済みは含まない。サイドバーバッジ用。
 */
export async function getGlobalUnlinkedCount(): Promise<number> {
  await requireStaffForAccounting("view");
  const entries = await prisma.bankStatementEntry.findMany({
    where: { excluded: false },
    select: {
      incomingAmount: true,
      outgoingAmount: true,
      groupLinks: { select: { amount: true } },
    },
  });
  let n = 0;
  for (const e of entries) {
    const linkedSum = e.groupLinks.reduce((s, l) => s + l.amount, 0);
    const status = computeLinkStatus(
      e.incomingAmount,
      e.outgoingAmount,
      linkedSum,
      false
    );
    if (status === "unlinked" || status === "partial") n++;
  }
  return n;
}

export async function updateStaffMemo(
  entryId: number,
  staffMemo: string | null
): Promise<ActionResult<void>> {
  await requireStaffForAccounting("edit");
  try {
    const value = staffMemo === null || staffMemo.trim() === "" ? null : staffMemo;
    await prisma.bankStatementEntry.update({
      where: { id: entryId },
      data: { staffMemo: value },
    });
    revalidatePath("/accounting/statements");
    return ok();
  } catch (e) {
    console.error("[updateStaffMemo] error:", e);
    return err(e instanceof Error ? e.message : "メモの更新に失敗しました");
  }
}

export async function addManualStatementEntry(
  input: AddManualStatementEntryInput
): Promise<ActionResult<void>> {
  const session = await requireStaffForAccounting("edit");
  try {
    if (!input.operatingCompanyId || !input.operatingCompanyBankAccountId) {
      return err("法人と銀行口座を選択してください");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transactionDate)) {
      return err("日付を選択してください");
    }
    const description = input.description.trim();
    if (!description) return err("摘要を入力してください");

    const incoming = input.incomingAmount ?? null;
    const outgoing = input.outgoingAmount ?? null;
    const hasIncoming = incoming !== null && incoming > 0;
    const hasOutgoing = outgoing !== null && outgoing > 0;
    if (hasIncoming === hasOutgoing) {
      return err("入金または出金のどちらか一方だけ入力してください");
    }
    if ((incoming !== null && !Number.isInteger(incoming)) || (outgoing !== null && !Number.isInteger(outgoing))) {
      return err("金額は整数で入力してください");
    }
    if ((incoming !== null && incoming < 0) || (outgoing !== null && outgoing < 0)) {
      return err("金額は0以上で入力してください");
    }
    if (input.balance !== null && input.balance !== undefined && !Number.isInteger(input.balance)) {
      return err("残高は整数で入力してください");
    }

    const bankAccount = await prisma.operatingCompanyBankAccount.findUnique({
      where: { id: input.operatingCompanyBankAccountId },
      select: { id: true, operatingCompanyId: true, deletedAt: true },
    });
    if (!bankAccount || bankAccount.deletedAt) {
      return err("選択された銀行口座が見つかりません");
    }
    if (bankAccount.operatingCompanyId !== input.operatingCompanyId) {
      return err("選択された銀行口座は指定の法人に属していません");
    }

    const parsedEntry: ParsedStatementEntry = {
      transactionDate: input.transactionDate,
      description,
      incomingAmount: hasIncoming ? incoming : null,
      outgoingAmount: hasOutgoing ? outgoing : null,
      balance: input.balance ?? null,
      csvMemo: input.csvMemo?.trim() || null,
      rowOrder: 0,
    };
    const [entryWithHash] = attachDedupHashes([parsedEntry]);
    const existing = await prisma.bankStatementEntry.findUnique({
      where: {
        operatingCompanyBankAccountId_dedupHash: {
          operatingCompanyBankAccountId: input.operatingCompanyBankAccountId,
          dedupHash: entryWithHash.dedupHash,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return err("同じ日付・摘要・金額・残高の取引が既に登録されています");
    }

    await prisma.$transaction(async (tx) => {
      const importRecord = await tx.bankStatementImport.create({
        data: {
          operatingCompanyId: input.operatingCompanyId,
          operatingCompanyBankAccountId: input.operatingCompanyBankAccountId,
          bankFormatId: "manual_standard",
          fileName: `手動追加_${input.transactionDate}`,
          uploadedBy: session.id,
          rowCount: 1,
          insertedCount: 1,
          duplicateCount: 0,
          openingBalance: null,
        },
      });
      await tx.bankStatementEntry.create({
        data: {
          importId: importRecord.id,
          operatingCompanyId: input.operatingCompanyId,
          operatingCompanyBankAccountId: input.operatingCompanyBankAccountId,
          transactionDate: new Date(`${input.transactionDate}T00:00:00Z`),
          description,
          incomingAmount: parsedEntry.incomingAmount,
          outgoingAmount: parsedEntry.outgoingAmount,
          balance: parsedEntry.balance,
          csvMemo: parsedEntry.csvMemo,
          staffMemo: null,
          rowOrder: 0,
          dedupHash: entryWithHash.dedupHash,
        },
      });
    });

    revalidatePath("/accounting/statements");
    return ok();
  } catch (e) {
    console.error("[addManualStatementEntry] error:", e);
    return err(e instanceof Error ? e.message : "手動追加に失敗しました");
  }
}

export async function deleteStatementImport(
  importId: number
): Promise<ActionResult<void>> {
  await requireStaffForAccounting("manager");
  try {
    const links = await prisma.bankStatementEntryGroupLink.findMany({
      where: { bankStatementEntry: { importId } },
      select: { id: true, invoiceGroupId: true, paymentGroupId: true },
    });
    const linkIds = links.map((link) => link.id);
    const invoiceGroupIds = [
      ...new Set(
        links
          .map((link) => link.invoiceGroupId)
          .filter((id): id is number => id !== null)
      ),
    ];
    const paymentGroupIds = [
      ...new Set(
        links
          .map((link) => link.paymentGroupId)
          .filter((id): id is number => id !== null)
      ),
    ];

    await prisma.$transaction(async (tx) => {
      if (linkIds.length > 0) {
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
      await tx.bankStatementImport.delete({ where: { id: importId } });
      for (const invoiceGroupId of invoiceGroupIds) {
        await recalcInvoiceGroupActualPaymentDate(tx, invoiceGroupId);
        await tx.invoiceGroup.update({
          where: { id: invoiceGroupId },
          data: { statementLinkCompleted: false },
        });
        await syncInvoiceGroupPaymentStateFromRecords(tx, invoiceGroupId);
      }
      for (const paymentGroupId of paymentGroupIds) {
        await recalcPaymentGroupActualPaymentDate(tx, paymentGroupId);
        await tx.paymentGroup.update({
          where: { id: paymentGroupId },
          data: { statementLinkCompleted: false },
        });
        await syncPaymentGroupPaymentStateFromRecords(tx, paymentGroupId);
      }
    });
    revalidatePath("/accounting/statements");
    revalidatePath("/accounting/workflow");
    revalidatePath("/stp/finance/invoices");
    revalidatePath("/stp/finance/payment-groups");
    return ok();
  } catch (e) {
    console.error("[deleteStatementImport] error:", e);
    return err(e instanceof Error ? e.message : "取込バッチの削除に失敗しました");
  }
}
