"use server";

import Papa from "papaparse";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffForAccounting } from "@/lib/auth/staff-action";
import type { LinkStatusFilter } from "./actions";
import { EXCLUDED_REASON_LABELS, type ExcludedReason } from "./constants";

type ExportInput = {
  operatingCompanyBankAccountId: number;
  linkStatus: LinkStatusFilter;
  from: string | null;
  to: string | null;
  q: string | null;
};

type ExportResult = {
  csv: string;
  fileName: string;
};

function statusLabel(
  excluded: boolean,
  incoming: number | null,
  outgoing: number | null,
  linkedAmount: number
): string {
  if (excluded) return "除外";
  const total = (incoming ?? 0) > 0 ? incoming! : (outgoing ?? 0) > 0 ? outgoing! : 0;
  if (total === 0) return "対象外";
  if (linkedAmount === 0) return "未紐付け";
  if (linkedAmount >= total) return "紐付け完了";
  return "一部紐付け";
}

export async function exportStatementsCsv(
  input: ExportInput
): Promise<ActionResult<ExportResult>> {
  await requireStaffForAccounting("view");
  try {
    const where: Prisma.BankStatementEntryWhereInput = {
      operatingCompanyBankAccountId: input.operatingCompanyBankAccountId,
    };
    if (input.from || input.to) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (input.from) dateFilter.gte = new Date(input.from);
      if (input.to) {
        const t = new Date(input.to);
        t.setHours(23, 59, 59, 999);
        dateFilter.lte = t;
      }
      where.transactionDate = dateFilter;
    }
    if (input.q && input.q.trim().length > 0) {
      const term = input.q.trim();
      where.OR = [
        { description: { contains: term, mode: "insensitive" } },
        { csvMemo: { contains: term, mode: "insensitive" } },
        { staffMemo: { contains: term, mode: "insensitive" } },
      ];
    }

    const entries = await prisma.bankStatementEntry.findMany({
      where,
      orderBy: [{ transactionDate: "desc" }, { rowOrder: "desc" }],
      select: {
        id: true,
        transactionDate: true,
        description: true,
        incomingAmount: true,
        outgoingAmount: true,
        balance: true,
        csvMemo: true,
        staffMemo: true,
        excluded: true,
        excludedReason: true,
        excludedNote: true,
        operatingCompany: { select: { companyName: true } },
        bankAccount: {
          select: { bankName: true, branchName: true, accountNumber: true },
        },
        groupLinks: {
          select: {
            amount: true,
            invoiceGroup: { select: { id: true, invoiceNumber: true } },
            paymentGroup: { select: { id: true, referenceCode: true } },
          },
        },
      },
    });

    // フィルタ条件と一致しない行は除外
    const filtered = entries.filter((e) => {
      const linkedAmount = e.groupLinks.reduce((s, l) => s + l.amount, 0);
      const total =
        (e.incomingAmount ?? 0) > 0
          ? e.incomingAmount!
          : (e.outgoingAmount ?? 0) > 0
            ? e.outgoingAmount!
            : 0;
      const status: "excluded" | "unlinked" | "partial" | "complete" | "skip" = e.excluded
        ? "excluded"
        : total === 0
          ? "skip"
          : linkedAmount === 0
            ? "unlinked"
            : linkedAmount >= total
              ? "complete"
              : "partial";

      // テーブル表示と一致: "all" は excluded のみ除外（skip 含む）
      if (input.linkStatus === "all") return status !== "excluded";
      return input.linkStatus === status;
    });

    const rows = filtered.map((e) => {
      const linkedAmount = e.groupLinks.reduce((s, l) => s + l.amount, 0);
      const linkRefs = e.groupLinks
        .map((l) =>
          l.invoiceGroup
            ? `請求#${l.invoiceGroup.invoiceNumber ?? l.invoiceGroup.id}`
            : l.paymentGroup
              ? `支払#${l.paymentGroup.referenceCode ?? l.paymentGroup.id}`
              : ""
        )
        .filter(Boolean)
        .join(";");

      return {
        日付: e.transactionDate.toISOString().slice(0, 10),
        内容: e.description,
        入金: e.incomingAmount ?? "",
        出金: e.outgoingAmount ?? "",
        残高: e.balance ?? "",
        CSVメモ: e.csvMemo ?? "",
        スタッフメモ: e.staffMemo ?? "",
        紐付け状態: statusLabel(
          e.excluded,
          e.incomingAmount,
          e.outgoingAmount,
          linkedAmount
        ),
        紐付け先: linkRefs,
        紐付け金額合計: linkedAmount,
        除外フラグ: e.excluded ? "除外" : "",
        除外理由: e.excluded && e.excludedReason
          ? EXCLUDED_REASON_LABELS[e.excludedReason as ExcludedReason] ?? ""
          : "",
        除外メモ: e.excludedNote ?? "",
        法人: e.operatingCompany.companyName,
        銀行口座: `${e.bankAccount.bankName} ${e.bankAccount.branchName} ${e.bankAccount.accountNumber}`,
      };
    });

    const csv = Papa.unparse(rows);
    const today = new Date().toISOString().slice(0, 10);
    return ok({
      csv,
      fileName: `bank_statements_${today}.csv`,
    });
  } catch (e) {
    console.error("[exportStatementsCsv] error:", e);
    return err(e instanceof Error ? e.message : "CSV出力に失敗しました");
  }
}
