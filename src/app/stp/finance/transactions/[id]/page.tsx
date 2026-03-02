import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getTransactionById,
  getTransactionFormData,
} from "@/app/accounting/transactions/actions";
import { TransactionStatusBadge } from "@/app/accounting/transactions/transaction-status-badge";
import { TransactionForm } from "@/app/accounting/transactions/transaction-form";
import { CommentSection } from "@/app/accounting/comments/comment-section";
import { ChangeLogSection } from "@/app/accounting/changelog/changelog-section";
import { TransactionConfirmButton } from "./confirm-button";

type Props = {
  params: Promise<{ id: string }>;
};

const TYPE_LABELS: Record<string, string> = {
  revenue: "売上",
  expense: "経費",
};

const TAX_TYPE_LABELS: Record<string, string> = {
  tax_included: "税込",
  tax_excluded: "税抜",
};

export default async function TransactionDetailPage({ params }: Props) {
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

  const isEditable =
    (transaction.status === "unconfirmed" || transaction.status === "returned") &&
    !transaction.invoiceGroupId &&
    !transaction.paymentGroupId;

  const isLinked = !!transaction.invoiceGroupId || !!transaction.paymentGroupId;
  const linkType = transaction.invoiceGroupId ? "請求" : "支払";

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
    hasExpenseOwner: transaction.hasExpenseOwner,
    expenseOwners: transaction.expenseOwners,
    isWithholdingTarget: transaction.isWithholdingTarget,
    withholdingTaxRate: transaction.withholdingTaxRate != null ? Number(transaction.withholdingTaxRate) : null,
    withholdingTaxAmount: transaction.withholdingTaxAmount,
    netPaymentAmount: transaction.netPaymentAmount,
    isConfidential: transaction.isConfidential,
    attachments: transaction.attachments.map((att) => ({
      id: att.id,
      filePath: att.filePath,
      fileName: att.fileName,
      fileSize: att.fileSize ?? undefined,
      mimeType: att.mimeType ?? undefined,
      attachmentType: att.attachmentType,
    })),
  };

  // 読み取り専用表示用のヘルパー
  const totalAmount =
    transaction.taxType === "tax_excluded"
      ? transaction.amount + transaction.taxAmount
      : transaction.amount;

  const formatDate = (d: Date | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("ja-JP");
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Link href="/stp/finance/transactions">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            取引一覧に戻る
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">取引 #{transaction.id}</h1>
        <TransactionStatusBadge status={transaction.status} />
        {transaction.status === "unconfirmed" && (
          <TransactionConfirmButton transactionId={transaction.id} />
        )}
      </div>

      {/* 操作者情報 */}
      {(transaction.creator || transaction.updater) && (
        <p className="text-sm text-muted-foreground">
          {transaction.creator && <>作成: {transaction.creator.name}</>}
          {transaction.creator && transaction.updater && <> | </>}
          {transaction.updater && <>最終更新: {transaction.updater.name}</>}
        </p>
      )}

      {/* 紐づけバナー */}
      {isLinked && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Info className="h-4 w-4 flex-shrink-0" />
          <span>
            この取引は{linkType}に紐づけられています。編集するには{linkType}管理から紐づけを解除してください。
          </span>
        </div>
      )}

      {/* 編集可能: TransactionForm */}
      {isEditable ? (
        <TransactionForm formData={formData} transaction={transactionData} linkedGroupAttachments={(() => {
          const items: { source: string; fileName: string; filePath: string }[] = [];
          if (transaction.invoiceGroup?.attachments) {
            for (const att of transaction.invoiceGroup.attachments) {
              items.push({
                source: `請求 ${transaction.invoiceGroup.invoiceNumber ?? `#${transaction.invoiceGroup.id}`}`,
                fileName: att.fileName,
                filePath: att.filePath,
              });
            }
          }
          if (transaction.paymentGroup?.attachments) {
            for (const att of transaction.paymentGroup.attachments) {
              items.push({
                source: `支払 #${transaction.paymentGroup.id}`,
                fileName: att.fileName,
                filePath: att.filePath,
              });
            }
          }
          return items.length > 0 ? items : undefined;
        })()} />
      ) : (
        /* 読み取り専用表示 */
        <div className="space-y-6 max-w-3xl">
          {/* 取引情報 */}
          <Card>
            <CardHeader>
              <CardTitle>取引情報</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">種別</dt>
                  <dd className="mt-1">{TYPE_LABELS[transaction.type] || transaction.type}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">取引先</dt>
                  <dd className="mt-1">{transaction.counterparty.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">費目</dt>
                  <dd className="mt-1">{transaction.expenseCategory.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    {transaction.allocationTemplate ? "按分テンプレート" : "プロジェクト"}
                  </dt>
                  <dd className="mt-1">
                    {transaction.allocationTemplate
                      ? transaction.allocationTemplate.name
                      : transaction.costCenter
                        ? transaction.costCenter.name
                        : "-"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* 按分グループ処理状況 */}
          {transaction.allocationTemplate && (() => {
            const itemMap = new Map(
              transaction.allocationGroupItems.map((i) => [i.costCenterId, i])
            );
            const lines = transaction.allocationTemplate.lines
              .filter((l) => l.costCenterId !== null && l.costCenter)
              .map((l) => {
                const item = itemMap.get(l.costCenterId!);
                let groupLabel: string | null = null;
                if (item?.invoiceGroup) {
                  groupLabel = item.invoiceGroup.invoiceNumber ?? "請求(下書き)";
                } else if (item?.paymentGroup) {
                  const m = item.paymentGroup.targetMonth;
                  groupLabel = m ? `支払 ${m.getUTCFullYear()}/${String(m.getUTCMonth() + 1).padStart(2, "0")}` : "支払（対象月未設定）";
                }
                return {
                  costCenterName: l.costCenter!.name,
                  isProcessed: !!item,
                  groupLabel,
                };
              });
            const processed = lines.filter((l) => l.isProcessed).length;
            const total = lines.length;

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    按分処理状況
                    <span className="text-sm font-normal text-muted-foreground">
                      ({processed}/{total} 処理済み)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {lines.map((l) => (
                      <div
                        key={l.costCenterName}
                        className="flex items-center gap-3 py-1.5 px-2 rounded-md bg-gray-50"
                      >
                        {l.isProcessed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-300 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium">{l.costCenterName}</span>
                        {l.groupLabel ? (
                          <span className="text-sm text-muted-foreground ml-auto">
                            {l.groupLabel}
                          </span>
                        ) : (
                          <span className="text-sm text-amber-600 ml-auto">未処理</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* 金額情報 */}
          <Card>
            <CardHeader>
              <CardTitle>金額情報</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">税区分</dt>
                  <dd className="mt-1">{TAX_TYPE_LABELS[transaction.taxType] || transaction.taxType}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    金額（{TAX_TYPE_LABELS[transaction.taxType] || transaction.taxType}）
                  </dt>
                  <dd className="mt-1 font-medium">¥{transaction.amount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">税率</dt>
                  <dd className="mt-1">{transaction.taxRate}%</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">消費税額</dt>
                  <dd className="mt-1">¥{transaction.taxAmount.toLocaleString()}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-muted-foreground">合計（税込）</dt>
                  <dd className="mt-1 text-lg font-bold">¥{totalAmount.toLocaleString()}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* 期間情報 */}
          <Card>
            <CardHeader>
              <CardTitle>発生期間</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">開始日</dt>
                  <dd className="mt-1">{formatDate(transaction.periodFrom)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">終了日</dt>
                  <dd className="mt-1">{formatDate(transaction.periodTo)}</dd>
                </div>
                {transaction.paymentDueDate && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">支払予定日</dt>
                    <dd className="mt-1">{formatDate(transaction.paymentDueDate)}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* 経費負担者（該当する場合） */}
          {transaction.hasExpenseOwner && transaction.expenseOwners.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>経費負担者</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {transaction.expenseOwners.map((owner) => (
                    <span
                      key={owner.id}
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm"
                    >
                      {owner.staff?.name ?? owner.customName ?? "-"}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 源泉徴収（該当する場合） */}
          {transaction.isWithholdingTarget && (
            <Card>
              <CardHeader>
                <CardTitle>源泉徴収</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">源泉徴収税率</dt>
                    <dd className="mt-1">{transaction.withholdingTaxRate != null ? `${transaction.withholdingTaxRate}%` : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">源泉徴収税額</dt>
                    <dd className="mt-1">{transaction.withholdingTaxAmount != null ? `¥${transaction.withholdingTaxAmount.toLocaleString()}` : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">差引支払額</dt>
                    <dd className="mt-1 font-bold">{transaction.netPaymentAmount != null ? `¥${transaction.netPaymentAmount.toLocaleString()}` : "-"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}

          {/* CRM連携 */}
          {transaction.contract && (
            <Card>
              <CardHeader>
                <CardTitle>CRM連携</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">契約</dt>
                    <dd className="mt-1">{transaction.contract.title}（{transaction.contract.company.name}）</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}

          {/* メモ */}
          {transaction.note && (
            <Card>
              <CardHeader>
                <CardTitle>摘要・メモ</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{transaction.note}</p>
              </CardContent>
            </Card>
          )}

          {/* 証憑 */}
          {(transaction.attachments.length > 0 || transaction.invoiceGroup?.attachments?.length || transaction.paymentGroup?.attachments?.length) && (
            <Card>
              <CardHeader>
                <CardTitle>証憑</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {transaction.attachments.length > 0 && (
                  <ul className="space-y-2">
                    {transaction.attachments.map((att) => (
                      <li key={att.id}>
                        <a
                          href={att.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 border rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-sm truncate text-blue-600 underline">{att.fileName}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {transaction.invoiceGroup?.attachments && transaction.invoiceGroup.attachments.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">
                      請求 {transaction.invoiceGroup.invoiceNumber ?? `#${transaction.invoiceGroup.id}`} の証憑
                    </p>
                    <ul className="space-y-2">
                      {transaction.invoiceGroup.attachments.map((att) => (
                        <li key={att.id}>
                          <a
                            href={att.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 border rounded-md bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            <span className="text-sm truncate text-blue-600 underline">{att.fileName}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {transaction.paymentGroup?.attachments && transaction.paymentGroup.attachments.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">
                      支払 #{transaction.paymentGroup.id} の証憑
                    </p>
                    <ul className="space-y-2">
                      {transaction.paymentGroup.attachments.map((att) => (
                        <li key={att.id}>
                          <a
                            href={att.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 border rounded-md bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            <span className="text-sm truncate text-blue-600 underline">{att.fileName}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* コメントセクション */}
      <div className="border-t pt-6 max-w-3xl">
        <CommentSection transactionId={transactionId} allowCommentTypes />
      </div>

      {/* 変更履歴セクション */}
      <div className="border-t pt-6 max-w-3xl">
        <ChangeLogSection transactionId={transactionId} />
      </div>
    </div>
  );
}
