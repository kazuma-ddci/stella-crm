"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createTransaction, updateTransaction } from "./actions";
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
  expenseCategoryId: number;
  amount: number;
  taxAmount: number;
  taxRate: number;
  taxType: string;
  periodFrom: Date | string;
  periodTo: Date | string;
  allocationTemplateId: number | null;
  costCenterId: number | null;
  contractId: number | null;
  projectId: number | null;
  paymentMethodId: number | null;
  paymentDueDate: Date | string | null;
  scheduledPaymentDate: Date | string | null;
  note: string | null;
  isWithholdingTarget: boolean;
  withholdingTaxRate: unknown;
  withholdingTaxAmount: number | null;
  netPaymentAmount: number | null;
  attachments: AttachmentInput[];
};

type Props = {
  formData: TransactionFormData;
  transaction?: TransactionData | null;
  projectContext?: {
    projectId: number;
    costCenterIds: number[];
    projectName: string;
  } | null;
  redirectBasePath?: string;
  scope?: { projectCode: string };
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}

// ============================================
// メインコンポーネント
// ============================================

export function TransactionForm({
  formData,
  transaction,
  projectContext,
  redirectBasePath = "/accounting/transactions",
  scope,
}: Props) {
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
      : projectContext?.costCenterIds?.length === 1
        ? String(projectContext.costCenterIds[0])
        : ""
  );

  // CRM連携
  const [contractId, setContractId] = useState(
    transaction?.contractId ? String(transaction.contractId) : ""
  );

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
  const [scheduledPaymentDate, setScheduledPaymentDate] = useState(
    formatDate(transaction?.scheduledPaymentDate)
  );
  const [paymentMethodId, setPaymentMethodId] = useState(
    transaction?.paymentMethodId ? String(transaction.paymentMethodId) : ""
  );

  // メモ・証憑
  const [note, setNote] = useState(transaction?.note || "");
  const [attachments, setAttachments] = useState<AttachmentInput[]>(
    transaction?.attachments || []
  );
  const [uploading, setUploading] = useState(false);

  // ダイアログ
  const [contractWarningOpen, setContractWarningOpen] = useState(false);
  const [contractWarningMessage, setContractWarningMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // --- 派生値 ---

  // 費目フィルタ（種別に応じて）
  const filteredCategories = useMemo(() => {
    return formData.expenseCategories.filter(
      (c) => c.type === type || c.type === "both"
    );
  }, [formData.expenseCategories, type]);

  // 取引先に紐づく契約一覧
  const filteredContracts = useMemo(() => {
    if (!counterpartyId) return [];
    const cp = formData.counterparties.find(
      (c) => c.id === Number(counterpartyId)
    );
    if (!cp) return [];
    // 取引先→companyを介した契約フィルタはCounterparty.companyIdがないため
    // 全契約を表示してユーザーに選択させる
    return formData.contracts;
  }, [counterpartyId, formData.counterparties, formData.contracts]);

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
        label: c.name,
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

  const paymentMethodOptions = useMemo(
    () =>
      formData.paymentMethods.map((p) => ({
        value: String(p.id),
        label: p.name,
      })),
    [formData.paymentMethods]
  );

  const contractOptions = useMemo(
    () =>
      filteredContracts.map((c) => ({
        value: String(c.id),
        label: `${c.title} (${c.company.name})`,
      })),
    [filteredContracts]
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

  // --- 証憑アップロード ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      for (let i = 0; i < files.length; i++) {
        formDataUpload.append("files", files[i]);
      }

      const response = await fetch("/api/transactions/upload", {
        method: "POST",
        body: formDataUpload,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "アップロードに失敗しました");
      }

      const newAttachments: AttachmentInput[] = result.files.map(
        (f: { filePath: string; fileName: string; fileSize: number; mimeType: string }) => ({
          filePath: f.filePath,
          fileName: f.fileName,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
          attachmentType: "other",
        })
      );
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "アップロードに失敗しました"
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // --- 契約終了警告チェック ---

  const checkContractEndWarning = (): boolean => {
    if (!contractId || !periodFrom) return false;
    const contract = formData.contracts.find(
      (c) => c.id === Number(contractId)
    );
    if (!contract?.endDate) return false;

    const endDate = new Date(contract.endDate);
    const fromDate = new Date(periodFrom);
    const toDate = periodTo ? new Date(periodTo) : fromDate;
    // 契約終了日 < 取引期間のいずれかの日付なら警告
    if (endDate < fromDate || endDate < toDate) {
      const endStr = endDate.toLocaleDateString("ja-JP");
      setContractWarningMessage(
        `この契約は${endStr}に終了しています。取引を登録しますか？`
      );
      setContractWarningOpen(true);
      return true;
    }
    return false;
  };

  // --- プロジェクトページでの按分先変更チェック ---

  const handleCostCenterChange = (value: string) => {
    if (
      projectContext &&
      value &&
      !projectContext.costCenterIds.includes(Number(value))
    ) {
      toast.error(
        `ここは${projectContext.projectName}の作成場所です。他プロジェクトの取引は各プロジェクトページで作成してください。`
      );
      return;
    }
    setCostCenterId(value);
  };

  // --- 保存処理 ---

  const handleSubmit = async (skipWarning = false) => {
    // 契約終了警告チェック
    if (!skipWarning && checkContractEndWarning()) {
      return;
    }

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
        contractId: contractId ? Number(contractId) : null,
        projectId: projectContext?.projectId || null,
        paymentMethodId: paymentMethodId ? Number(paymentMethodId) : null,
        paymentDueDate: paymentDueDate || null,
        scheduledPaymentDate: scheduledPaymentDate || null,
        note: note || null,
        isWithholdingTarget,
        withholdingTaxRate: isWithholdingTarget ? Number(withholdingTaxRate) : null,
        withholdingTaxAmount: isWithholdingTarget ? Number(withholdingTaxAmount) : null,
        netPaymentAmount: isWithholdingTarget ? Number(netPaymentAmount) : null,
        attachments,
      };

      if (isEdit && transaction) {
        await updateTransaction(transaction.id, data, scope);
        toast.success("取引を更新しました");
      } else {
        const result = await createTransaction(data, scope);
        toast.success("取引を作成しました");
        router.push(`${redirectBasePath}/${result.id}/edit`);
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
              onChange={(v) => {
                setCounterpartyId(v);
                setContractId("");
              }}
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
              <Input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>終了日 <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
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
            onValueChange={(v) => {
              const isAlloc = v === "allocation";
              setUseAllocation(isAlloc);
              if (isAlloc) {
                setCostCenterId("");
              } else {
                setAllocationTemplateId("");
                if (projectContext?.costCenterIds?.length === 1) {
                  setCostCenterId(String(projectContext.costCenterIds[0]));
                }
              }
            }}
            disabled={!!projectContext}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="single" id="alloc-single" />
              <Label htmlFor="alloc-single">按分なし（単一プロジェクト）</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="allocation" id="alloc-template" />
              <Label htmlFor="alloc-template">按分あり（テンプレート使用）</Label>
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

      {/* 5. CRM連携 */}
      <Card>
        <CardHeader>
          <CardTitle>CRM連携（任意）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>契約</Label>
            <Combobox
              options={contractOptions}
              value={contractId}
              onChange={setContractId}
              placeholder="契約を検索..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 6. 源泉徴収（経費の場合） */}
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

      {/* 7. 支払管理/入金管理 */}
      <Card>
        <CardHeader>
          <CardTitle>{type === "revenue" ? "入金管理（任意）" : "支払管理（任意）"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{type === "revenue" ? "入金期日" : "支払期日"}</Label>
              <Input
                type="date"
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{type === "revenue" ? "入金予定日" : "支払予定日"}</Label>
              <Input
                type="date"
                value={scheduledPaymentDate}
                onChange={(e) => setScheduledPaymentDate(e.target.value)}
              />
            </div>
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

      {/* 8. メモ・証憑 */}
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

          {/* 証憑アップロード */}
          <div className="space-y-2">
            <Label>証憑</Label>
            <div className="space-y-2">
              {attachments.map((att, index) => (
                <div
                  key={att.filePath}
                  className="flex items-center gap-2 p-2 border rounded-md bg-gray-50"
                >
                  <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span className="flex-1 text-sm truncate">
                    {att.fileName}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAttachment(index)}
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}

              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">アップロード中...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      クリックまたはドラッグ&ドロップでファイルを追加
                    </span>
                  </>
                )}
              </label>
              <p className="text-xs text-muted-foreground">
                PDF, Word, Excel, 画像, CSV（各10MB以下）
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 9. アクション */}
      <div className="flex gap-3">
        <Button
          onClick={() => handleSubmit()}
          disabled={submitting || uploading}
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

      {/* 契約終了警告ダイアログ */}
      <Dialog open={contractWarningOpen} onOpenChange={setContractWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>契約終了の確認</DialogTitle>
            <DialogDescription>{contractWarningMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setContractWarningOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setContractWarningOpen(false);
                if (contractId) {
                  const contract = formData.contracts.find(
                    (c) => c.id === Number(contractId)
                  );
                  if (contract) {
                    window.open(
                      `/companies/${contract.company.id}/contracts`,
                      "_blank"
                    );
                  }
                }
              }}
            >
              契約情報を確認
            </Button>
            <Button
              onClick={() => {
                setContractWarningOpen(false);
                handleSubmit(true);
              }}
            >
              登録を続行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
