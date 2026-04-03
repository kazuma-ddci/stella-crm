"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2 } from "lucide-react";
import { createTransactionInline } from "@/app/stp/finance/transactions/actions";
import { calcTax } from "@/lib/finance/tax-calc";

type Props = {
  onClose: () => void;
  onCreated: () => void;
  counterpartyId: number;
  projectId?: number;
  expenseCategories: { id: number; name: string; type: string }[];
  transactionType: "revenue" | "expense";
};

const CONFIG = {
  revenue: {
    title: "売上取引を新規作成",
    idPrefix: "inline",
  },
  expense: {
    title: "経費取引を新規作成",
    idPrefix: "inline-expense",
  },
} as const;

export function InlineTransactionForm({
  onClose,
  onCreated,
  counterpartyId,
  projectId,
  expenseCategories,
  transactionType,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [taxRate, setTaxRate] = useState<string>("10");
  const [taxType, setTaxType] = useState<string>("tax_excluded");
  const [taxAmount, setTaxAmount] = useState<string>("");
  const [taxManuallyEdited, setTaxManuallyEdited] = useState(false);
  const [periodFrom, setPeriodFrom] = useState<string>("");
  const [periodTo, setPeriodTo] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const { title, idPrefix } = CONFIG[transactionType];

  const filteredCategories = useMemo(
    () =>
      expenseCategories.filter(
        (c) => c.type === transactionType || c.type === "both"
      ),
    [expenseCategories, transactionType]
  );

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

  const handleSubmit = async () => {
    if (!expenseCategoryId || !amount || !periodFrom || !periodTo) return;
    setLoading(true);
    try {
      await createTransactionInline({
        type: transactionType,
        counterpartyId,
        expenseCategoryId: Number(expenseCategoryId),
        amount: Number(amount),
        taxRate: Number(taxRate),
        taxAmount: Number(taxAmount),
        taxType,
        periodFrom,
        periodTo,
        note: note || undefined,
        projectId,
      });
      onCreated();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    !!expenseCategoryId &&
    !!amount &&
    Number(amount) > 0 &&
    !!periodFrom &&
    !!periodTo;

  return (
    <div className="space-y-4 p-1">
      <h3 className="text-sm font-semibold">{title}</h3>

      <div>
        <Label htmlFor={`${idPrefix}-category`}>費目 *</Label>
        <select
          id={`${idPrefix}-category`}
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${idPrefix}-amount`}>金額 *</Label>
          <Input
            id={`${idPrefix}-amount`}
            type="number"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-tax-type`}>税区分</Label>
          <select
            id={`${idPrefix}-tax-type`}
            value={taxType}
            onChange={(e) => handleTaxTypeChange(e.target.value)}
            className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="tax_excluded">外税</option>
            <option value="tax_included">内税</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${idPrefix}-tax-rate`}>税率 (%)</Label>
          <Input
            id={`${idPrefix}-tax-rate`}
            type="number"
            value={taxRate}
            onChange={(e) => handleTaxRateChange(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-tax-amount`}>税額</Label>
          <Input
            id={`${idPrefix}-tax-amount`}
            type="number"
            value={taxAmount}
            onChange={(e) => handleTaxAmountChange(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>対象期間From *</Label>
          <DatePicker
            value={periodFrom}
            onChange={setPeriodFrom}
            placeholder="日付を選択"
          />
        </div>
        <div>
          <Label>対象期間To *</Label>
          <DatePicker
            value={periodTo}
            onChange={setPeriodTo}
            placeholder="日付を選択"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-note`}>備考</Label>
        <Input
          id={`${idPrefix}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="任意"
          className="mt-1"
        />
      </div>

      {!canSubmit && (
        <p className="text-xs text-muted-foreground">
          * 費目・金額・対象期間を入力すると作成できます
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          キャンセル
        </Button>
        <Button type="button" size="sm" onClick={handleSubmit} disabled={loading || !canSubmit}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          作成
        </Button>
      </div>
    </div>
  );
}
