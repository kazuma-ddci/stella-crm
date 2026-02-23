import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTransactionById,
} from "@/app/accounting/transactions/actions";
import { getStpTransactionFormData } from "../../actions";
import { getSystemProjectContext } from "@/lib/project-context";
import { TransactionForm } from "@/app/accounting/transactions/transaction-form";
import { CommentSection } from "@/app/accounting/comments/comment-section";
import { ChangeLogSection } from "@/app/accounting/changelog/changelog-section";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function StpEditTransactionPage({ params }: Props) {
  const { id } = await params;
  const transactionId = Number(id);

  if (isNaN(transactionId)) {
    notFound();
  }

  const [transaction, formData, stpCtx] = await Promise.all([
    getTransactionById(transactionId),
    getStpTransactionFormData(),
    getSystemProjectContext("stp"),
  ]);

  if (!transaction) {
    notFound();
  }

  // STPスコープ検証: 他プロジェクトの取引IDを直打ちされた場合を防ぐ
  if (transaction.projectId !== stpCtx.projectId) {
    notFound();
  }

  const transactionData = {
    id: transaction.id,
    type: transaction.type,
    counterpartyId: transaction.counterpartyId,
    expenseCategoryId: transaction.expenseCategoryId,
    amount: transaction.amount,
    taxAmount: transaction.taxAmount,
    taxRate: transaction.taxRate,
    taxType: transaction.taxType,
    periodFrom: transaction.periodFrom,
    periodTo: transaction.periodTo,
    allocationTemplateId: transaction.allocationTemplateId,
    costCenterId: transaction.costCenterId,
    contractId: transaction.contractId,
    projectId: transaction.projectId,
    paymentMethodId: transaction.paymentMethodId,
    paymentDueDate: transaction.paymentDueDate,
    scheduledPaymentDate: transaction.scheduledPaymentDate,
    note: transaction.note,
    isWithholdingTarget: transaction.isWithholdingTarget,
    withholdingTaxRate:
      transaction.withholdingTaxRate != null
        ? Number(transaction.withholdingTaxRate)
        : null,
    withholdingTaxAmount: transaction.withholdingTaxAmount,
    netPaymentAmount: transaction.netPaymentAmount,
    attachments: transaction.attachments.map((att) => ({
      id: att.id,
      filePath: att.filePath,
      fileName: att.fileName,
      fileSize: att.fileSize ?? undefined,
      mimeType: att.mimeType ?? undefined,
      attachmentType: att.attachmentType,
    })),
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">取引の編集（STP）</h1>
        <Link
          href="/stp/finance/transactions"
          className="text-sm text-blue-600 hover:underline"
        >
          取引管理へ戻る
        </Link>
      </div>
      <TransactionForm
        formData={formData}
        transaction={transactionData}
        projectContext={stpCtx}
        scope={{ projectCode: "stp" }}
        redirectBasePath="/stp/finance/transactions"
      />
      <div className="border-t pt-6">
        <CommentSection transactionId={transactionId} allowCommentTypes />
      </div>
      <div className="border-t pt-6">
        <ChangeLogSection transactionId={transactionId} />
      </div>
    </div>
  );
}
