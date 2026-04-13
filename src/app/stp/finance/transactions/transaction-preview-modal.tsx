"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { calcTax } from "@/lib/finance/tax-calc";
import { Loader2, ExternalLink, Pencil } from "lucide-react";
import {
  getTransactionById,
  updateTransaction,
  confirmTransaction,
} from "@/app/finance/transactions/actions";
import { toLocalDateString } from "@/lib/utils";

type TransactionData = NonNullable<
  Awaited<ReturnType<typeof getTransactionById>>
>;

type Props = {
  transactionId: number;
  open: boolean;
  onClose: () => void;
  onConfirmed?: () => void;
  expenseCategories: { id: number; name: string; type: string }[];
  transactionType: "revenue" | "expense";
};

const TYPE_LABELS: Record<string, string> = {
  revenue: "売上",
  expense: "経費",
};

const TAX_TYPE_LABELS: Record<string, string> = {
  tax_included: "内税",
  tax_excluded: "外税",
};

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ja-JP");
}

function toDateInputValue(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return toLocalDateString(date);
}

export function TransactionPreviewModal({
  transactionId,
  open,
  onClose,
  onConfirmed,
  expenseCategories,
  transactionType,
}: Props) {
  const router = useRouter();
  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // 編集フォーム用
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [taxType, setTaxType] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [taxManuallyEdited, setTaxManuallyEdited] = useState(false);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [note, setNote] = useState("");

  const filteredCategories = useMemo(
    () =>
      expenseCategories.filter(
        (c) => c.type === transactionType || c.type === "both"
      ),
    [expenseCategories, transactionType]
  );

  const loadTransaction = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTransactionById(transactionId);
      setTransaction(data);
      if (data) {
        setExpenseCategoryId(String(data.expenseCategoryId));
        setAmount(String(data.amount));
        setTaxType(data.taxType);
        setTaxRate(String(data.taxRate));
        setTaxAmount(String(data.taxAmount));
        setTaxManuallyEdited(false);
        setPeriodFrom(toDateInputValue(data.periodFrom));
        setPeriodTo(toDateInputValue(data.periodTo));
        setNote(data.note ?? "");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    if (open) {
      loadTransaction();
      setIsEditing(false);
    }
  }, [open, loadTransaction]);

  const handleAmountChange = (val: string) => {
    setAmount(val);
    if (!taxManuallyEdited) {
      setTaxAmount(calcTax(val, taxRate, taxType));
    }
  };

  const handleTaxRateChange = (val: string) => {
    setTaxRate(val);
    if (!taxManuallyEdited) {
      setTaxAmount(calcTax(amount, val, taxType));
    }
  };

  const handleTaxTypeChange = (val: string) => {
    setTaxType(val);
    if (!taxManuallyEdited) {
      setTaxAmount(calcTax(amount, taxRate, val));
    }
  };

  const handleTaxAmountChange = (val: string) => {
    setTaxManuallyEdited(true);
    setTaxAmount(val);
  };

  const handleCancelEdit = () => {
    if (transaction) {
      setExpenseCategoryId(String(transaction.expenseCategoryId));
      setAmount(String(transaction.amount));
      setTaxType(transaction.taxType);
      setTaxRate(String(transaction.taxRate));
      setTaxAmount(String(transaction.taxAmount));
      setTaxManuallyEdited(false);
      setPeriodFrom(toDateInputValue(transaction.periodFrom));
      setPeriodTo(toDateInputValue(transaction.periodTo));
      setNote(transaction.note ?? "");
    }
    setIsEditing(false);
  };

  const buildUpdateData = () => {
    if (!transaction) return null;
    return {
      type: transaction.type,
      counterpartyId: transaction.counterpartyId,
      expenseCategoryId: Number(expenseCategoryId),
      amount: Number(amount),
      taxRate: Number(taxRate),
      taxAmount: Number(taxAmount),
      taxType,
      periodFrom,
      periodTo,
      allocationTemplateId: transaction.allocationTemplateId ?? undefined,
      costCenterId: transaction.costCenterId ?? undefined,
      projectId: transaction.projectId ?? undefined,
      paymentMethodId: transaction.paymentMethodId ?? undefined,
      paymentDueDate: transaction.paymentDueDate
        ? toDateInputValue(transaction.paymentDueDate)
        : undefined,
      note: note || undefined,
      isWithholdingTarget: transaction.isWithholdingTarget,
      withholdingTaxRate:
        transaction.withholdingTaxRate != null
          ? Number(transaction.withholdingTaxRate)
          : undefined,
      withholdingTaxAmount: transaction.withholdingTaxAmount ?? undefined,
      netPaymentAmount: transaction.netPaymentAmount ?? undefined,
      attachments: transaction.attachments.map((att) => ({
        id: att.id,
        filePath: att.filePath,
        fileName: att.fileName,
        fileSize: att.fileSize ?? undefined,
        mimeType: att.mimeType ?? undefined,
        attachmentType: att.attachmentType,
      })),
    };
  };

  const handleSave = async () => {
    const data = buildUpdateData();
    if (!data) return;
    setIsSaving(true);
    try {
      const result = await updateTransaction(transactionId, data as Record<string, unknown>);
      if (result && "error" in result) {
        alert(result.error);
        return;
      }
      await loadTransaction();
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const result = await confirmTransaction(transactionId);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
      onConfirmed?.();
      onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSaveAndConfirm = async () => {
    const data = buildUpdateData();
    if (!data) return;
    setIsSaving(true);
    try {
      const updateResult = await updateTransaction(transactionId, data as Record<string, unknown>);
      if (!updateResult.ok) {
        alert(updateResult.error);
        return;
      }
      const confirmResult = await confirmTransaction(transactionId);
      if (!confirmResult.ok) {
        alert(confirmResult.error);
        return;
      }
      router.refresh();
      onConfirmed?.();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const totalAmount =
    transaction && transaction.taxType === "tax_excluded"
      ? transaction.amount + transaction.taxAmount
      : transaction?.amount ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            取引 #{transactionId}
            {isEditing && (
              <span className="text-sm font-normal text-muted-foreground">
                — 編集中
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 p-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !transaction ? (
            <div className="text-center py-12 text-muted-foreground">
              取引が見つかりません
            </div>
          ) : isEditing ? (
            /* 編集モード */
            <div className="space-y-4">
              {/* 編集不可フィールド（読み取り専用表示） */}
              <div className="rounded-lg bg-gray-50 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">種別:</span>{" "}
                    <span className="font-medium">
                      {TYPE_LABELS[transaction.type] ?? transaction.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">取引先:</span>{" "}
                    <span className="font-medium">
                      {transaction.counterparty.name}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">
                      {transaction.allocationTemplate ? "按分テンプレート:" : "プロジェクト:"}
                    </span>{" "}
                    <span className="font-medium">
                      {transaction.allocationTemplate
                        ? transaction.allocationTemplate.name
                        : transaction.costCenter
                          ? transaction.costCenter.name
                          : "-"}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  これらの変更は詳細ページで行ってください
                </p>
              </div>

              {/* 費目 */}
              <div>
                <Label htmlFor="preview-category">費目</Label>
                <select
                  id="preview-category"
                  value={expenseCategoryId}
                  onChange={(e) => setExpenseCategoryId(e.target.value)}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">選択してください</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 金額・税区分 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preview-amount">金額</Label>
                  <Input
                    id="preview-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="preview-tax-type">税区分</Label>
                  <select
                    id="preview-tax-type"
                    value={taxType}
                    onChange={(e) => handleTaxTypeChange(e.target.value)}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="tax_excluded">外税</option>
                    <option value="tax_included">内税</option>
                  </select>
                </div>
              </div>

              {/* 税率・税額 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preview-tax-rate">税率 (%)</Label>
                  <Input
                    id="preview-tax-rate"
                    type="number"
                    value={taxRate}
                    onChange={(e) => handleTaxRateChange(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="preview-tax-amount">税額</Label>
                  <Input
                    id="preview-tax-amount"
                    type="number"
                    value={taxAmount}
                    onChange={(e) => handleTaxAmountChange(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* 対象期間 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preview-period-from">対象期間From</Label>
                  <DatePicker
                    id="preview-period-from"
                    value={periodFrom}
                    onChange={setPeriodFrom}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="preview-period-to">対象期間To</Label>
                  <DatePicker
                    id="preview-period-to"
                    value={periodTo}
                    onChange={setPeriodTo}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* 備考 */}
              <div>
                <Label htmlFor="preview-note">備考</Label>
                <Input
                  id="preview-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="任意"
                  className="mt-1"
                />
              </div>
            </div>
          ) : (
            /* プレビューモード */
            <div className="space-y-4">
              {/* 取引情報 */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground font-medium">種別</dt>
                  <dd className="mt-0.5">
                    {TYPE_LABELS[transaction.type] ?? transaction.type}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">取引先</dt>
                  <dd className="mt-0.5">{transaction.counterparty.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">費目</dt>
                  <dd className="mt-0.5">{transaction.expenseCategory?.name ?? "（未設定）"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">
                    {transaction.allocationTemplate ? "按分テンプレート" : "プロジェクト"}
                  </dt>
                  <dd className="mt-0.5">
                    {transaction.allocationTemplate
                      ? transaction.allocationTemplate.name
                      : transaction.costCenter
                        ? transaction.costCenter.name
                        : "-"}
                  </dd>
                </div>
              </dl>

              <hr />

              {/* 金額情報 */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground font-medium">税区分</dt>
                  <dd className="mt-0.5">
                    {TAX_TYPE_LABELS[transaction.taxType] ?? transaction.taxType}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">
                    金額（{TAX_TYPE_LABELS[transaction.taxType] ?? transaction.taxType}）
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    ¥{transaction.amount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">税率</dt>
                  <dd className="mt-0.5">{transaction.taxRate}%</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">消費税額</dt>
                  <dd className="mt-0.5">
                    ¥{transaction.taxAmount.toLocaleString()}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground font-medium">
                    合計（税込）
                  </dt>
                  <dd className="mt-0.5 text-lg font-bold">
                    ¥{totalAmount.toLocaleString()}
                  </dd>
                </div>
              </dl>

              <hr />

              {/* 期間情報 */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground font-medium">開始日</dt>
                  <dd className="mt-0.5">
                    {formatDate(transaction.periodFrom)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">終了日</dt>
                  <dd className="mt-0.5">
                    {formatDate(transaction.periodTo)}
                  </dd>
                </div>
                {transaction.paymentDueDate && (
                  <div>
                    <dt className="text-muted-foreground font-medium">
                      支払予定日
                    </dt>
                    <dd className="mt-0.5">
                      {formatDate(transaction.paymentDueDate)}
                    </dd>
                  </div>
                )}
              </dl>

              {/* 源泉徴収 */}
              {transaction.isWithholdingTarget && (
                <>
                  <hr />
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground font-medium">
                        源泉徴収税率
                      </dt>
                      <dd className="mt-0.5">
                        {transaction.withholdingTaxRate != null
                          ? `${transaction.withholdingTaxRate}%`
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground font-medium">
                        源泉徴収税額
                      </dt>
                      <dd className="mt-0.5">
                        {transaction.withholdingTaxAmount != null
                          ? `¥${transaction.withholdingTaxAmount.toLocaleString()}`
                          : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground font-medium">
                        差引支払額
                      </dt>
                      <dd className="mt-0.5 font-bold">
                        {transaction.netPaymentAmount != null
                          ? `¥${transaction.netPaymentAmount.toLocaleString()}`
                          : "-"}
                      </dd>
                    </div>
                  </dl>
                </>
              )}

              {/* 備考 */}
              {transaction.note && (
                <>
                  <hr />
                  <div>
                    <dt className="text-sm text-muted-foreground font-medium">
                      備考
                    </dt>
                    <dd className="mt-0.5 text-sm whitespace-pre-wrap">
                      {transaction.note}
                    </dd>
                  </div>
                </>
              )}

              {/* 証憑 */}
              {transaction.attachments.length > 0 && (
                <>
                  <hr />
                  <div>
                    <dt className="text-sm text-muted-foreground font-medium mb-1">
                      証憑
                    </dt>
                    <dd>
                      <ul className="space-y-1">
                        {transaction.attachments.map((att) => (
                          <li key={att.id}>
                            <a
                              href={att.filePath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 underline hover:text-blue-800"
                            >
                              {att.fileName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        {!loading && transaction && (
          <DialogFooter className="gap-2 sm:gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>
                  キャンセル
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving && (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  )}
                  保存
                </Button>
                <Button onClick={handleSaveAndConfirm} disabled={isSaving}>
                  {isSaving && (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  )}
                  保存して確定
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  編集
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`/stp/finance/transactions/${transactionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    詳細ページ
                  </a>
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                >
                  {isConfirming && (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  )}
                  確定
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
