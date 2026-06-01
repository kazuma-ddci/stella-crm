"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createAccountingGroup,
  getAccountingGroupCreateOptions,
  type AccountingGroupCreateOptions,
  type AccountingGroupKind,
} from "./accounting-group-create-actions";

type LineForm = {
  key: string;
  expenseCategoryId: string;
  amount: string;
  taxRate: string;
  allocationTemplateId: string;
  isWithholdingTarget: boolean;
  withholdingTaxRate: string;
  withholdingTaxAmount: string;
  note: string;
};

type CounterpartyOption = AccountingGroupCreateOptions["counterparties"][0];

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("ja-JP");
}

function calcIncludedTax(total: number, taxRate: number) {
  if (taxRate <= 0) return 0;
  return Math.floor(total - total / (1 + taxRate / 100));
}

function formatTargetMonth(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "-";
  const [year, month] = date.split("-");
  return `${year}年${Number(month)}月`;
}

function newLine(amount = ""): LineForm {
  return {
    key: crypto.randomUUID(),
    expenseCategoryId: "",
    amount,
    taxRate: "10",
    allocationTemplateId: "",
    isWithholdingTarget: false,
    withholdingTaxRate: "10.21",
    withholdingTaxAmount: "",
    note: "",
  };
}

function counterpartyCode(counterparty: CounterpartyOption) {
  return counterparty.companyCode || counterparty.displayId || "";
}

function naturalCodeParts(code: string) {
  const match = code.match(/^([A-Za-z]+)-(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], number: Number(match[2]) };
}

function compareAscii(a: string, b: string) {
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  const len = Math.min(aa.length, bb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = aa.charCodeAt(i) - bb.charCodeAt(i);
    if (diff !== 0) return diff;
  }
  return aa.length - bb.length;
}

function compareCounterparties(a: CounterpartyOption, b: CounterpartyOption) {
  const aCode = counterpartyCode(a);
  const bCode = counterpartyCode(b);
  const aParts = naturalCodeParts(aCode);
  const bParts = naturalCodeParts(bCode);
  if (aParts && bParts) {
    const prefixDiff = compareAscii(aParts.prefix, bParts.prefix);
    if (prefixDiff !== 0) return prefixDiff;
    const numberDiff = aParts.number - bParts.number;
    if (numberDiff !== 0) return numberDiff;
  }
  const codeDiff = compareAscii(aCode, bCode);
  if (codeDiff !== 0) return codeDiff;
  return compareAscii(a.name, b.name);
}

function CounterpartyList({
  items,
  selectedId,
  onSelect,
}: {
  items: CounterpartyOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        該当する取引先がありません
      </p>
    );
  }

  return (
    <div className="max-h-56 overflow-y-auto space-y-0.5">
      {items.map((counterparty) => {
        const selected = String(counterparty.id) === selectedId;
        const code = counterpartyCode(counterparty) || "---";
        return (
          <button
            key={counterparty.id}
            type="button"
            className={[
              "flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm hover:bg-muted",
              selected ? "bg-blue-50 font-medium text-blue-900" : "",
            ].join(" ")}
            onClick={() => onSelect(String(counterparty.id))}
          >
            <span className="min-w-0 truncate">
              <span className="mr-2 font-mono text-xs text-muted-foreground">
                {code}
              </span>
              {counterparty.name}
            </span>
            {selected && <Check className="h-4 w-4 shrink-0 text-blue-700" />}
          </button>
        );
      })}
    </div>
  );
}

function filterAndSortCounterparties(items: CounterpartyOption[], search: string) {
  const q = search.trim().toLowerCase();
  const sorted = [...items].sort(compareCounterparties);
  if (!q) return sorted;
  return sorted.filter((counterparty) => {
    const displayId = counterparty.displayId?.toLowerCase() ?? "";
    const companyCode = counterparty.companyCode?.toLowerCase() ?? "";
    return (
      counterparty.name.toLowerCase().includes(q) ||
      displayId.includes(q) ||
      companyCode.includes(q)
    );
  });
}

export function AccountingGroupCreateModal({
  open,
  onOpenChange,
  sourceEntryId = null,
  initialKind = "invoice",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceEntryId?: number | null;
  initialKind?: AccountingGroupKind;
  onCreated?: (created: { groupKind: AccountingGroupKind; groupId: number; label: string }) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [options, setOptions] = useState<AccountingGroupCreateOptions | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [groupKind, setGroupKind] = useState<AccountingGroupKind>(initialKind);
  const [operatingCompanyId, setOperatingCompanyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [customCounterpartyName, setCustomCounterpartyName] = useState("");
  const [counterpartySearch, setCounterpartySearch] = useState("");
  const [counterpartyTab, setCounterpartyTab] = useState("stella");
  const [expectedDate, setExpectedDate] = useState("");
  const [accountingDate, setAccountingDate] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineForm[]>([newLine()]);

  const resetForm = () => {
    setOptions(null);
    setLoadedKey("");
    setGroupKind(initialKind);
    setOperatingCompanyId("");
    setProjectId("");
    setCounterpartyId("");
    setCustomCounterpartyName("");
    setCounterpartySearch("");
    setCounterpartyTab("stella");
    setExpectedDate("");
    setAccountingDate("");
    setNote("");
    setLines([newLine()]);
  };

  const requestKey = `${sourceEntryId ?? "none"}:${initialKind}`;
  const isReady = !!options && loadedKey === requestKey;

  useEffect(() => {
    if (!open) return;
    const currentKey = requestKey;
    getAccountingGroupCreateOptions(sourceEntryId)
      .then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setLoadedKey(currentKey);
        setOptions(res.data);
        const entry = res.data.sourceEntry;
        const nextKind = entry?.direction ?? initialKind;
        const nextCompanyId = entry?.operatingCompanyId
          ? String(entry.operatingCompanyId)
          : res.data.operatingCompanies[0]?.id
            ? String(res.data.operatingCompanies[0].id)
            : "";
        setGroupKind(nextKind);
        setOperatingCompanyId(nextCompanyId);
        const initialProject =
          res.data.projects.find(
            (project) =>
              nextCompanyId &&
              (project.operatingCompanyId === null ||
                project.operatingCompanyId === Number(nextCompanyId))
          ) ?? res.data.projects[0];
        setProjectId(initialProject?.id ? String(initialProject.id) : "");
        setCounterpartyId("");
        setCustomCounterpartyName("");
        setCounterpartySearch("");
        setCounterpartyTab("stella");
        const initialDate = entry?.transactionDate ?? new Date().toISOString().slice(0, 10);
        setExpectedDate(initialDate);
        setAccountingDate(initialDate);
        setNote(entry?.description ?? "");
        setLines([newLine(entry?.remainingAmount && entry.remainingAmount > 0 ? String(entry.remainingAmount) : "")]);
      })
      .catch(() => toast.error("作成フォームの取得に失敗しました"));
  }, [open, sourceEntryId, initialKind, requestKey]);

  const selectedProjectId = projectId ? Number(projectId) : null;
  const selectedProject = useMemo(() => {
    if (!options || !selectedProjectId) return null;
    return options.projects.find((project) => project.id === selectedProjectId) ?? null;
  }, [options, selectedProjectId]);
  const projectOptions = useMemo(() => {
    if (!options) return [];
    const selectedCompanyId = operatingCompanyId ? Number(operatingCompanyId) : null;
    return options.projects.filter(
      (project) =>
        project.operatingCompanyId === null ||
        selectedCompanyId === null ||
        project.operatingCompanyId === selectedCompanyId
    );
  }, [operatingCompanyId, options]);
  const categoryType = groupKind === "invoice" ? "revenue" : "expense";
  const categoryOptions = useMemo(() => {
    if (!options || !selectedProject?.categoryProjectId) return [];
    return options.expenseCategories.filter(
      (category) =>
        category.projectId === selectedProject.categoryProjectId &&
        (category.type === categoryType || category.type === "both")
    );
  }, [categoryType, options, selectedProject]);

  const lineTotal = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const withholdingTotal = lines.reduce(
    (sum, line) => sum + (line.isWithholdingTarget ? Number(line.withholdingTaxAmount) || 0 : 0),
    0
  );
  const netPaymentTotal = lineTotal - withholdingTotal;
  const sourceRemaining = options?.sourceEntry?.remainingAmount ?? null;
  const sourceMismatch =
    sourceRemaining !== null && lineTotal > 0 && lineTotal !== sourceRemaining;
  const selectedCounterparty = useMemo(() => {
    if (!options || !counterpartyId) return null;
    return options.counterparties.find((counterparty) => String(counterparty.id) === counterpartyId) ?? null;
  }, [counterpartyId, options]);
  const selectedCounterpartyLabel = useMemo(() => {
    if (customCounterpartyName.trim()) return `手入力: ${customCounterpartyName.trim()}`;
    if (!selectedCounterparty) return null;
    const code = counterpartyCode(selectedCounterparty);
    return code ? `${code} - ${selectedCounterparty.name}` : selectedCounterparty.name;
  }, [customCounterpartyName, selectedCounterparty]);
  const stellaCounterparties = useMemo(() => {
    if (!options) return [];
    return filterAndSortCounterparties(
      options.counterparties.filter((counterparty) => counterparty.companyId !== null),
      counterpartySearch
    );
  }, [counterpartySearch, options]);
  const otherCounterparties = useMemo(() => {
    if (!options) return [];
    return filterAndSortCounterparties(
      options.counterparties.filter((counterparty) => counterparty.companyId === null),
      counterpartySearch
    );
  }, [counterpartySearch, options]);

  const updateLine = (key: string, patch: Partial<LineForm>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const recalcWithholding = (line: LineForm, patch: Partial<LineForm> = {}) => {
    const next = { ...line, ...patch };
    const amount = Number(next.amount) || 0;
    const rate = Number(next.withholdingTaxRate) || 0;
    return amount > 0 && rate > 0 ? String(Math.floor((amount * rate) / 100)) : "";
  };

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.key !== key) : prev));
  };

  const handleSubmit = () => {
    if (!isReady) return;
    if (!operatingCompanyId) return toast.error("法人を選択してください");
    if (!projectId) return toast.error("プロジェクトを選択してください");
    if (!counterpartyId && !customCounterpartyName.trim()) {
      return toast.error("取引先を選択するか、取引先名を入力してください");
    }
    if (!expectedDate) return toast.error("予定日を入力してください");
    if (!accountingDate) return toast.error("計上日を入力してください");
    if (lines.length === 0) return toast.error("明細を入力してください");

    const payloadLines = lines.map((line) => ({
      expenseCategoryId: Number(line.expenseCategoryId),
      amount: Number(line.amount),
      taxRate: Number(line.taxRate),
      allocationTemplateId: line.allocationTemplateId ? Number(line.allocationTemplateId) : null,
      isWithholdingTarget: groupKind === "payment" && line.isWithholdingTarget,
      withholdingTaxRate:
        groupKind === "payment" && line.isWithholdingTarget
          ? Number(line.withholdingTaxRate)
          : null,
      withholdingTaxAmount:
        groupKind === "payment" && line.isWithholdingTarget
          ? Number(line.withholdingTaxAmount)
          : null,
      note: line.note.trim() || null,
    }));
    if (payloadLines.some((line) => !line.expenseCategoryId)) {
      return toast.error("すべての明細で費目を選択してください");
    }
    if (payloadLines.some((line) => !Number.isInteger(line.amount) || line.amount <= 0)) {
      return toast.error("すべての明細金額を1円以上の整数で入力してください");
    }
    if (
      payloadLines.some(
        (line) =>
          line.isWithholdingTarget &&
          (!Number.isFinite(line.withholdingTaxRate) ||
            line.withholdingTaxRate === null ||
            line.withholdingTaxRate < 0 ||
            !Number.isInteger(line.withholdingTaxAmount) ||
            line.withholdingTaxAmount === null ||
            line.withholdingTaxAmount < 0)
      )
    ) {
      return toast.error("源泉徴収の入力を確認してください");
    }

    startTransition(async () => {
      const result = await createAccountingGroup({
        groupKind,
        sourceEntryId,
        operatingCompanyId: Number(operatingCompanyId),
        costCenterId: Number(projectId),
        counterpartyId: counterpartyId ? Number(counterpartyId) : null,
        customCounterpartyName: customCounterpartyName.trim() || null,
        expectedDate,
        accountingDate,
        note: note.trim() || null,
        lines: payloadLines,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.label} を作成しました`);
      onCreated?.(result.data);
      onOpenChange(false);
    });
  };

  const title =
    groupKind === "invoice" ? "請求グループを作成" : "支払グループを作成";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="wide" className="max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {!isReady ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中...
          </div>
        ) : (
          <div className="space-y-4">
            {options.sourceEntry && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{options.sourceEntry.transactionDate}</Badge>
                  <Badge className={groupKind === "invoice" ? "bg-green-600" : "bg-red-600"}>
                    {groupKind === "invoice" ? "入金" : "出金"} {fmt(options.sourceEntry.amount)}円
                  </Badge>
                  <Badge variant="outline">
                    未紐づけ {fmt(options.sourceEntry.remainingAmount)}円
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {options.sourceEntry.description}
                </div>
                {sourceMismatch && (
                  <div className="text-xs text-amber-700">
                    明細合計と入出金の未紐づけ金額は一致していません。作成後は小さい方の金額だけ紐づき、残額は後から追加紐づけできます。
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {!options.sourceEntry && (
                <>
                  <div className="space-y-1">
                    <Label>種別</Label>
                    <Select
                      value={groupKind}
                      onValueChange={(value) => {
                        const nextKind = value as AccountingGroupKind;
                        setGroupKind(nextKind);
                        if (nextKind === "invoice") {
                          setLines((prev) =>
                            prev.map((line) => ({
                              ...line,
                              isWithholdingTarget: false,
                              withholdingTaxAmount: "",
                            }))
                          );
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invoice">請求グループ</SelectItem>
                        <SelectItem value="payment">支払グループ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>法人</Label>
                    <Select
                      value={operatingCompanyId}
                      onValueChange={(value) => {
                        setOperatingCompanyId(value);
                        const nextProject = options.projects.find(
                          (project) =>
                            project.operatingCompanyId === null ||
                            project.operatingCompanyId === Number(value)
                        );
                        setProjectId(nextProject?.id ? String(nextProject.id) : "");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="法人を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.operatingCompanies.map((company) => (
                          <SelectItem key={company.id} value={String(company.id)}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label>プロジェクト</Label>
                <Select
                  value={projectId}
                  onValueChange={(value) => {
                    setProjectId(value);
                    setLines((prev) =>
                      prev.map((line) => ({
                        ...line,
                        expenseCategoryId: "",
                        allocationTemplateId: "",
                      }))
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="プロジェクトを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectOptions.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>取引先</Label>
                <div className="rounded-md border">
                  <div className="border-b p-2">
                    {selectedCounterpartyLabel && (
                      <div className="mb-2 flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate">{selectedCounterpartyLabel}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setCounterpartyId("");
                            setCustomCounterpartyName("");
                          }}
                          aria-label="取引先選択を解除"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={counterpartySearch}
                        onChange={(event) => setCounterpartySearch(event.target.value)}
                        placeholder="取引先名・表示ID・会社コードで検索"
                        className="h-9 pl-8"
                      />
                    </div>
                  </div>
                  <Tabs value={counterpartyTab} onValueChange={setCounterpartyTab}>
                    <TabsList className="h-8 w-full rounded-none border-b">
                      <TabsTrigger value="stella" className="h-7 flex-1 text-xs">
                        Stella顧客 ({stellaCounterparties.length})
                      </TabsTrigger>
                      <TabsTrigger value="other" className="h-7 flex-1 text-xs">
                        その他 ({otherCounterparties.length})
                      </TabsTrigger>
                      <TabsTrigger value="manual" className="h-7 flex-1 text-xs">
                        手入力
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="stella" className="m-0 p-1">
                      <CounterpartyList
                        items={stellaCounterparties}
                        selectedId={counterpartyId}
                        onSelect={(id) => {
                          setCounterpartyId(id);
                          setCustomCounterpartyName("");
                        }}
                      />
                    </TabsContent>
                    <TabsContent value="other" className="m-0 p-1">
                      <CounterpartyList
                        items={otherCounterparties}
                        selectedId={counterpartyId}
                        onSelect={(id) => {
                          setCounterpartyId(id);
                          setCustomCounterpartyName("");
                        }}
                      />
                    </TabsContent>
                    <TabsContent value="manual" className="m-0 space-y-1 p-2">
                      <Input
                        value={customCounterpartyName}
                        onChange={(event) => {
                          setCustomCounterpartyName(event.target.value);
                          setCounterpartyId("");
                        }}
                        placeholder="取引先名を入力"
                      />
                      <p className="text-xs text-muted-foreground">
                        未登録の取引先は、作成時に「その他取引先」として自動登録されます
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              <div className="space-y-1">
                <Label>{groupKind === "invoice" ? "入金予定日" : "支払予定日"}</Label>
                <DatePicker value={expectedDate} onChange={setExpectedDate} />
              </div>
              <div className="space-y-1">
                <Label>計上日</Label>
                <DatePicker value={accountingDate} onChange={setAccountingDate} />
                <p className="text-xs text-muted-foreground">
                  対象月: {formatTargetMonth(accountingDate)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>明細</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setLines((prev) => [...prev, newLine()])}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  明細追加
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((line, index) => (
                  <div key={line.key} className="rounded-md border p-3">
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem_6rem_2rem]">
                      <div className="space-y-1">
                        <Label className="text-xs">費目</Label>
                        <Select
                          value={line.expenseCategoryId}
                          onValueChange={(value) => updateLine(line.key, { expenseCategoryId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="費目を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map((category) => (
                              <SelectItem key={category.id} value={String(category.id)}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={line.note}
                          onChange={(event) => updateLine(line.key, { note: event.target.value })}
                          placeholder={`明細${index + 1}のメモ`}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">税込金額</Label>
                        <Input
                          type="number"
                          min={1}
                          value={line.amount}
                          onChange={(event) => {
                            const amount = event.target.value;
                            updateLine(line.key, {
                              amount,
                              withholdingTaxAmount: line.isWithholdingTarget
                                ? recalcWithholding(line, { amount })
                                : line.withholdingTaxAmount,
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">税率</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={line.taxRate}
                          onChange={(event) => updateLine(line.key, { taxRate: event.target.value })}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          税額 {fmt(calcIncludedTax(Number(line.amount) || 0, Number(line.taxRate) || 0))}円
                        </p>
                      </div>
                      <div className="flex items-start pt-6">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => removeLine(line.key)}
                          disabled={lines.length === 1}
                          aria-label="明細を削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">按分</Label>
                        {options.allocationTemplates.length > 0 ? (
                          <Select
                            value={line.allocationTemplateId || "_none"}
                            onValueChange={(value) =>
                              updateLine(line.key, {
                                allocationTemplateId: value === "_none" ? "" : value,
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">主プロジェクトに全額計上</SelectItem>
                              {options.allocationTemplates.map((template) => (
                                <SelectItem key={template.id} value={String(template.id)}>
                                  {template.name}（{template.lines.length}先）
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="rounded border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                            按分テンプレート未登録。作成後の詳細画面で設定できます。
                          </p>
                        )}
                      </div>

                      {groupKind === "payment" && (
                        <div className="space-y-2 rounded border bg-muted/20 p-2">
                          <label className="flex items-center gap-2 text-xs font-medium">
                            <input
                              type="checkbox"
                              checked={line.isWithholdingTarget}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                updateLine(line.key, {
                                  isWithholdingTarget: checked,
                                  withholdingTaxAmount: checked
                                    ? recalcWithholding(line)
                                    : "",
                                });
                              }}
                            />
                            源泉徴収対象
                          </label>
                          {line.isWithholdingTarget && (
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">税率(%)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={line.withholdingTaxRate}
                                  onChange={(event) => {
                                    const withholdingTaxRate = event.target.value;
                                    updateLine(line.key, {
                                      withholdingTaxRate,
                                      withholdingTaxAmount: recalcWithholding(line, {
                                        withholdingTaxRate,
                                      }),
                                    });
                                  }}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">源泉徴収額</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={line.withholdingTaxAmount}
                                  onChange={(event) =>
                                    updateLine(line.key, { withholdingTaxAmount: event.target.value })
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">差引支払額</Label>
                                <div className="h-8 rounded border bg-background px-2 py-1.5 text-right text-xs font-medium">
                                  {fmt((Number(line.amount) || 0) - (Number(line.withholdingTaxAmount) || 0))}円
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-right text-sm">
                <div>
                  明細合計: <strong>{fmt(lineTotal)}円</strong>
                </div>
                {groupKind === "payment" && withholdingTotal > 0 && (
                  <div className="text-xs text-muted-foreground">
                    源泉徴収合計: {fmt(withholdingTotal)}円 / 差引支払額: {fmt(netPaymentTotal)}円
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>グループメモ</Label>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="摘要・補足"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !isReady}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                作成中
              </>
            ) : (
              "作成"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
