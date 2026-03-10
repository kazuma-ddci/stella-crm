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
import {
  buildDefaultDescription,
  formatPeriodRange,
} from "./description-utils";
import { toLocalDateString } from "@/lib/utils";

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
      memoLines: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!group) {
    throw new Error("請求が見つかりません");
  }

  // デフォルト送信元メールアドレスを取得
  let senderEmail: string | null = null;
  if (group.projectId) {
    const projectEmail = await prisma.projectEmail.findFirst({
      where: { projectId: group.projectId, isDefault: true },
      include: { email: true },
    });
    if (projectEmail) {
      senderEmail = projectEmail.email.email;
    }
  }
  if (!senderEmail && group.operatingCompanyId) {
    const defaultEmail = await prisma.operatingCompanyEmail.findFirst({
      where: { operatingCompanyId: group.operatingCompanyId, isDefault: true, deletedAt: null },
    });
    if (defaultEmail) {
      senderEmail = defaultEmail.email;
    }
  }

  // lineDescriptions オーバーライド
  const lineDescs = (group.lineDescriptions as Record<string, string> | null) ?? {};
  const counterpartyName = group.counterparty.name;

  // 明細データ
  const lineItems = group.transactions.map((t) => {
    const taxExcludedAmount =
      t.taxType === "tax_excluded" ? t.amount : t.amount - t.taxAmount;

    // オーバーライドがあればそれを使用、なければデフォルト生成
    const description =
      lineDescs[String(t.id)] ||
      buildDefaultDescription(t.expenseCategory.name, t.note, counterpartyName);

    const periodFrom = toLocalDateString(t.periodFrom);
    const periodTo = toLocalDateString(t.periodTo);

    return {
      id: t.id,
      description,
      period: formatPeriodRange(periodFrom, periodTo),
      amount: taxExcludedAmount,
      taxRate: t.taxRate,
      knownTax: t.taxAmount,
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
      address2: group.operatingCompany.address2,
      email: senderEmail,
    },
    counterpartyName: group.counterparty.name,
    honorific: group.honorific,
    remarks: group.remarks,
    memoLines: group.memoLines.map((m) => ({
      id: m.id,
      description: m.description,
      sortOrder: m.sortOrder,
    })),
    lineOrder: group.lineOrder as string[] | null,
    invoiceNumber: group.invoiceNumber,
    invoiceDate: group.invoiceDate ? toLocalDateString(group.invoiceDate) : null,
    paymentDueDate: group.paymentDueDate ? toLocalDateString(group.paymentDueDate) : null,
    lineItems,
    taxSummary,
    subtotal,
    taxAmount,
    totalAmount,
    bankAccount: group.bankAccount
      ? {
          bankName: group.bankAccount.bankName,
          branchName: group.bankAccount.branchName,
          branchCode: group.bankAccount.branchCode,
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
