"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { submitExpenseRequest, type ExpenseFormData } from "./actions";

type Owner = { staffId: number | null; customName: string | null; key: string };

type Props = {
  formData: ExpenseFormData;
  /** "accounting" = 経理直接入力（承認不要）、"project" = プロジェクト申請（承認必要） */
  mode: "accounting" | "project";
  /** 戻り先URL */
  backUrl: string;
};

const FREQUENCY_OPTIONS = [
  { value: "once", label: "一度限り" },
  { value: "monthly", label: "毎月 / Nヶ月ごと" },
  { value: "yearly", label: "毎年 / N年ごと" },
  { value: "weekly", label: "毎週" },
];

export function ManualExpenseForm({ formData, mode, backUrl }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // プロジェクト（project mode ではURL由来で固定、accounting mode では選択可能）
  const [projectId, setProjectId] = useState<number | null>(
    formData.project?.id ?? null
  );
  const [counterpartyId, setCounterpartyId] = useState<number | null>(null);
  const [operatingCompanyId, setOperatingCompanyId] = useState<number | null>(
    formData.operatingCompanies[0]?.id ?? null
  );
  const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
  const [approverStaffId, setApproverStaffId] = useState<number | null>(
    formData.project?.defaultApproverStaffId ?? null
  );

  // 金額
  const [amountType, setAmountType] = useState<"fixed" | "variable">("fixed");
  const [amount, setAmount] = useState("");
  const [taxRate, setTaxRate] = useState(10);

  // 支払いサイクル
  const [frequency, setFrequency] = useState<string>("once");
  const [intervalCount, setIntervalCount] = useState(1);
  const [executionDay, setExecutionDay] = useState<string>("");
  const [executeOnLastDay, setExecuteOnLastDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recurringName, setRecurringName] = useState("");

  // 一度限り
  const today = new Date().toISOString().slice(0, 10);
  const [periodFrom, setPeriodFrom] = useState(today);
  const [periodTo, setPeriodTo] = useState(today);
  const [paymentDueDate, setPaymentDueDate] = useState("");

  const [note, setNote] = useState("");
  const [owners, setOwners] = useState<Owner[]>([]);

  const isRecurring = frequency !== "once";

  // プロジェクト連動
  const filteredCategories = useMemo(
    () =>
      projectId
        ? formData.expenseCategories.filter((c) => c.projectId === projectId)
        : formData.expenseCategories,
    [projectId, formData.expenseCategories]
  );
  const approverCandidates = useMemo(
    () => (projectId ? formData.approversByProject[projectId] ?? [] : []),
    [projectId, formData.approversByProject]
  );

  const handleProjectChange = (newId: number) => {
    setProjectId(newId);
    setExpenseCategoryId(null);
    const proj = formData.allProjects.find((p) => p.id === newId);
    if (proj?.defaultApproverStaffId) {
      const exists = (formData.approversByProject[newId] ?? []).find(
        (s) => s.id === proj.defaultApproverStaffId
      );
      setApproverStaffId(exists ? proj.defaultApproverStaffId : null);
    } else {
      setApproverStaffId(null);
    }
  };

  // 税額自動計算（税込）
  const computedTaxAmount = useMemo(() => {
    const amt = Number(amount);
    if (!amt || !taxRate) return 0;
    return Math.floor(amt - amt / (1 + taxRate / 100));
  }, [amount, taxRate]);

  const addOwner = () =>
    setOwners((p) => [
      ...p,
      { staffId: null, customName: null, key: `o-${Date.now()}-${Math.random()}` },
    ]);
  const removeOwner = (key: string) =>
    setOwners((p) => p.filter((o) => o.key !== key));
  const updateOwner = (key: string, patch: Partial<Owner>) =>
    setOwners((p) => p.map((o) => (o.key === key ? { ...o, ...patch } : o)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) return setError("プロジェクトは必須です");
    if (!counterpartyId) return setError("取引先は必須です");
    if (!operatingCompanyId) return setError("支払元法人は必須です");
    if (!expenseCategoryId) return setError("勘定科目（費目）は必須です");
    if (mode === "project" && !approverStaffId) return setError("承認者は必須です");
    if (amountType === "fixed" && (!amount || Number(amount) < 0))
      return setError("金額を正しく入力してください");

    if (isRecurring) {
      if (!recurringName.trim()) return setError("定期取引の名称は必須です");
      if (!startDate) return setError("支払い開始日は必須です");
    } else {
      if (!periodFrom || !periodTo) return setError("発生期間は必須です");
    }

    startTransition(async () => {
      const result = await submitExpenseRequest({
        mode,
        projectId,
        counterpartyId,
        operatingCompanyId,
        expenseCategoryId,
        paymentMethodId,
        approverStaffId: approverStaffId ?? undefined,
        amountType,
        amount: amountType === "fixed" ? Number(amount) : undefined,
        taxRate,
        taxAmount: amountType === "fixed" ? computedTaxAmount : undefined,
        frequency: frequency as "once" | "monthly" | "yearly" | "weekly",
        intervalCount: isRecurring ? intervalCount : undefined,
        executionDay: isRecurring && !executeOnLastDay ? (executionDay ? Number(executionDay) : undefined) : undefined,
        executeOnLastDay: isRecurring ? executeOnLastDay : undefined,
        startDate: isRecurring ? startDate : undefined,
        endDate: isRecurring && endDate ? endDate : undefined,
        periodFrom: !isRecurring ? periodFrom : undefined,
        periodTo: !isRecurring ? periodTo : undefined,
        paymentDueDate: !isRecurring && paymentDueDate ? paymentDueDate : undefined,
        note: note.trim() || undefined,
        recurringName: isRecurring ? recurringName.trim() : undefined,
        expenseOwners: owners
          .filter((o) => o.staffId || (o.customName && o.customName.trim()))
          .map((o) => ({ staffId: o.staffId, customName: o.customName })),
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      if (result.type === "recurring") {
        alert("定期取引として登録しました。初回分は自動生成されています。");
      } else {
        alert(
          mode === "accounting"
            ? "経費を仕訳待ちとして登録しました。"
            : "経費を経理承認待ちとして申請しました。"
        );
      }
      router.push(backUrl);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* 基本情報 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* プロジェクト */}
            {formData.project ? (
              <div>
                <Label>事業部</Label>
                <Input value={formData.project.name} readOnly className="bg-muted" />
              </div>
            ) : (
              <div>
                <Label>
                  事業部 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={projectId?.toString() ?? ""}
                  onValueChange={(v) => handleProjectChange(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.allProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>
                支払元法人 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={operatingCompanyId?.toString() ?? ""}
                onValueChange={(v) => setOperatingCompanyId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択..." />
                </SelectTrigger>
                <SelectContent>
                  {formData.operatingCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>
                取引先 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={counterpartyId?.toString() ?? ""}
                onValueChange={(v) => setCounterpartyId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択..." />
                </SelectTrigger>
                <SelectContent>
                  {formData.counterparties.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                      {c.displayId ? ` (${c.displayId})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>
                勘定科目（費目） <span className="text-red-500">*</span>
              </Label>
              <Select
                value={expenseCategoryId?.toString() ?? ""}
                onValueChange={(v) => setExpenseCategoryId(Number(v))}
                disabled={!projectId && !formData.project}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      projectId || formData.project
                        ? "選択..."
                        : "先にプロジェクトを選択"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>支払方法</Label>
              <Select
                value={paymentMethodId?.toString() ?? ""}
                onValueChange={(v) => setPaymentMethodId(v ? Number(v) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="（任意）" />
                </SelectTrigger>
                <SelectContent>
                  {formData.paymentMethods.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 承認者（プロジェクトモードでは必須、経理モードでは非表示） */}
            {mode === "project" && (
              <div>
                <Label>
                  承認者 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={approverStaffId?.toString() ?? ""}
                  onValueChange={(v) => setApproverStaffId(Number(v))}
                  disabled={!projectId && !formData.project}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        projectId || formData.project
                          ? "承認者を選択"
                          : "先にプロジェクトを選択"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {approverCandidates.length === 0 ? (
                      <SelectItem value="none" disabled>
                        承認権限保持者がいません
                      </SelectItem>
                    ) : (
                      approverCandidates.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 金額・サイクル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">金額・支払いサイクル</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>
                金額タイプ <span className="text-red-500">*</span>
              </Label>
              <Select
                value={amountType}
                onValueChange={(v) => setAmountType(v as "fixed" | "variable")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">固定</SelectItem>
                  <SelectItem value="variable">変動（毎回異なる）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                支払いサイクル <span className="text-red-500">*</span>
              </Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 固定金額の場合 */}
          {amountType === "fixed" && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>
                  金額（税込） <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10000"
                />
              </div>
              <div>
                <Label>税率 (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>消費税額（自動計算）</Label>
                <Input
                  type="number"
                  value={computedTaxAmount}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>
          )}

          {/* 定期サイクルの詳細 */}
          {isRecurring && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>
                    名称（定期取引） <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={recurringName}
                    onChange={(e) => setRecurringName(e.target.value)}
                    placeholder="例: AWS利用料、オフィス家賃"
                  />
                </div>
                {(frequency === "monthly" || frequency === "yearly") && (
                  <div>
                    <Label>繰り返し間隔</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={intervalCount}
                        onChange={(e) =>
                          setIntervalCount(Math.max(1, Number(e.target.value)))
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        {frequency === "monthly" ? "ヶ月ごと" : "年ごと"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>
                    支払い開始日 <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker value={startDate} onChange={setStartDate} />
                </div>
                <div>
                  <Label>支払い終了日</Label>
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="空欄 = 無期限"
                  />
                </div>
                {frequency === "monthly" && (
                  <div>
                    <Label>実行日</Label>
                    {executeOnLastDay ? (
                      <Input value="月末日" readOnly className="bg-muted" />
                    ) : (
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={executionDay}
                        onChange={(e) => setExecutionDay(e.target.value)}
                        placeholder="1〜31"
                      />
                    )}
                    <label className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={executeOnLastDay}
                        onChange={(e) => setExecuteOnLastDay(e.target.checked)}
                        className="rounded"
                      />
                      毎月末日に実行
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 一度限りの場合 */}
          {!isRecurring && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>
                  発生期間（開始） <span className="text-red-500">*</span>
                </Label>
                <DatePicker value={periodFrom} onChange={setPeriodFrom} />
              </div>
              <div>
                <Label>
                  発生期間（終了） <span className="text-red-500">*</span>
                </Label>
                <DatePicker value={periodTo} onChange={setPeriodTo} />
              </div>
              <div>
                <Label>支払期限</Label>
                <DatePicker value={paymentDueDate} onChange={setPaymentDueDate} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 担当者 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>担当者（複数可）</span>
            <Button type="button" size="sm" variant="outline" onClick={addOwner}>
              <Plus className="h-3 w-3 mr-1" />
              追加
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {owners.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              担当者が設定されていません
            </p>
          ) : (
            <div className="space-y-2">
              {owners.map((o) => (
                <div key={o.key} className="flex gap-2 items-center">
                  <Select
                    value={o.staffId?.toString() ?? ""}
                    onValueChange={(v) =>
                      updateOwner(o.key, {
                        staffId: v === "__custom__" ? null : Number(v),
                        customName: null,
                      })
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="スタッフ選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.staffOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">
                        その他（手入力）
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {o.staffId === null && (
                    <Input
                      placeholder="手入力の担当者名"
                      value={o.customName ?? ""}
                      onChange={(e) =>
                        updateOwner(o.key, { customName: e.target.value })
                      }
                      className="flex-1"
                    />
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeOwner(o.key)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 摘要 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">摘要・メモ</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例: 4/1 クライアントとの会食（〇〇レストラン）"
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "登録中..."
            : mode === "accounting"
              ? "仕訳待ちとして登録"
              : "経理承認待ちとして申請"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(backUrl)}
        >
          キャンセル
        </Button>
      </div>
    </form>
  );
}
