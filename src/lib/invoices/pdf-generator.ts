import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import {
  calcInvoiceTaxSummary,
  calcInvoiceTotalFromSummary,
} from "@/lib/finance/invoice-tax";
import {
  InvoicePdfTemplate,
  type InvoicePdfData,
} from "./pdf-template";

// ============================================
// 請求書データ取得
// ============================================

export async function getInvoicePdfData(
  groupId: number,
  projectId?: number
): Promise<InvoicePdfData> {
  const group = await prisma.invoiceGroup.findUnique({
    where: { id: groupId, deletedAt: null, ...(projectId ? { projectId } : {}) },
    include: {
      counterparty: true,
      operatingCompany: true,
      bankAccount: true,
      transactions: {
        where: { deletedAt: null },
        include: { expenseCategory: true },
        orderBy: [{ periodFrom: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!group) {
    throw new Error("請求が見つかりません");
  }

  // 明細データ
  const lineItems = group.transactions.map((t) => {
    const taxExcludedAmount =
      t.taxType === "tax_excluded" ? t.amount : t.amount - t.taxAmount;

    return {
      description: t.expenseCategory.name + (t.note ? `（${t.note}）` : ""),
      period: `${t.periodFrom.toISOString().split("T")[0]} 〜 ${t.periodTo.toISOString().split("T")[0]}`,
      amount: taxExcludedAmount,
      taxRate: t.taxRate,
    };
  });

  // インボイス制度準拠: 税率ごとの一括税額計算（9.1）
  const taxSummary = calcInvoiceTaxSummary(lineItems);
  const { totalAmount, taxAmount } = calcInvoiceTotalFromSummary(taxSummary);
  const subtotal = Object.values(taxSummary).reduce(
    (sum, g) => sum + g.subtotal,
    0
  );

  return {
    operatingCompany: {
      companyName: group.operatingCompany.companyName,
      registrationNumber: group.operatingCompany.registrationNumber,
      postalCode: group.operatingCompany.postalCode,
      address: group.operatingCompany.address,
      representativeName: group.operatingCompany.representativeName,
      phone: group.operatingCompany.phone,
      logoPath: group.operatingCompany.logoPath,
    },
    counterpartyName: group.counterparty.name,
    invoiceNumber: group.invoiceNumber,
    invoiceDate: group.invoiceDate?.toISOString().split("T")[0] ?? null,
    paymentDueDate: group.paymentDueDate?.toISOString().split("T")[0] ?? null,
    lineItems,
    taxSummary,
    subtotal,
    taxAmount,
    totalAmount,
    bankAccount: group.bankAccount
      ? {
          bankName: group.bankAccount.bankName,
          branchName: group.bankAccount.branchName,
          accountNumber: group.bankAccount.accountNumber,
          accountHolderName: group.bankAccount.accountHolderName,
        }
      : null,
  };
}

// ============================================
// PDFバッファ生成
// ============================================

export async function generateInvoicePdfBuffer(
  data: InvoicePdfData
): Promise<Buffer> {
  const element = React.createElement(InvoicePdfTemplate, { data });
  // renderToBuffer はDocumentProps型を期待するが、Documentをラップしたコンポーネントでも動作する
  const buffer = await renderToBuffer(
    element as React.ReactElement<Record<string, unknown>>
  );
  return Buffer.from(buffer);
}
