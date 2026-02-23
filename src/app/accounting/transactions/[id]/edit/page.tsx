import { notFound } from "next/navigation";
import { getTransactionById, getTransactionFormData } from "../../actions";
import { TransactionForm } from "../../transaction-form";
import { CommentSection } from "@/app/accounting/comments/comment-section";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditTransactionPage({ params }: Props) {
  const { id } = await params;
  const transactionId = Number(id);

  if (isNaN(transactionId)) {
    notFound();
  }

  const [transaction, formData] = await Promise.all([
    getTransactionById(transactionId),
    getTransactionFormData(),
  ]);

  if (!transaction) {
    notFound();
  }

  // TransactionFormが期待する形式に変換
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
    note: transaction.note,
    isWithholdingTarget: transaction.isWithholdingTarget,
    withholdingTaxRate: transaction.withholdingTaxRate,
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
      <h1 className="text-2xl font-bold">取引の編集</h1>
      <TransactionForm formData={formData} transaction={transactionData} />
      <div className="border-t pt-6">
        <CommentSection
          transactionId={transactionId}
          allowCommentTypes
        />
      </div>
    </div>
  );
}
