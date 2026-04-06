"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, FileText, Loader2, Plus, X } from "lucide-react";
import { cn, matchesWithWordBoundary, toLocalDateString } from "@/lib/utils";
import { toast } from "sonner";
import { createTransaction, createAccountingTransaction, updateTransaction } from "./actions";
import type { TransactionFormData } from "./actions";

// ============================================
// 型定義
// ============================================

type AttachmentInput = {
  id?: number;
  filePath: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  attachmentType: string;
};

type TransactionData = {
  id: number;
  type: string;
  counterpartyId: number;
  expenseCategoryId: number | null;
  amount: number;
  taxAmount: number;
  taxRate: number;
  taxType: string;
  periodFrom: Date | string;
  periodTo: Date | string;
  allocationTemplateId: number | null;
  costCenterId: number | null;
  projectId: number | null;
  paymentMethodId: number | null;
  paymentDueDate: Date | string | null;
  note: string | null;
  hasExpenseOwner: boolean;
  expenseOwners: {
    id: number;
    staffId: number | null;
    customName: string | null;
    staff: { id: number; name: string } | null;
  }[];
  isWithholdingTarget: boolean;
  withholdingTaxRate: unknown;
  withholdingTaxAmount: number | null;
  netPaymentAmount: number | null;
  isConfidential: boolean;
  attachments: AttachmentInput[];
};

type Props = {
  formData: TransactionFormData;
  transaction?: TransactionData | null;
  projectContext?: {
    projectId: number;
    costCenterId: number;
    projectName: string;
  } | null;
  linkedGroupAttachments?: {
    source: string;
    fileName: string;
    filePath: string;
  }[];
  accountingMode?: boolean;
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return toLocalDateString(date);
}

// ============================================
// メインコンポーネント
// ============================================

export function TransactionForm({ formData, transaction, projectContext, linkedGroupAttachments, accountingMode }: Props) {
  const router = useRouter();
  const isEdit = !!transaction;

  // --- フォーム状態 ---
  const [type, setType] = useState(transaction?.type || "expense");
  const [counterpartyId, setCounterpartyId] = useState(
    transaction?.counterpartyId ? String(transaction.counterpartyId) : ""
  );
  const [expenseCategoryId, setExpenseCategoryId] = useState(
    transaction?.expenseCategoryId ? String(transaction.expenseCategoryId) : ""
  );
  const [amount, setAmount] = useState(
    transaction?.amount !== undefined ? String(transaction.amount) : ""
  );
  const [taxRate, setTaxRate] = useState(
    transaction?.taxRate !== undefined ? String(transaction.taxRate) : "10"
  );
  const [taxAmount, setTaxAmount] = useState(
    transaction?.taxAmount !== undefined ? String(transaction.taxAmount) : ""
  );
  const [taxType, setTaxType] = useState(transaction?.taxType || "tax_excluded");
  const [periodFrom, setPeriodFrom] = useState(formatDate(transaction?.periodFrom));
  const [periodTo, setPeriodTo] = useState(formatDate(transaction?.periodTo));

  // 按分
  const [useAllocation, setUseAllocation] = useState(!!transaction?.allocationTemplateId);
  const [allocationTemplateId, setAllocationTemplateId] = useState(
    transaction?.allocationTemplateId ? String(transaction.allocationTemplateId) : ""
  );
  const [costCenterId, setCostCenterId] = useState(
    transaction?.costCenterId
      ? String(transaction.costCenterId)
      : projectContext?.costCenterId
        ? String(projectContext.costCenterId)
        : ""
  );

  // 経費負担者
  const [hasExpenseOwner, setHasExpenseOwner] = useState(
    transaction?.hasExpenseOwner || false
  );
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<number>>(() => {
    if (transaction?.expenseOwners) {
      return new Set(
        transaction.expenseOwners.filter((o) => o.staffId).map((o) => o.staffId!)
      );
    }
    return new Set();
  });
  const [customNames, setCustomNames] = useState<string[]>(() => {
    if (transaction?.expenseOwners) {
      return transaction.expenseOwners
        .filter((o) => o.customName)
        .map((o) => o.customName!);
    }
    return [];
  });
  const [customNameInput, setCustomNameInput] = useState("");
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);
  const [staffSearchInput, setStaffSearchInput] = useState("");

  // 源泉徴収
  const [isWithholdingTarget, setIsWithholdingTarget] = useState(
    transaction?.isWithholdingTarget || false
  );
  const [withholdingTaxRate, setWithholdingTaxRate] = useState(
    transaction?.withholdingTaxRate
      ? String(transaction.withholdingTaxRate)
      : "10.21"
  );
  const [withholdingTaxAmount, setWithholdingTaxAmount] = useState(
    transaction?.withholdingTaxAmount !== undefined && transaction.withholdingTaxAmount !== null
      ? String(transaction.withholdingTaxAmount)
      : ""
  );
  const [netPaymentAmount, setNetPaymentAmount] = useState(
    transaction?.netPaymentAmount !== undefined && transaction.netPaymentAmount !== null
      ? String(transaction.netPaymentAmount)
      : ""
  );

  // 支払管理
  const [paymentDueDate, setPaymentDueDate] = useState(
    formatDate(transaction?.paymentDueDate)
  );
  const [paymentMethodId, setPaymentMethodId] = useState(
    transaction?.paymentMethodId ? String(transaction.paymentMethodId) : ""
  );

  // メモ・証憑
  const [note, setNote] = useState(transaction?.note || "");
  const [isConfidential, setIsConfidential] = useState(
    transaction?.isConfidential ?? false
  );
  const [attachments] = useState<AttachmentInput[]>(
    transaction?.attachments || []
  );
  // グループ紐づけ（経理モード用）
  const [invoiceGroupId, setInvoiceGroupId] = useState("");
  const [paymentGroupId, setPaymentGroupId] = useState("");

  // ダイアログ
  const [submitting, setSubmitting] = useState(false);

  // --- 派生値 ---

  // 費目フィルタ（種別に応じて）
  const filteredCategories = useMemo(() => {
    return formData.expenseCategories.filter(
      (c) => c.type === type || c.type === "both"
    );
  }, [formData.expenseCategories, type]);

  // 選択中のテンプレートの按分明細
  const selectedTemplateLines = useMemo(() => {
    if (!allocationTemplateId) return [];
    const template = formData.allocationTemplates.find(
      (t) => t.id === Number(allocationTemplateId)
    );
    return template?.lines || [];
  }, [allocationTemplateId, formData.allocationTemplates]);

  // Combobox用options
  const counterpartyOptions = useMemo(
    () =>
      formData.counterparties.map((c) => ({
        value: String(c.id),
        label: c.displayId ? `${c.displayId} ${c.name}` : c.name,
      })),
    [formData.counterparties]
  );

  const costCenterOptions = useMemo(
    () =>
      formData.costCenters.map((c) => ({
        value: String(c.id),
        label: c.name,
      })),
    [formData.costCenters]
  );

  const allocationTemplateOptions = useMemo(
    () =>
      formData.allocationTemplates.map((t) => ({
        value: String(t.id),
        label: t.name,
      })),
    [formData.allocationTemplates]
  );

  // 経理モード用: グループ選択肢
  const invoiceGroupOptions = useMemo(
    () =>
      (formData.invoiceGroups ?? []).map((g) => ({
        value: String(g.id),
        label: `${g.invoiceNumber ?? `ID:${g.id}`} - ${g.counterparty.name}${g.totalAmount != null ? ` (¥${g.totalAmount.toLocaleString()})` : ""}`,
      })),
    [formData.invoiceGroups]
  );

  const paymentGroupOptions = useMemo(
    () =>
      (formData.paymentGroups ?? []).map((g) => ({
        value: String(g.id),
        label: `${g.referenceCode ?? `ID:${g.id}`} - ${g.counterparty?.name ?? "（未設定）"}${g.totalAmount != null ? ` (¥${g.totalAmount.toLocaleString()})` : ""}`,
      })),
    [formData.paymentGroups]
  );

  // --- 自動計算 ---

  // 消費税額の自動計算（税区分に応じて計算式を切り替え）
  const calculateTaxAmount = useCallback(
    (amountValue: string, rate: string, currentTaxType: string) => {
      const a = Number(amountValue);
      const r = Number(rate);
      if (isNaN(a) || isNaN(r) || r === 0) {
        setTaxAmount("0");
        return "0";
      }
      let tax: number;
      if (currentTaxType === "tax_included") {
        // 税込: 税額 = 金額 - 金額 / (1 + 税率/100)
        tax = Math.floor(a - a / (1 + r / 100));
      } else {
        // 税抜: 税額 = 金額 * 税率 / 100
        tax = Math.floor(a * r / 100);
      }
      setTaxAmount(String(tax));
      return String(tax);
    },
    []
  );

  // 税込合計額を計算するヘルパー
  const getTotalAmount = useCallback(
    (amountValue: string, taxAmountValue: string, currentTaxType: string) => {
      const a = Number(amountValue) || 0;
      const t = Number(taxAmountValue) || 0;
      if (currentTaxType === "tax_included") {
        // 税込入力: amount がそのまま合計
        return a;
      }
      // 税抜入力: amount + taxAmount
      return a + t;
    },
    []
  );

  // 源泉徴収の自動計算
  const calculateWithholding = useCallback(
    (amountValue: string, taxAmountValue: string, rate: string, currentTaxType: string) => {
      const a = Number(amountValue);
      const t = Number(taxAmountValue);
      const r = Number(rate);
      if (isNaN(a) || isNaN(t) || isNaN(r)) return;
      const total = currentTaxType === "tax_included" ? a : a + t;
      const whAmount = Math.floor(total * r / 100);
      setWithholdingTaxAmount(String(whAmount));
      setNetPaymentAmount(String(total - whAmount));
    },
    []
  );

  // 金額・税関連の全再計算を一括で行うヘルパー
  const recalculateAll = useCallback(
    (amountValue: string, rate: string, currentTaxType: string, whTarget: boolean, whRate: string) => {
      const newTax = calculateTaxAmount(amountValue, rate, currentTaxType);
      if (whTarget) {
        calculateWithholding(amountValue, newTax, whRate, currentTaxType);
      }
    },
    [calculateTaxAmount, calculateWithholding]
  );

  // 金額変更ハンドラ
  const handleAmountChange = (value: string) => {
    setAmount(value);
    recalculateAll(value, taxRate, taxType, isWithholdingTarget, withholdingTaxRate);
  };

  // 税率変更ハンドラ
  const handleTaxRateChange = (value: string) => {
    setTaxRate(value);
    recalculateAll(amount, value, taxType, isWithholdingTarget, withholdingTaxRate);
  };

  // 税区分変更ハンドラ
  const handleTaxTypeChange = (value: string) => {
    setTaxType(value);
    recalculateAll(amount, taxRate, value, isWithholdingTarget, withholdingTaxRate);
  };

  // 源泉徴収率変更ハンドラ
  const handleWithholdingRateChange = (value: string) => {
    setWithholdingTaxRate(value);
    calculateWithholding(amount, taxAmount, value, taxType);
  };

  // --- プロジェクトページでの按分先変更チェック ---

  const handleCostCenterChange = (value: string) => {
    if (
      projectContext &&
      value &&
      Number(value) !== projectContext.costCenterId
    ) {
      toast.error(
        `ここは${projectContext.projectName}の作成場所です。他プロジェクトの取引は各プロジェクトページで作成してください。`
      );
      return;
    }
    setCostCenterId(value);
  };

  // --- 保存処理 ---

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {
        type,
        counterpartyId: Number(counterpartyId),
        expenseCategoryId: Number(expenseCategoryId),
        amount: Number(amount),
        taxAmount: Number(taxAmount),
        taxRate: Number(taxRate),
        taxType,
        periodFrom,
        periodTo,
        allocationTemplateId: useAllocation && allocationTemplateId
          ? Number(allocationTemplateId)
          : null,
        costCenterId: !useAllocation && costCenterId
          ? Number(costCenterId)
          : null,
        projectId: projectContext?.projectId ?? transaction?.projectId ?? null,
        paymentMethodId: paymentMethodId ? Number(paymentMethodId) : null,
        paymentDueDate: paymentDueDate || null,
        note: note || null,
        hasExpenseOwner,
        expenseOwners: hasExpenseOwner
          ? [
              ...Array.from(selectedStaffIds).map((sid) => ({
                staffId: sid,
                customName: null,
              })),
              ...customNames.map((name) => ({
                staffId: null,
                customName: name,
              })),
            ]
          : [],
        isWithholdingTarget,
        withholdingTaxRate: isWithholdingTarget ? Number(withholdingTaxRate) : null,
        withholdingTaxAmount: isWithholdingTarget ? Number(withholdingTaxAmount) : null,
        netPaymentAmount: isWithholdingTarget ? Number(netPaymentAmount) : null,
        isConfidential,
        attachments,
      };

      if (isEdit && transaction) {
        const result = await updateTransaction(transaction.id, data);
        if (result && "error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("取引を更新しました");
      } else if (accountingMode) {
        // グループ紐づけ
        if (invoiceGroupId) data.invoiceGroupId = Number(invoiceGroupId);
        if (paymentGroupId) data.paymentGroupId = Number(paymentGroupId);
        const result = await createAccountingTransaction(data);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("取引を作成しました（経理処理待ち）");
        router.push(`/accounting/transactions/${result.id}/edit`);
        return;
      } else {
        const result = await createTransaction(data);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("取引を作成しました");
        router.push(`/accounting/transactions/${result.id}/edit`);
        return;
      }
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "保存に失敗しました"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 合計金額表示
  const totalAmount = getTotalAmount(amount, taxAmount, taxType);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 1. 種別 */}
      <Card>
        <CardHeader>
          <CardTitle>取引情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 種別 */}
          <div className="space-y-2">
            <Label>種別 <span className="text-red-500">*</span></Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => {
                setType(v);
                setExpenseCategoryId("");
              }}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="revenue" id="type-revenue" />
                <Label htmlFor="type-revenue">売上</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="expense" id="type-expense" />
                <Label htmlFor="type-expense">経費</Label>
              </div>
            </RadioGroup>
          </div>

          {/* 取引先 */}
          <div className="space-y-2">
            <Label>取引先 <span className="text-red-500">*</span></Label>
            <Combobox
              options={counterpartyOptions}
              value={counterpartyId}
              onChange={setCounterpartyId}
              placeholder="取引先を検索..."
            />
          </div>

          {/* 費目 */}
          <div className="space-y-2">
            <Label>費目 <span className="text-red-500">*</span></Label>
            <Select
              value={expenseCategoryId}
              onValueChange={setExpenseCategoryId}
            >
              <SelectTrigger>
                <SelectValue placeholder="費目を選択" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 2. 金額情報 */}
      <Card>
        <CardHeader>
          <CardTitle>金額情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 税区分 */}
          <div className="space-y-2">
            <Label>税区分</Label>
            <Select value={taxType} onValueChange={handleTaxTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tax_excluded">税抜</SelectItem>
                <SelectItem value="tax_included">税込</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 金額 */}
          <div className="space-y-2">
            <Label>
              金額（{taxType === "tax_excluded" ? "税抜" : "税込"}）
              <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* 税率 */}
          <div className="space-y-2">
            <Label>税率（%）</Label>
            <Select value={taxRate} onValueChange={handleTaxRateChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="8">8%（軽減税率）</SelectItem>
                <SelectItem value="0">0%（非課税）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 消費税額 */}
          <div className="space-y-2">
            <Label>消費税額</Label>
            <Input
              type="number"
              value={taxAmount}
              onChange={(e) => {
                setTaxAmount(e.target.value);
                if (isWithholdingTarget) {
                  calculateWithholding(amount, e.target.value, withholdingTaxRate, taxType);
                }
              }}
              placeholder="自動計算"
            />
            <p className="text-xs text-muted-foreground">
              自動計算されますが、手動で修正できます
            </p>
          </div>

          {/* 合計表示 */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-md">
            <span className="font-medium">合計（税込）</span>
            <span className="text-lg font-bold">
              ¥{totalAmount.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. 期間情報 */}
      <Card>
        <CardHeader>
          <CardTitle>発生期間</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>開始日 <span className="text-red-500">*</span></Label>
              <DatePicker
                value={periodFrom}
                onChange={setPeriodFrom}
              />
            </div>
            <div className="space-y-2">
              <Label>終了日 <span className="text-red-500">*</span></Label>
              <DatePicker
                value={periodTo}
                onChange={setPeriodTo}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. 按分設定 */}
      <Card>
        <CardHeader>
          <CardTitle>按分設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={useAllocation ? "allocation" : "single"}
            onValueChange={(value) => {
              const isAllocation = value === "allocation";
              setUseAllocation(isAllocation);
              if (isAllocation) {
                setCostCenterId("");
              } else {
                setAllocationTemplateId("");
                const defaultCostCenterId = transaction?.costCenterId
                  ? String(transaction.costCenterId)
                  : projectContext?.costCenterId
                    ? String(projectContext.costCenterId)
                    : "";
                setCostCenterId(defaultCostCenterId);
              }
            }}
            disabled={!!projectContext}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="single" id="allocation-single" />
              <Label htmlFor="allocation-single" className="cursor-pointer">按分なし</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="allocation" id="allocation-use" />
              <Label htmlFor="allocation-use" className="cursor-pointer">按分あり</Label>
            </div>
          </RadioGroup>

          {useAllocation ? (
            <div className="space-y-4">
              {/* 按分テンプレート選択 */}
              <div className="space-y-2">
                <Label>按分テンプレート <span className="text-red-500">*</span></Label>
                <Combobox
                  options={allocationTemplateOptions}
                  value={allocationTemplateId}
                  onChange={setAllocationTemplateId}
                  placeholder="テンプレートを検索..."
                />
              </div>

              {/* 按分明細プレビュー */}
              {selectedTemplateLines.length > 0 && (
                <div className="border rounded-md p-3 space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    按分内容
                  </p>
                  {selectedTemplateLines.map((line) => (
                    <div
                      key={line.id}
                      className="flex justify-between text-sm"
                    >
                      <span>
                        {line.costCenter?.name || line.label || "未確定"}
                      </span>
                      <span className="font-medium">
                        {String(line.allocationRate)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>
                プロジェクト <span className="text-red-500">*</span>
              </Label>
              {projectContext ? (
                <div className="p-3 bg-muted rounded-md text-sm">
                  {projectContext.projectName}（自動設定）
                </div>
              ) : (
                <Combobox
                  options={costCenterOptions}
                  value={costCenterId}
                  onChange={handleCostCenterChange}
                  placeholder="プロジェクトを検索..."
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. グループ紐づけ（経理モード） */}
      {accountingMode && (
        <Card>
          <CardHeader>
            <CardTitle>請求/支払グループ紐づけ（任意）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              既存の請求グループまたは支払グループに紐づける場合は選択してください。空欄の場合はスタンドアロンの取引として作成されます。
            </p>
            {type === "revenue" && invoiceGroupOptions.length > 0 && (
              <div className="space-y-2">
                <Label>請求グループ</Label>
                <Combobox
                  options={invoiceGroupOptions}
                  value={invoiceGroupId}
                  onChange={(v) => {
                    setInvoiceGroupId(v);
                    setPaymentGroupId("");
                  }}
                  placeholder="請求グループを検索..."
                />
              </div>
            )}
            {type === "expense" && paymentGroupOptions.length > 0 && (
              <div className="space-y-2">
                <Label>支払グループ</Label>
                <Combobox
                  options={paymentGroupOptions}
                  value={paymentGroupId}
                  onChange={(v) => {
                    setPaymentGroupId(v);
                    setInvoiceGroupId("");
                  }}
                  placeholder="支払グループを検索..."
                />
              </div>
            )}
            {type === "revenue" && invoiceGroupOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">紐づけ可能な請求グループはありません</p>
            )}
            {type === "expense" && paymentGroupOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">紐づけ可能な支払グループはありません</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 6. 経費負担者（経費の場合） */}
      {type === "expense" && (
        <Card>
          <CardHeader>
            <CardTitle>経費負担者</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={hasExpenseOwner ? "yes" : "no"}
              onValueChange={(v) => {
                const newValue = v === "yes";
                setHasExpenseOwner(newValue);
                if (newValue) {
                  // ON → 自分を初期選択
                  setSelectedStaffIds(new Set([formData.currentUserId]));
                } else {
                  // OFF → クリア
                  setSelectedStaffIds(new Set());
                  setCustomNames([]);
                  setCustomNameInput("");
                }
              }}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id="expense-owner-no" />
                <Label htmlFor="expense-owner-no" className="cursor-pointer">指定なし</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id="expense-owner-yes" />
                <Label htmlFor="expense-owner-yes" className="cursor-pointer">指定する</Label>
              </div>
            </RadioGroup>

            {hasExpenseOwner && (
              <div className="space-y-4 pl-4 border-l-2">
                {/* スタッフ選択 */}
                <div className="space-y-2">
                  <Label>スタッフ選択</Label>
                  <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={staffPopoverOpen}
                        className="w-full justify-between font-normal"
                      >
                        <span className="text-muted-foreground">スタッフを検索...</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="スタッフを検索..."
                          value={staffSearchInput}
                          onValueChange={setStaffSearchInput}
                        />
                        <CommandList maxHeight={200}>
                          <CommandEmpty>見つかりませんでした</CommandEmpty>
                          <CommandGroup>
                            {(staffSearchInput
                              ? formData.staffOptions.filter((s) =>
                                  matchesWithWordBoundary(s.name, staffSearchInput)
                                )
                              : formData.staffOptions
                            ).map((staff) => (
                              <CommandItem
                                key={staff.id}
                                value={String(staff.id)}
                                onSelect={() => {
                                  setSelectedStaffIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(staff.id)) {
                                      next.delete(staff.id);
                                    } else {
                                      next.add(staff.id);
                                    }
                                    return next;
                                  });
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedStaffIds.has(staff.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {staff.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* 選択済みスタッフのバッジ */}
                  {selectedStaffIds.size > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Array.from(selectedStaffIds).map((sid) => {
                        const staff = formData.staffOptions.find((s) => s.id === sid);
                        return (
                          <Badge key={sid} variant="secondary" className="gap-1">
                            {staff?.name ?? `ID:${sid}`}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStaffIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(sid);
                                  return next;
                                });
                              }}
                              className="ml-0.5 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* スタッフ外の追加 */}
                <div className="space-y-2">
                  <Label>スタッフ外の追加</Label>
                  <div className="flex gap-2">
                    <Input
                      value={customNameInput}
                      onChange={(e) => setCustomNameInput(e.target.value)}
                      placeholder="名前を入力..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const name = customNameInput.trim();
                        if (name && !customNames.includes(name)) {
                          setCustomNames((prev) => [...prev, name]);
                        }
                        setCustomNameInput("");
                      }}
                      disabled={!customNameInput.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 手入力名のバッジ */}
                  {customNames.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {customNames.map((name) => (
                        <Badge key={name} variant="secondary" className="gap-1">
                          {name}
                          <button
                            type="button"
                            onClick={() => {
                              setCustomNames((prev) => prev.filter((n) => n !== name));
                            }}
                            className="ml-0.5 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 7. 源泉徴収（経費の場合） */}
      {type === "expense" && (
        <Card>
          <CardHeader>
            <CardTitle>源泉徴収</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="withholding"
                checked={isWithholdingTarget}
                onCheckedChange={(checked) => {
                  setIsWithholdingTarget(!!checked);
                  if (checked) {
                    calculateWithholding(amount, taxAmount, withholdingTaxRate, taxType);
                  } else {
                    setWithholdingTaxAmount("");
                    setNetPaymentAmount("");
                  }
                }}
              />
              <Label htmlFor="withholding">源泉徴収対象</Label>
            </div>

            {isWithholdingTarget && (
              <div className="space-y-4 pl-6 border-l-2">
                <div className="space-y-2">
                  <Label>源泉徴収税率（%）</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={withholdingTaxRate}
                    onChange={(e) =>
                      handleWithholdingRateChange(e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>源泉徴収税額</Label>
                  <Input
                    type="number"
                    value={withholdingTaxAmount}
                    onChange={(e) => {
                      setWithholdingTaxAmount(e.target.value);
                      const total = getTotalAmount(amount, taxAmount, taxType);
                      setNetPaymentAmount(
                        String(total - (Number(e.target.value) || 0))
                      );
                    }}
                    placeholder="自動計算"
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <span className="font-medium">差引支払額</span>
                  <span className="text-lg font-bold">
                    ¥{(Number(netPaymentAmount) || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 8. 支払管理（経費の場合） */}
      {type === "expense" && (
        <Card>
          <CardHeader>
            <CardTitle>支払管理（任意）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>支払予定日</Label>
              <DatePicker
                value={paymentDueDate}
                onChange={setPaymentDueDate}
              />
            </div>
            <div className="space-y-2">
              <Label>決済手段</Label>
              <Select
                value={paymentMethodId}
                onValueChange={setPaymentMethodId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {formData.paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={String(pm.id)}>
                      {pm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 9. メモ・証憑 */}
      <Card>
        <CardHeader>
          <CardTitle>その他</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* メモ */}
          <div className="space-y-2">
            <Label>摘要・メモ</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="メモを入力..."
              rows={3}
            />
          </div>

          {/* 機密フラグ */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isConfidential"
              checked={isConfidential}
              onChange={(e) => setIsConfidential(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="isConfidential" className="text-sm cursor-pointer">
              機密（作成者と経理担当のみ閲覧可能）
            </label>
          </div>

          {/* 証憑（閲覧専用・表示する証憑がある場合のみ） */}
          {(attachments.length > 0 || (linkedGroupAttachments && linkedGroupAttachments.length > 0)) && (
            <div className="space-y-2">
              <Label>証憑</Label>
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((att) => (
                    <a
                      key={att.filePath}
                      href={att.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 border rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span className="flex-1 text-sm truncate text-blue-600 underline">
                        {att.fileName}
                      </span>
                    </a>
                  ))}
                </div>
              )}
              {linkedGroupAttachments && linkedGroupAttachments.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">グループの証憑</p>
                  {linkedGroupAttachments.map((att) => (
                    <a
                      key={att.filePath}
                      href={att.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 border rounded-md bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span className="flex-1 text-sm truncate text-blue-600 underline">
                        {att.fileName}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {att.source}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 10. アクション */}
      <div className="flex gap-3">
        <Button
          onClick={() => handleSubmit()}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : isEdit ? (
            "更新する"
          ) : (
            "作成する"
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          キャンセル
        </Button>
      </div>

    </div>
  );
}
