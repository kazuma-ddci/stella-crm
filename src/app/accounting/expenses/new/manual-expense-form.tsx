"use client";

import { useState, useMemo, useTransition, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Search, Upload, FileText, Trash2 } from "lucide-react";
import { submitExpenseRequest, type ExpenseFormData } from "./actions";

type Owner = { staffId: number | null; customName: string | null; key: string };

type Props = {
  formData: ExpenseFormData;
  mode: "accounting" | "project";
  backUrl: string;
};

const FREQUENCY_OPTIONS = [
  { value: "once", label: "一度限り" },
  { value: "monthly", label: "毎月 / Nヶ月ごと" },
  { value: "yearly", label: "毎年 / N年ごと" },
  { value: "weekly", label: "毎週" },
];

// 取引先選択コンポーネント
function CounterpartySelector({
  counterparties,
  selectedId,
  customName,
  onSelect,
  onCustomNameChange,
}: {
  counterparties: ExpenseFormData["counterparties"];
  selectedId: number | null;
  customName: string;
  onSelect: (id: number | null) => void;
  onCustomNameChange: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [counterpartyTab, setCounterpartyTab] = useState("stella");

  const matchSearch = (c: ExpenseFormData["counterparties"][0], q: string) =>
    c.name.toLowerCase().includes(q) ||
    (c.displayId && c.displayId.toLowerCase().includes(q)) ||
    (c.companyCode && c.companyCode.toLowerCase().includes(q));

  const stellaList = useMemo(() => {
    const list = counterparties.filter((c) => c.companyId !== null);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((c) => matchSearch(c, q));
  }, [counterparties, search]);

  const otherList = useMemo(() => {
    const list = counterparties.filter((c) => c.companyId === null);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((c) => matchSearch(c, q));
  }, [counterparties, search]);

  const selectedName = useMemo(() => {
    if (customName) return `手入力: ${customName}`;
    if (!selectedId) return null;
    const c = counterparties.find((c) => c.id === selectedId);
    if (!c) return null;
    const code = c.companyCode || c.displayId || "";
    return code ? `${code} ${c.name}` : c.name;
  }, [selectedId, customName, counterparties]);

  const renderList = (list: ExpenseFormData["counterparties"]) => (
    <div className="max-h-48 overflow-y-auto space-y-0.5">
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          該当する取引先がありません
        </p>
      ) : (
        list.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-blue-50 transition-colors ${
              selectedId === c.id && !customName
                ? "bg-blue-50 border-l-2 border-l-blue-500 font-medium"
                : ""
            }`}
            onClick={() => {
              onSelect(c.id);
              onCustomNameChange("");
            }}
          >
            <span className="text-muted-foreground font-mono text-xs mr-2">
              {c.companyCode || c.displayId || "---"}
            </span>
            {c.name}
          </button>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <Label>
        取引先 <span className="text-red-500">*</span>
      </Label>
      {selectedName && (
        <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
          <span className="flex-1">{selectedName}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              onSelect(null);
              onCustomNameChange("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="border rounded-lg">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="取引先名で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <Tabs value={counterpartyTab} onValueChange={setCounterpartyTab}>
          <TabsList className="w-full rounded-none border-b h-8">
            <TabsTrigger value="stella" className="text-xs flex-1 h-7">
              Stella顧客 ({stellaList.length})
            </TabsTrigger>
            <TabsTrigger value="other" className="text-xs flex-1 h-7">
              その他 ({otherList.length})
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs flex-1 h-7">
              手入力
            </TabsTrigger>
          </TabsList>
          <TabsContent value="stella" className="p-1 mt-0">
            {renderList(stellaList)}
          </TabsContent>
          <TabsContent value="other" className="p-1 mt-0">
            {renderList(otherList)}
          </TabsContent>
          <TabsContent value="manual" className="p-2 mt-0">
            <Input
              placeholder="取引先名を入力"
              value={customName}
              onChange={(e) => {
                onCustomNameChange(e.target.value);
                onSelect(null);
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              経理が後から取引先マスタに紐付けを行います
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export function ManualExpenseForm({ formData, mode, backUrl }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<number | null>(formData.project?.id ?? null);
  const [counterpartyId, setCounterpartyId] = useState<number | null>(null);
  const [customCounterpartyName, setCustomCounterpartyName] = useState("");
  const [operatingCompanyId, setOperatingCompanyId] = useState<number | null>(
    formData.project?.operatingCompanyId ?? formData.operatingCompanies[0]?.id ?? null
  );
  const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
  const [approverStaffId, setApproverStaffId] = useState<number | null>(
    formData.project?.defaultApproverStaffId ?? null
  );

  const [frequency, setFrequency] = useState<string>("once");
  const [amountType, setAmountType] = useState<"fixed" | "variable">("fixed");
  const [amount, setAmount] = useState("");
  const [taxRate, setTaxRate] = useState(10);

  const [intervalCount, setIntervalCount] = useState(1);
  const [executionDay, setExecutionDay] = useState("");
  const [executeOnLastDay, setExecuteOnLastDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recurringName, setRecurringName] = useState("");

  const [scheduledPaymentDate, setScheduledPaymentDate] = useState("");

  // 按分
  const [useAllocation, setUseAllocation] = useState(false);
  const [allocationTemplateId, setAllocationTemplateId] = useState<number | null>(null);
  const [costCenterId, setCostCenterId] = useState<number | null>(null);

  const selectedTemplate = useMemo(() => {
    if (!allocationTemplateId) return null;
    return formData.allocationTemplates.find((t) => t.id === allocationTemplateId) ?? null;
  }, [allocationTemplateId, formData.allocationTemplates]);

  // 機密
  const [isConfidential, setIsConfidential] = useState(false);

  // 証憑ファイル
  type PendingFile = { file: File; key: string };
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList) => {
    const newFiles = Array.from(files).map((f) => ({
      file: f,
      key: `f-${Date.now()}-${Math.random()}`,
    }));
    setPendingFiles((prev) => [...prev, ...newFiles]);
  };
  const removeFile = (key: string) => setPendingFiles((prev) => prev.filter((f) => f.key !== key));

  const [note, setNote] = useState("");
  const [owners, setOwners] = useState<Owner[]>([]);

  const isRecurring = frequency !== "once";

  const filteredCategories = useMemo(() => {
    const expenseTypes = formData.expenseCategories.filter(
      (c) => c.type === "expense" || c.type === "both"
    );
    // 経理モード: 全プロジェクトの費目を表示
    // プロジェクトモード: そのプロジェクトの費目のみ
    if (mode === "accounting") return expenseTypes;
    return projectId
      ? expenseTypes.filter((c) => c.projectId === projectId)
      : expenseTypes;
  }, [projectId, formData.expenseCategories, mode]);
  const approverCandidates = useMemo(
    () => (projectId ? formData.approversByProject[projectId] ?? [] : []),
    [projectId, formData.approversByProject]
  );

  const handleProjectChange = (newId: number) => {
    setProjectId(newId);
    setExpenseCategoryId(null);
    const proj = formData.allProjects.find((p) => p.id === newId);
    // 運営法人をプロジェクトのデフォルトにセット
    if (proj?.operatingCompanyId) {
      setOperatingCompanyId(proj.operatingCompanyId);
    }
    // 承認者をデフォルトにセット
    if (proj?.defaultApproverStaffId) {
      const exists = (formData.approversByProject[newId] ?? []).find(
        (s) => s.id === proj.defaultApproverStaffId
      );
      setApproverStaffId(exists ? proj.defaultApproverStaffId : null);
    } else {
      setApproverStaffId(null);
    }
  };

  const computedTaxAmount = useMemo(() => {
    const amt = Number(amount);
    if (!amt || !taxRate) return 0;
    return Math.floor(amt - amt / (1 + taxRate / 100));
  }, [amount, taxRate]);

  const addOwner = () =>
    setOwners((p) => [...p, { staffId: null, customName: null, key: `o-${Date.now()}-${Math.random()}` }]);
  const removeOwner = (key: string) => setOwners((p) => p.filter((o) => o.key !== key));
  const updateOwner = (key: string, patch: Partial<Owner>) =>
    setOwners((p) => p.map((o) => (o.key === key ? { ...o, ...patch } : o)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) return setError("プロジェクトは必須です");
    if (!counterpartyId && !customCounterpartyName.trim()) return setError("取引先を選択または入力してください");
    if (!operatingCompanyId) return setError("支払元法人は必須です");
    if (mode === "accounting" && !expenseCategoryId) return setError("勘定科目（費目）は必須です");
    if (mode === "project" && !approverStaffId) return setError("承認者は必須です");
    if ((isRecurring ? amountType : "fixed") === "fixed" && (!amount || Number(amount) < 0)) return setError("金額を正しく入力してください");
    if (isRecurring && !recurringName.trim()) return setError("定期取引の名称は必須です");
    if (isRecurring && !startDate) return setError("支払い開始日は必須です");
    if (!isRecurring && !scheduledPaymentDate) return setError("支払予定日は必須です");

    startTransition(async () => {
      const result = await submitExpenseRequest({
        mode,
        projectId,
        counterpartyId: counterpartyId ?? undefined,
        customCounterpartyName: customCounterpartyName.trim() || undefined,
        operatingCompanyId,
        expenseCategoryId: expenseCategoryId ?? undefined,
        paymentMethodId,
        approverStaffId: approverStaffId ?? undefined,
        amountType: isRecurring ? amountType : "fixed",
        amount: (isRecurring ? amountType : "fixed") === "fixed" ? Number(amount) : undefined,
        taxRate,
        taxAmount: (isRecurring ? amountType : "fixed") === "fixed" ? computedTaxAmount : undefined,
        frequency: frequency as "once" | "monthly" | "yearly" | "weekly",
        intervalCount: isRecurring ? intervalCount : undefined,
        executionDay: isRecurring && !executeOnLastDay ? (executionDay ? Number(executionDay) : undefined) : undefined,
        executeOnLastDay: isRecurring ? executeOnLastDay : undefined,
        startDate: isRecurring ? startDate : undefined,
        endDate: isRecurring && endDate ? endDate : undefined,
        scheduledPaymentDate: !isRecurring ? scheduledPaymentDate : undefined,
        note: note.trim() || undefined,
        recurringName: isRecurring ? recurringName.trim() : undefined,
        expenseOwners: owners
          .filter((o) => o.staffId || (o.customName && o.customName.trim()))
          .map((o) => ({ staffId: o.staffId, customName: o.customName })),
        useAllocation,
        allocationTemplateId: useAllocation ? allocationTemplateId : undefined,
        costCenterId: !useAllocation ? costCenterId : undefined,
        isConfidential,
      });

      if ("error" in result) return setError(result.error);

      // 証憑ファイルがあればアップロード
      if (pendingFiles.length > 0 && result.id) {
        try {
          const uploadData = new FormData();
          for (const pf of pendingFiles) {
            uploadData.append("files", pf.file);
          }
          const uploadRes = await fetch("/api/finance/payment-groups/upload", {
            method: "POST",
            body: uploadData,
          });
          if (uploadRes.ok) {
            const { files: uploaded } = await uploadRes.json();
            const { addGroupAttachments } = await import("@/app/accounting/workflow/actions");
            await addGroupAttachments(result.id, "payment", uploaded.map((f: { filePath: string; fileName: string; fileSize: number; mimeType: string }) => ({
              ...f,
              attachmentType: "voucher",
            })));
          }
        } catch {
          // アップロード失敗しても経費自体は登録済みなので続行
        }
      }

      if (result.type === "recurring") {
        alert("定期取引として登録しました。");
      } else {
        alert(mode === "accounting" ? "経費を仕訳待ちとして登録しました。" : "経費を申請しました。");
      }
      router.push(backUrl);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {formData.project ? (
              <div>
                <Label>事業部</Label>
                <Input value={formData.project.name} readOnly className="bg-muted" />
              </div>
            ) : (
              <div>
                <Label>事業部 <span className="text-red-500">*</span></Label>
                <Select value={projectId?.toString() ?? ""} onValueChange={(v) => handleProjectChange(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                  <SelectContent>
                    {formData.allProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>支払元法人 <span className="text-red-500">*</span></Label>
              <Select value={operatingCompanyId?.toString() ?? ""} onValueChange={(v) => setOperatingCompanyId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                <SelectContent>
                  {formData.operatingCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 取引先（Stella/その他/手入力タブ） */}
          <CounterpartySelector
            counterparties={formData.counterparties}
            selectedId={counterpartyId}
            customName={customCounterpartyName}
            onSelect={setCounterpartyId}
            onCustomNameChange={setCustomCounterpartyName}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>
                勘定科目（費目）{mode === "accounting" && <span className="text-red-500"> *</span>}
              </Label>
              {filteredCategories.length > 0 ? (
                <Select
                  value={expenseCategoryId?.toString() ?? ""}
                  onValueChange={(v) => setExpenseCategoryId(v ? Number(v) : null)}
                  disabled={!projectId && !formData.project}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={projectId || formData.project ? "選択..." : "先にプロジェクトを選択"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground border rounded px-3 py-2">
                  このプロジェクトに費目が登録されていません
                </p>
              )}
              {mode === "project" && (
                <p className="text-xs text-muted-foreground mt-1">任意。経理が後から設定できます</p>
              )}
            </div>
            <div>
              <Label>支払方法</Label>
              <Select value={paymentMethodId?.toString() ?? ""} onValueChange={(v) => setPaymentMethodId(v ? Number(v) : null)}>
                <SelectTrigger><SelectValue placeholder="（任意）" /></SelectTrigger>
                <SelectContent>
                  {formData.paymentMethods.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mode === "project" && (
              <div>
                <Label>承認者 <span className="text-red-500">*</span></Label>
                <Select value={approverStaffId?.toString() ?? ""} onValueChange={(v) => setApproverStaffId(Number(v))} disabled={!projectId && !formData.project}>
                  <SelectTrigger><SelectValue placeholder={projectId || formData.project ? "承認者を選択" : "先にプロジェクトを選択"} /></SelectTrigger>
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
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">金額・支払いサイクル</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className={`grid ${isRecurring ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
            <div>
              <Label>支払いサイクル <span className="text-red-500">*</span></Label>
              <Select value={frequency} onValueChange={(v) => {
                setFrequency(v);
                if (v === "once") setAmountType("fixed");
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isRecurring && (
              <div>
                <Label>金額タイプ <span className="text-red-500">*</span></Label>
                <Select value={amountType} onValueChange={(v) => setAmountType(v as "fixed" | "variable")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">固定</SelectItem>
                    <SelectItem value="variable">変動（毎回異なる）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {(isRecurring ? amountType : "fixed") === "fixed" && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>金額（税込） <span className="text-red-500">*</span></Label>
                <Input type="number" min={0} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" />
              </div>
              <div>
                <Label>税率 (%)</Label>
                <Input type="number" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
              </div>
              <div>
                <Label>消費税額（自動計算）</Label>
                <Input type="number" value={computedTaxAmount} readOnly className="bg-muted" />
              </div>
            </div>
          )}

          {isRecurring && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>名称（定期取引） <span className="text-red-500">*</span></Label>
                  <Input value={recurringName} onChange={(e) => setRecurringName(e.target.value)} placeholder="例: AWS利用料、オフィス家賃" />
                </div>
                {(frequency === "monthly" || frequency === "yearly") && (
                  <div>
                    <Label>繰り返し間隔</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} value={intervalCount} onChange={(e) => setIntervalCount(Math.max(1, Number(e.target.value)))} className="w-20" />
                      <span className="text-sm text-muted-foreground">{frequency === "monthly" ? "ヶ月ごと" : "年ごと"}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>開始日 <span className="text-red-500">*</span></Label>
                  <DatePicker value={startDate} onChange={setStartDate} />
                </div>
                <div>
                  <Label>終了日</Label>
                  <DatePicker value={endDate} onChange={setEndDate} placeholder="空欄 = 無期限" />
                </div>
                {frequency === "monthly" && (
                  <div>
                    <Label>実行日</Label>
                    {executeOnLastDay ? (
                      <Input value="月末日" readOnly className="bg-muted" />
                    ) : (
                      <Input type="number" min={1} max={31} value={executionDay} onChange={(e) => setExecutionDay(e.target.value)} placeholder="1〜31" />
                    )}
                    <label className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={executeOnLastDay} onChange={(e) => setExecuteOnLastDay(e.target.checked)} className="rounded" />
                      毎月末日に実行
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          {!isRecurring && (
            <div>
              <Label>支払予定日 <span className="text-red-500">*</span></Label>
              <DatePicker value={scheduledPaymentDate} onChange={setScheduledPaymentDate} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>担当者（複数可）</span>
            <Button type="button" size="sm" variant="outline" onClick={addOwner}><Plus className="h-3 w-3 mr-1" />追加</Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {owners.length === 0 ? (
            <p className="text-sm text-muted-foreground">担当者が設定されていません</p>
          ) : (
            <div className="space-y-2">
              {owners.map((o) => (
                <div key={o.key} className="flex gap-2 items-center">
                  <Select value={o.staffId?.toString() ?? ""} onValueChange={(v) => updateOwner(o.key, { staffId: v === "__custom__" ? null : Number(v), customName: null })}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="スタッフ選択..." /></SelectTrigger>
                    <SelectContent>
                      {formData.staffOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">その他（手入力）</SelectItem>
                    </SelectContent>
                  </Select>
                  {o.staffId === null && (
                    <Input placeholder="手入力の担当者名" value={o.customName ?? ""} onChange={(e) => updateOwner(o.key, { customName: e.target.value })} className="flex-1" />
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeOwner(o.key)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">按分設定</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="allocation"
                checked={!useAllocation}
                onChange={() => { setUseAllocation(false); setAllocationTemplateId(null); }}
                className="rounded"
              />
              <span className="text-sm">按分なし</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="allocation"
                checked={useAllocation}
                onChange={() => setUseAllocation(true)}
                className="rounded"
              />
              <span className="text-sm">按分あり</span>
            </label>
          </div>

          {useAllocation && (
            <div className="space-y-3">
              {formData.allocationTemplates.length > 0 ? (
                <>
                  <div>
                    <Label>按分テンプレート <span className="text-red-500">*</span></Label>
                    <Select value={allocationTemplateId?.toString() ?? ""} onValueChange={(v) => setAllocationTemplateId(v ? Number(v) : null)}>
                      <SelectTrigger><SelectValue placeholder="テンプレートを選択..." /></SelectTrigger>
                      <SelectContent>
                        {formData.allocationTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id.toString()}>
                            {t.name}（{t.lines.length}先）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTemplate && (
                    <div className="border rounded-lg p-3 bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground mb-2">按分内訳</p>
                      <div className="space-y-1">
                        {selectedTemplate.lines.map((line, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span>{line.costCenterName ?? line.label ?? "未確定"}</span>
                            <span className="font-mono text-muted-foreground">{line.allocationRate}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground border rounded px-3 py-2">
                  按分テンプレートが未登録です。
                  <a href="/accounting/masters/allocation-templates" className="text-blue-600 hover:underline ml-1">按分テンプレート管理</a>
                  から先に登録してください。
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">摘要・メモ</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例: 4/1 クライアントとの会食（〇〇レストラン）" rows={3} />
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isConfidential}
              onChange={(e) => setIsConfidential(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">機密（作成者・承認者・経理担当のみ閲覧可能）</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><FileText className="h-4 w-4" />証憑</span>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
                className="hidden"
              />
              <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" />ファイルを追加
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              請求書・領収書などのファイルを添付できます
            </p>
          ) : (
            <div className="space-y-2">
              {pendingFiles.map((pf) => (
                <div key={pf.key} className="flex items-center gap-3 p-2 border rounded text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{pf.file.name}</p>
                    <p className="text-xs text-muted-foreground">{(pf.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" onClick={() => removeFile(pf.key)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{pendingFiles.length}件のファイルが申請時にアップロードされます</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 pb-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "登録中..." : mode === "accounting" ? "仕訳待ちとして登録" : "申請"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(backUrl)}>キャンセル</Button>
      </div>
    </form>
  );
}
