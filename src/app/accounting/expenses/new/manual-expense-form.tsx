"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { createManualExpense, type ManualExpenseFormData } from "./actions";

type Owner = { staffId: number | null; customName: string | null; key: string };

export function ManualExpenseForm({ formData }: { formData: ManualExpenseFormData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<number | null>(null);
  const [counterpartyId, setCounterpartyId] = useState<number | null>(null);
  const [operatingCompanyId, setOperatingCompanyId] = useState<number | null>(
    formData.operatingCompanies[0]?.id ?? null
  );
  const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
  const [approverStaffId, setApproverStaffId] = useState<number | null>(null);

  const [amount, setAmount] = useState<string>("");
  const [taxRate, setTaxRate] = useState<number>(10);
  const today = new Date().toISOString().slice(0, 10);
  const [periodFrom, setPeriodFrom] = useState<string>(today);
  const [periodTo, setPeriodTo] = useState<string>(today);
  const [paymentDueDate, setPaymentDueDate] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [owners, setOwners] = useState<Owner[]>([]);

  // プロジェクト選択時の連動
  const filteredCategories = useMemo(
    () => (projectId ? formData.expenseCategories.filter((c) => c.projectId === projectId) : []),
    [projectId, formData.expenseCategories]
  );
  const approverCandidates = useMemo(
    () => (projectId ? formData.approversByProject[projectId] ?? [] : []),
    [projectId, formData.approversByProject]
  );

  const handleProjectChange = (newProjectId: number) => {
    setProjectId(newProjectId);
    setExpenseCategoryId(null);
    // デフォルト承認者を自動セット
    const project = formData.projects.find((p) => p.id === newProjectId);
    if (project?.defaultApproverStaffId) {
      // 候補にいることを確認
      const exists = (formData.approversByProject[newProjectId] ?? []).find(
        (s) => s.id === project.defaultApproverStaffId
      );
      setApproverStaffId(exists ? project.defaultApproverStaffId : null);
    } else {
      setApproverStaffId(null);
    }
  };

  // 税額の自動計算（税込）
  const computedTaxAmount = useMemo(() => {
    const amt = Number(amount);
    if (!amt || !taxRate) return 0;
    return Math.floor(amt - amt / (1 + taxRate / 100));
  }, [amount, taxRate]);

  const addOwner = () =>
    setOwners((prev) => [
      ...prev,
      { staffId: null, customName: null, key: `o-${Date.now()}-${Math.random()}` },
    ]);

  const removeOwner = (key: string) =>
    setOwners((prev) => prev.filter((o) => o.key !== key));

  const updateOwner = (key: string, patch: Partial<Owner>) =>
    setOwners((prev) => prev.map((o) => (o.key === key ? { ...o, ...patch } : o)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) return setError("プロジェクトは必須です");
    if (!counterpartyId) return setError("取引先は必須です");
    if (!operatingCompanyId) return setError("支払元法人は必須です");
    if (!expenseCategoryId) return setError("勘定科目（費目）は必須です");
    if (!approverStaffId) return setError("承認者は必須です");
    if (!amount || Number(amount) < 0) return setError("金額を正しく入力してください");
    if (!periodFrom || !periodTo) return setError("発生期間は必須です");

    startTransition(async () => {
      const result = await createManualExpense({
        projectId,
        counterpartyId,
        operatingCompanyId,
        expenseCategoryId,
        paymentMethodId,
        approverStaffId,
        amount: Number(amount),
        taxRate,
        taxAmount: computedTaxAmount,
        periodFrom,
        periodTo,
        paymentDueDate: paymentDueDate || null,
        note: note.trim() || null,
        expenseOwners: owners
          .filter((o) => o.staffId || (o.customName && o.customName.trim()))
          .map((o) => ({ staffId: o.staffId, customName: o.customName })),
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      alert("経費を経理承認待ちで登録しました");
      router.push("/accounting/workflow");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>事業部（プロジェクト） <span className="text-red-500">*</span></Label>
              <Select
                value={projectId?.toString() ?? ""}
                onValueChange={(v) => handleProjectChange(Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                <SelectContent>
                  {formData.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>支払元法人 <span className="text-red-500">*</span></Label>
              <Select
                value={operatingCompanyId?.toString() ?? ""}
                onValueChange={(v) => setOperatingCompanyId(Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                <SelectContent>
                  {formData.operatingCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>取引先 <span className="text-red-500">*</span></Label>
              <Select
                value={counterpartyId?.toString() ?? ""}
                onValueChange={(v) => setCounterpartyId(Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                <SelectContent>
                  {formData.counterparties.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}{c.displayId ? ` (${c.displayId})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>勘定科目（費目） <span className="text-red-500">*</span></Label>
              <Select
                value={expenseCategoryId?.toString() ?? ""}
                onValueChange={(v) => setExpenseCategoryId(Number(v))}
                disabled={!projectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={projectId ? "選択..." : "先にプロジェクトを選択"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
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
                <SelectTrigger><SelectValue placeholder="（任意）" /></SelectTrigger>
                <SelectContent>
                  {formData.paymentMethods.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>承認者 <span className="text-red-500">*</span></Label>
              <Select
                value={approverStaffId?.toString() ?? ""}
                onValueChange={(v) => setApproverStaffId(Number(v))}
                disabled={!projectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={projectId ? "承認者を選択" : "先にプロジェクトを選択"} />
                </SelectTrigger>
                <SelectContent>
                  {approverCandidates.length === 0 ? (
                    <SelectItem value="none" disabled>承認権限保持者がいません</SelectItem>
                  ) : (
                    approverCandidates.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {projectId && approverCandidates.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  このプロジェクトの承認権限を持つスタッフがいません。スタッフ権限設定を確認してください。
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">金額・期間</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>金額（税込） <span className="text-red-500">*</span></Label>
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
              <Input type="number" value={computedTaxAmount} readOnly className="bg-muted" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>発生期間（開始） <span className="text-red-500">*</span></Label>
              <DatePicker value={periodFrom} onChange={setPeriodFrom} />
            </div>
            <div>
              <Label>発生期間（終了） <span className="text-red-500">*</span></Label>
              <DatePicker value={periodTo} onChange={setPeriodTo} />
            </div>
            <div>
              <Label>支払期限</Label>
              <DatePicker value={paymentDueDate} onChange={setPaymentDueDate} />
            </div>
          </div>
        </CardContent>
      </Card>

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
            <p className="text-sm text-muted-foreground">担当者が設定されていません</p>
          ) : (
            <div className="space-y-2">
              {owners.map((o) => (
                <div key={o.key} className="flex gap-2 items-center">
                  <Select
                    value={o.staffId?.toString() ?? ""}
                    onValueChange={(v) =>
                      updateOwner(o.key, { staffId: v === "__custom__" ? null : Number(v), customName: null })
                    }
                  >
                    <SelectTrigger className="flex-1"><SelectValue placeholder="スタッフ選択..." /></SelectTrigger>
                    <SelectContent>
                      {formData.staffOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">その他（手入力）</SelectItem>
                    </SelectContent>
                  </Select>
                  {o.staffId === null && (
                    <Input
                      placeholder="手入力の担当者名"
                      value={o.customName ?? ""}
                      onChange={(e) => updateOwner(o.key, { customName: e.target.value })}
                      className="flex-1"
                    />
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeOwner(o.key)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
          {isPending ? "登録中..." : "経理承認待ちとして登録"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/accounting/workflow")}>
          キャンセル
        </Button>
      </div>
    </form>
  );
}
