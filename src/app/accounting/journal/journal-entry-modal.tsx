"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toLocalDateString } from "@/lib/utils";
import {
  createJournalEntry,
  updateJournalEntry,
  type JournalEntryLineInput,
  type JournalFormData,
} from "./actions";
import {
  TAX_CLASSIFICATIONS_WITH_INVOICE,
  TAX_CLASSIFICATIONS_WITHOUT_INVOICE,
  REALIZATION_STATUSES,
  calcTaxAmount,
} from "./constants";

type JournalEntryForEdit = {
  id: number;
  journalDate: Date;
  description: string;
  invoiceGroupId: number | null;
  paymentGroupId: number | null;
  transactionId: number | null;
  bankTransactionId: number | null;
  projectId: number | null;
  counterpartyId: number | null;
  hasInvoice: boolean;
  realizationStatus: string;
  lines: {
    id: number;
    side: string;
    accountId: number;
    amount: number;
    description: string | null;
    taxClassification: string | null;
    taxAmount: number | null;
  }[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: JournalFormData;
  editEntry?: JournalEntryForEdit | null;
  onSuccess?: () => void;
  defaultTransactionId?: number;
  defaultProjectId?: number;
  defaultCounterpartyId?: number;
};

type LineFormState = {
  key: string;
  side: "debit" | "credit";
  accountId: string;
  amount: string;
  description: string;
  taxClassification: string;
  taxAmount: string;
  taxManuallyEdited: boolean;
};

function generateKey() {
  return Math.random().toString(36).substring(2, 9);
}

function createEmptyLine(side: "debit" | "credit"): LineFormState {
  return {
    key: generateKey(),
    side,
    accountId: "",
    amount: "",
    description: "",
    taxClassification: "",
    taxAmount: "",
    taxManuallyEdited: false,
  };
}

// 勘定科目のカテゴリから消費税勘定（仮払 or 仮受）を判定
// 費用系・資産 → 仮払消費税、収益系・負債 → 仮受消費税
const INPUT_TAX_CATEGORIES = new Set([
  "expense", "cost_of_sales", "sga",
  "non_operating_expense", "extraordinary_loss", "asset",
]);
const OUTPUT_TAX_CATEGORIES = new Set([
  "revenue", "non_operating_revenue", "extraordinary_income", "liability",
]);

function determineTaxAccountId(
  accountCategory: string,
  inputTaxAccountId: number,
  outputTaxAccountId: number,
): number | null {
  if (INPUT_TAX_CATEGORIES.has(accountCategory)) return inputTaxAccountId;
  if (OUTPUT_TAX_CATEGORIES.has(accountCategory)) return outputTaxAccountId;
  return null; // equity等は消費税なし
}

function formatNumber(value: string): string {
  const num = parseInt(value.replace(/,/g, ""), 10);
  if (isNaN(num)) return "";
  return num.toLocaleString();
}

function unformatNumber(value: string): string {
  return value.replace(/,/g, "");
}

export function JournalEntryModal({
  open,
  onOpenChange,
  formData,
  editEntry,
  onSuccess,
  defaultTransactionId,
  defaultProjectId,
  defaultCounterpartyId,
}: Props) {
  const isEdit = !!editEntry;

  // デフォルト値の算出
  const initialProjectId = editEntry?.projectId
    ? String(editEntry.projectId)
    : defaultProjectId
      ? String(defaultProjectId)
      : "";
  const initialCounterpartyId = editEntry?.counterpartyId
    ? String(editEntry.counterpartyId)
    : defaultCounterpartyId
      ? String(defaultCounterpartyId)
      : "";

  // 取引先のインボイス登録状態からデフォルト値を算出
  const initialHasInvoice = editEntry
    ? editEntry.hasInvoice
    : initialCounterpartyId
      ? formData.counterparties.find(
          (c) => String(c.id) === initialCounterpartyId
        )?.isInvoiceRegistered ?? true
      : true;

  const [journalDate, setJournalDate] = useState(
    editEntry
      ? toLocalDateString(new Date(editEntry.journalDate))
      : toLocalDateString(new Date())
  );
  const [description, setDescription] = useState(
    editEntry?.description ?? ""
  );
  const [projectId, setProjectId] = useState(initialProjectId);
  const [counterpartyId, setCounterpartyId] = useState(initialCounterpartyId);
  const [hasInvoice, setHasInvoice] = useState(initialHasInvoice);
  const [realizationStatus, setRealizationStatus] = useState(
    editEntry?.realizationStatus ?? ""
  );
  const [bankTransactionId, setBankTransactionId] = useState(
    editEntry?.bankTransactionId ? String(editEntry.bankTransactionId) : "none"
  );
  const [lines, setLines] = useState<LineFormState[]>(() => {
    if (editEntry?.lines && editEntry.lines.length > 0) {
      return editEntry.lines.map((l) => ({
        key: generateKey(),
        side: l.side as "debit" | "credit",
        accountId: String(l.accountId),
        amount: String(l.amount),
        description: l.description ?? "",
        taxClassification: l.taxClassification ?? "",
        taxAmount: l.taxAmount != null ? String(l.taxAmount) : "",
        taxManuallyEdited: false,
      }));
    }
    return [createEmptyLine("debit"), createEmptyLine("credit")];
  });
  const [submitting, setSubmitting] = useState(false);
  const [showTaxFields, setShowTaxFields] = useState(() => {
    if (editEntry?.lines) {
      return editEntry.lines.some((l) => l.taxClassification);
    }
    return false;
  });

  // モーダルオープン時にフォームをリセット（前回のデータが残らないように）
  useEffect(() => {
    if (open && !editEntry) {
      const pid = defaultProjectId ? String(defaultProjectId) : "";
      const cpid = defaultCounterpartyId ? String(defaultCounterpartyId) : "";
      const cpHasInvoice = cpid
        ? formData.counterparties.find((c) => String(c.id) === cpid)
            ?.isInvoiceRegistered ?? true
        : true;

      setJournalDate(toLocalDateString(new Date()));
      setDescription("");
      setProjectId(pid);
      setCounterpartyId(cpid);
      setHasInvoice(cpHasInvoice);
      setRealizationStatus("");
      setBankTransactionId("none");
      setLines([createEmptyLine("debit"), createEmptyLine("credit")]);
      setShowTaxFields(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // プロジェクト/取引先の変更警告ダイアログ
  const [changeConfirm, setChangeConfirm] = useState<{
    field: "project" | "counterparty";
    newValue: string;
  } | null>(null);

  const hasDefaultProject = !!initialProjectId;
  const hasDefaultCounterparty = !!initialCounterpartyId;

  const handleProjectChange = useCallback(
    (value: string) => {
      if (hasDefaultProject && value !== initialProjectId && value !== "none") {
        setChangeConfirm({ field: "project", newValue: value });
      } else {
        setProjectId(value === "none" ? "" : value);
      }
    },
    [hasDefaultProject, initialProjectId]
  );

  const handleCounterpartyChange = useCallback(
    (value: string) => {
      if (
        hasDefaultCounterparty &&
        value !== initialCounterpartyId &&
        value !== "none"
      ) {
        setChangeConfirm({ field: "counterparty", newValue: value });
      } else {
        setCounterpartyId(value === "none" ? "" : value);
        if (value && value !== "none") {
          const cp = formData.counterparties.find(
            (c) => String(c.id) === value
          );
          if (cp) setHasInvoice(cp.isInvoiceRegistered);
        }
      }
    },
    [hasDefaultCounterparty, initialCounterpartyId, formData.counterparties]
  );

  const confirmFieldChange = useCallback(() => {
    if (!changeConfirm) return;
    if (changeConfirm.field === "project") {
      setProjectId(changeConfirm.newValue);
    } else {
      setCounterpartyId(changeConfirm.newValue);
      const cp = formData.counterparties.find(
        (c) => String(c.id) === changeConfirm.newValue
      );
      if (cp) setHasInvoice(cp.isInvoiceRegistered);
    }
    setChangeConfirm(null);
  }, [changeConfirm, formData.counterparties]);

  const accountOptions = useMemo(() => {
    const categoryLabels: Record<string, string> = {
      asset: "資産",
      liability: "負債",
      equity: "純資産",
      revenue: "収益",
      expense: "費用",
      cost_of_sales: "売上原価",
      sga: "販管費",
      non_operating_revenue: "営業外収益",
      non_operating_expense: "営業外費用",
      extraordinary_income: "特別利益",
      extraordinary_loss: "特別損失",
    };
    const grouped: Record<string, typeof formData.accounts> = {};
    for (const acc of formData.accounts) {
      if (!grouped[acc.category]) grouped[acc.category] = [];
      grouped[acc.category].push(acc);
    }
    return { grouped, categoryLabels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.accounts]);

  const taxClassificationOptions = useMemo(
    () =>
      hasInvoice
        ? TAX_CLASSIFICATIONS_WITH_INVOICE
        : TAX_CLASSIFICATIONS_WITHOUT_INVOICE,
    [hasInvoice]
  );

  // 合計計算: 税抜金額 + 自動生成される消費税額を含む
  const { debitTotal, creditTotal, difference, debitTax, creditTax } =
    useMemo(() => {
      let dtAmount = 0;
      let dtTax = 0;
      let ctAmount = 0;
      let ctTax = 0;
      for (const l of lines) {
        const amt = Number(unformatNumber(l.amount)) || 0;
        const tax = Number(unformatNumber(l.taxAmount)) || 0;
        if (l.side === "debit") {
          dtAmount += amt;
          dtTax += tax;
        } else {
          ctAmount += amt;
          ctTax += tax;
        }
      }
      return {
        debitTotal: dtAmount + dtTax,
        creditTotal: ctAmount + ctTax,
        difference: dtAmount + dtTax - (ctAmount + ctTax),
        debitTax: dtTax,
        creditTax: ctTax,
      };
    }, [lines]);

  const updateLine = useCallback(
    (key: string, field: keyof LineFormState, value: string) => {
      setLines((prev) =>
        prev.map((l) => {
          if (l.key !== key) return l;
          const updated = { ...l, [field]: value };
          if (
            (field === "amount" || field === "taxClassification") &&
            !updated.taxManuallyEdited
          ) {
            const amt = Number(unformatNumber(updated.amount)) || 0;
            const tc = updated.taxClassification;
            if (tc && tc !== "none" && amt > 0) {
              updated.taxAmount = String(calcTaxAmount(amt, tc));
            } else {
              updated.taxAmount = "";
            }
          }
          return updated;
        })
      );
    },
    []
  );

  const addLine = useCallback((side: "debit" | "credit") => {
    setLines((prev) => [...prev, createEmptyLine(side)]);
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((l) => l.key !== key);
    });
  }, []);

  // 税額手動変更
  const [taxEditConfirm, setTaxEditConfirm] = useState<{
    lineKey: string;
    newValue: string;
  } | null>(null);

  const handleTaxAmountChange = useCallback(
    (key: string, value: string) => {
      const line = lines.find((l) => l.key === key);
      if (!line) return;
      const rawValue = unformatNumber(value);
      const amt = Number(unformatNumber(line.amount)) || 0;
      const tc = line.taxClassification;
      const autoCalc =
        tc && tc !== "none" && amt > 0 ? calcTaxAmount(amt, tc) : 0;

      if (rawValue && Number(rawValue) !== autoCalc) {
        setTaxEditConfirm({ lineKey: key, newValue: rawValue });
      } else {
        setLines((prev) =>
          prev.map((l) =>
            l.key === key
              ? { ...l, taxAmount: rawValue, taxManuallyEdited: false }
              : l
          )
        );
      }
    },
    [lines]
  );

  const confirmTaxEdit = useCallback(() => {
    if (!taxEditConfirm) return;
    setLines((prev) =>
      prev.map((l) =>
        l.key === taxEditConfirm.lineKey
          ? {
              ...l,
              taxAmount: taxEditConfirm.newValue,
              taxManuallyEdited: true,
            }
          : l
      )
    );
    setTaxEditConfirm(null);
  }, [taxEditConfirm]);

  // 取引先タブ切替
  const [counterpartyTab, setCounterpartyTab] = useState<"stella" | "project" | "other">(() => {
    if (initialCounterpartyId) {
      const cp = formData.counterparties.find(
        (c) => String(c.id) === initialCounterpartyId
      );
      if (cp?.costCenterId) return "project";
      return cp?.companyId ? "stella" : "other";
    }
    return "stella";
  });

  // タブごとの取引先リスト
  const stellaCounterparties = useMemo(
    () => formData.counterparties.filter((c) => c.companyId !== null && c.costCenterId === null),
    [formData.counterparties]
  );
  const projectCounterparties = useMemo(
    () => formData.counterparties.filter((c) => c.costCenterId !== null),
    [formData.counterparties]
  );
  const otherCounterparties = useMemo(
    () => formData.counterparties.filter((c) => c.companyId === null && c.costCenterId === null),
    [formData.counterparties]
  );

  const handleSubmit = async (status: "draft" | "confirmed" = "confirmed") => {
    if (status === "confirmed" && !realizationStatus) {
      toast.error("実現ステータスを選択してください");
      return;
    }
    // 消費税勘定科目の存在チェック
    const { inputTaxAccountId, outputTaxAccountId } = formData.taxAccounts;
    const hasTaxLines = lines.some(
      (l) =>
        l.taxClassification &&
        l.taxClassification !== "none" &&
        Number(unformatNumber(l.taxAmount)) > 0
    );
    if (hasTaxLines && (!inputTaxAccountId || !outputTaxAccountId)) {
      toast.error(
        "仮払消費税・仮受消費税の勘定科目が登録されていません。マスタ管理から追加してください。"
      );
      return;
    }

    setSubmitting(true);
    try {
      const lineData: JournalEntryLineInput[] = [];

      for (const l of lines) {
        // 本体行（税抜金額）
        lineData.push({
          side: l.side,
          accountId: Number(l.accountId),
          amount: Number(unformatNumber(l.amount)),
          description: l.description || undefined,
          taxClassification:
            l.taxClassification && l.taxClassification !== "none"
              ? l.taxClassification
              : undefined,
          taxAmount: l.taxAmount
            ? Number(unformatNumber(l.taxAmount))
            : undefined,
        });

        // 消費税行を自動生成（勘定科目カテゴリから仮払/仮受を判定）
        const taxAmt = Number(unformatNumber(l.taxAmount)) || 0;
        if (
          taxAmt > 0 &&
          l.taxClassification &&
          l.taxClassification !== "none"
        ) {
          const account = formData.accounts.find(
            (a) => String(a.id) === l.accountId
          );
          const taxAccountId = account
            ? determineTaxAccountId(
                account.category,
                inputTaxAccountId!,
                outputTaxAccountId!,
              )
            : null;
          if (!taxAccountId) {
            toast.error(
              `勘定科目「${account?.name ?? "不明"}」のカテゴリでは消費税の自動判定ができません。消費税区分を「なし」にしてください。`
            );
            setSubmitting(false);
            return;
          }
          lineData.push({
            side: l.side,
            accountId: taxAccountId,
            amount: taxAmt,
            description: l.description
              ? `${l.description}（消費税）`
              : "消費税",
          });
        }
      }

      const payload: Record<string, unknown> = {
        journalDate,
        description,
        lines: lineData,
        invoiceGroupId: editEntry?.invoiceGroupId ?? null,
        paymentGroupId: editEntry?.paymentGroupId ?? null,
        transactionId:
          editEntry?.transactionId ?? defaultTransactionId ?? null,
        bankTransactionId:
          bankTransactionId && bankTransactionId !== "none"
            ? Number(bankTransactionId)
            : null,
        projectId: projectId ? Number(projectId) : null,
        counterpartyId: counterpartyId ? Number(counterpartyId) : null,
        hasInvoice,
        status,
        realizationStatus: realizationStatus || "unrealized",
        scheduledDate: null,
      };

      if (isEdit && editEntry) {
        const result = await updateJournalEntry(editEntry.id, payload);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("仕訳を更新しました");
      } else {
        const result = await createJournalEntry(payload);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("仕訳を作成しました");
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "保存に失敗しました"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = useCallback(() => {
    if (!editEntry) {
      setJournalDate(toLocalDateString(new Date()));
      setDescription("");
      setProjectId(initialProjectId);
      setCounterpartyId(initialCounterpartyId);
      setHasInvoice(initialHasInvoice);
      setRealizationStatus("");
      setBankTransactionId("none");
      setLines([createEmptyLine("debit"), createEmptyLine("credit")]);
      setShowTaxFields(false);
    }
  }, [editEntry, initialProjectId, initialCounterpartyId, initialHasInvoice]);

  const debitLines = lines.filter((l) => l.side === "debit");
  const creditLines = lines.filter((l) => l.side === "credit");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent size="fullwidth" className="p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4">
          <DialogTitle className="text-lg">
            {isEdit ? "仕訳編集" : "新規仕訳作成"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
          {/* ヘッダー情報: 仕訳日・摘要 */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                仕訳日 *
              </Label>
              <DatePicker
                value={journalDate}
                onChange={setJournalDate}
                className="mt-1"
              />
            </div>
            <div className="col-span-3">
              <Label className="text-xs text-muted-foreground">摘要 *</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="仕訳の摘要を入力"
                className="mt-1"
              />
            </div>
          </div>

          {/* プロジェクト・取引先・インボイス有無 */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                プロジェクト
              </Label>
              <Select
                value={projectId || "none"}
                onValueChange={handleProjectChange}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">なし</SelectItem>
                  {formData.projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3">
              <Label className="text-xs text-muted-foreground">取引先</Label>
              <div className="mt-1 flex gap-2 items-center">
                <div className="flex border rounded-md overflow-hidden shrink-0">
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      counterpartyTab === "stella"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-100"
                    }`}
                    onClick={() => setCounterpartyTab("stella")}
                  >
                    顧客マスタ
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      counterpartyTab === "other"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-100"
                    }`}
                    onClick={() => setCounterpartyTab("other")}
                  >
                    その他取引先
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      counterpartyTab === "project"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-100"
                    }`}
                    onClick={() => setCounterpartyTab("project")}
                  >
                    プロジェクト
                  </button>
                </div>
                <Select
                  value={counterpartyId || "none"}
                  onValueChange={handleCounterpartyChange}
                >
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">なし</SelectItem>
                    {(counterpartyTab === "stella"
                      ? stellaCounterparties
                      : counterpartyTab === "project"
                        ? projectCounterparties
                        : otherCounterparties
                    ).map((cp) => (
                      <SelectItem key={cp.id} value={String(cp.id)}>
                        {cp.displayId ? `${cp.displayId} ${cp.name}` : cp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 実現ステータス・入出金紐付け・インボイス */}
          <div className="flex gap-3 items-end">
            <div className="w-44">
              <Label className="text-xs text-muted-foreground">
                実現ステータス *
              </Label>
              <Select
                value={realizationStatus || "placeholder"}
                onValueChange={(v) =>
                  setRealizationStatus(v === "placeholder" ? "" : v)
                }
              >
                <SelectTrigger
                  className={`mt-1 h-9 ${
                    !realizationStatus ? "text-muted-foreground" : ""
                  }`}
                >
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placeholder" disabled>
                    選択してください
                  </SelectItem>
                  {REALIZATION_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground">
                入出金紐付け
              </Label>
              <Select
                value={bankTransactionId}
                onValueChange={setBankTransactionId}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="なし" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">なし</SelectItem>
                  {formData.bankTransactions.map((bt) => (
                    <SelectItem key={bt.id} value={String(bt.id)}>
                      {new Date(bt.transactionDate).toLocaleDateString(
                        "ja-JP"
                      )}{" "}
                      {bt.direction === "incoming" ? "入金" : "出金"} ¥
                      {bt.amount.toLocaleString()}
                      {bt.counterparty ? ` ${bt.counterparty.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Checkbox
                id="hasInvoice"
                checked={hasInvoice}
                onCheckedChange={(checked) =>
                  setHasInvoice(checked === true)
                }
              />
              <Label
                htmlFor="hasInvoice"
                className="text-xs cursor-pointer whitespace-nowrap"
              >
                適格請求書（インボイス）あり
              </Label>
            </div>
          </div>

          {/* 消費税フィールド表示切替 */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="showTax"
              checked={showTaxFields}
              onCheckedChange={(checked) =>
                setShowTaxFields(checked === true)
              }
            />
            <Label htmlFor="showTax" className="text-xs cursor-pointer">
              消費税区分を入力する
            </Label>
          </div>

          {/* ====== 借方・貸方 左右レイアウト ====== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SideColumn
              side="debit"
              label="借方（Debit）"
              color="blue"
              lines={debitLines}
              totalLines={lines.length}
              total={debitTotal}
              taxTotal={debitTax}
              accounts={formData.accounts}
              taxAccounts={formData.taxAccounts}
              accountOptions={accountOptions}
              taxClassificationOptions={taxClassificationOptions}
              showTaxFields={showTaxFields}
              onAdd={addLine}
              onUpdate={updateLine}
              onRemove={removeLine}
              onTaxAmountChange={handleTaxAmountChange}
            />
            <SideColumn
              side="credit"
              label="貸方（Credit）"
              color="red"
              lines={creditLines}
              totalLines={lines.length}
              total={creditTotal}
              taxTotal={creditTax}
              accounts={formData.accounts}
              taxAccounts={formData.taxAccounts}
              accountOptions={accountOptions}
              taxClassificationOptions={taxClassificationOptions}
              showTaxFields={showTaxFields}
              onAdd={addLine}
              onUpdate={updateLine}
              onRemove={removeLine}
              onTaxAmountChange={handleTaxAmountChange}
            />
          </div>

          {/* 貸借一致 / 差額 */}
          <div
            className={`py-2 rounded-md text-center text-sm font-medium ${
              difference === 0
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {difference === 0
              ? `貸借一致 ¥${debitTotal.toLocaleString()}`
              : `差額: ¥${Math.abs(difference).toLocaleString()}（${
                  difference > 0 ? "借方超過" : "貸方超過"
                }）`}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            キャンセル
          </Button>
          {!isEdit && (
            <Button
              variant="secondary"
              onClick={() => handleSubmit("draft")}
              disabled={submitting || difference !== 0}
            >
              {submitting ? "保存中..." : "下書き保存"}
            </Button>
          )}
          <Button
            onClick={() => handleSubmit("confirmed")}
            disabled={submitting || difference !== 0 || !realizationStatus}
          >
            {submitting ? "保存中..." : isEdit ? "更新" : "作成（確定）"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* 税額手動変更の確認ダイアログ */}
      <AlertDialog
        open={!!taxEditConfirm}
        onOpenChange={(o) => {
          if (!o) setTaxEditConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>税額を手動変更しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              自動計算された税額と異なる値を入力しようとしています。手動で変更すると、金額や税区分を変更しても自動再計算されなくなります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTaxEdit}>
              手動変更する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* プロジェクト/取引先の変更確認ダイアログ */}
      <AlertDialog
        open={!!changeConfirm}
        onOpenChange={(o) => {
          if (!o) setChangeConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {changeConfirm?.field === "project"
                ? "プロジェクトを変更しますか？"
                : "取引先を変更しますか？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {changeConfirm?.field === "project"
                ? "取引に紐づいたプロジェクトが設定されています。按分など特別な理由がない限り、変更は推奨しません。"
                : "取引に紐づいた取引先が設定されています。変更するとインボイス有無も連動して変わる場合があります。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmFieldChange}>
              変更する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

// ============================================
// 借方/貸方カラム
// ============================================

type TaxOption = { value: string; label: string };

function SideColumn({
  side,
  label,
  color,
  lines,
  totalLines,
  total,
  taxTotal,
  accounts,
  taxAccounts,
  accountOptions,
  taxClassificationOptions,
  showTaxFields,
  onAdd,
  onUpdate,
  onRemove,
  onTaxAmountChange,
}: {
  side: "debit" | "credit";
  label: string;
  color: "blue" | "red";
  lines: LineFormState[];
  totalLines: number;
  total: number;
  taxTotal: number;
  accounts: { id: number; code: string; name: string; category: string }[];
  taxAccounts: { inputTaxAccountId: number | null; outputTaxAccountId: number | null };
  accountOptions: {
    grouped: Record<
      string,
      { id: number; code: string; name: string; category: string }[]
    >;
    categoryLabels: Record<string, string>;
  };
  taxClassificationOptions: readonly TaxOption[];
  showTaxFields: boolean;
  onAdd: (side: "debit" | "credit") => void;
  onUpdate: (key: string, field: keyof LineFormState, value: string) => void;
  onRemove: (key: string) => void;
  onTaxAmountChange: (key: string, value: string) => void;
}) {
  const borderColor =
    color === "blue" ? "border-blue-200" : "border-red-200";
  const headerText = color === "blue" ? "text-blue-700" : "text-red-700";
  const totalText = color === "blue" ? "text-blue-700" : "text-red-700";

  return (
    <div className={`border ${borderColor} rounded-md overflow-hidden`}>
      <div
        className={`flex items-center justify-between px-3 py-2 ${
          color === "blue" ? "bg-blue-50" : "bg-red-50"
        }`}
      >
        <span className={`text-sm font-bold ${headerText}`}>{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => onAdd(side)}
        >
          <Plus className="h-3 w-3" />
          行追加
        </Button>
      </div>

      <div className="p-2 space-y-2 min-h-[80px]">
        {lines.map((line) => (
          <LineCard
            key={line.key}
            line={line}
            accounts={accounts}
            taxAccounts={taxAccounts}
            accountOptions={accountOptions}
            taxClassificationOptions={taxClassificationOptions}
            showTaxFields={showTaxFields}
            canRemove={totalLines > 2}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onTaxAmountChange={onTaxAmountChange}
          />
        ))}
        {lines.length === 0 && (
          <div className="flex items-center justify-center h-[60px] text-xs text-muted-foreground">
            行を追加してください
          </div>
        )}
      </div>

      <div
        className={`px-3 py-2 border-t ${borderColor} ${
          color === "blue" ? "bg-blue-50/50" : "bg-red-50/50"
        }`}
      >
        {taxTotal > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
            <span>うち消費税</span>
            <span>¥{taxTotal.toLocaleString()}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className={`text-sm font-bold ${totalText}`}>合計</span>
          <span className={`text-sm font-bold ${totalText}`}>
            ¥{total.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 明細行カード
// ============================================

function LineCard({
  line,
  accounts,
  taxAccounts,
  accountOptions,
  taxClassificationOptions,
  showTaxFields,
  canRemove,
  onUpdate,
  onRemove,
  onTaxAmountChange,
}: {
  line: LineFormState;
  accounts: { id: number; code: string; name: string; category: string }[];
  taxAccounts: { inputTaxAccountId: number | null; outputTaxAccountId: number | null };
  accountOptions: {
    grouped: Record<
      string,
      { id: number; code: string; name: string; category: string }[]
    >;
    categoryLabels: Record<string, string>;
  };
  taxClassificationOptions: readonly TaxOption[];
  showTaxFields: boolean;
  canRemove: boolean;
  onUpdate: (key: string, field: keyof LineFormState, value: string) => void;
  onRemove: (key: string) => void;
  onTaxAmountChange: (key: string, value: string) => void;
}) {
  const [amountFocused, setAmountFocused] = useState(false);
  const [taxAmountFocused, setTaxAmountFocused] = useState(false);

  const displayAmount = amountFocused
    ? unformatNumber(line.amount)
    : line.amount
      ? formatNumber(line.amount)
      : "";
  const displayTaxAmount = taxAmountFocused
    ? unformatNumber(line.taxAmount)
    : line.taxAmount
      ? formatNumber(line.taxAmount)
      : "";

  // 共通の勘定科目ドロップダウン
  const accountSelect = (
    <Select
      value={line.accountId}
      onValueChange={(v) => onUpdate(line.key, "accountId", v)}
    >
      <SelectTrigger className="h-8 text-xs w-full overflow-hidden">
        <SelectValue placeholder="勘定科目を選択" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(accountOptions.grouped).map(
          ([category, accounts]) => (
            <div key={category}>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                {accountOptions.categoryLabels[category] ?? category}
              </div>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={String(acc.id)}>
                  {acc.name}
                </SelectItem>
              ))}
            </div>
          )
        )}
      </SelectContent>
    </Select>
  );

  const amountInput = (
    <Input
      type="text"
      inputMode="numeric"
      value={displayAmount}
      onChange={(e) => {
        const raw = unformatNumber(e.target.value);
        if (raw === "" || /^\d+$/.test(raw)) {
          onUpdate(line.key, "amount", raw);
        }
      }}
      onFocus={() => setAmountFocused(true)}
      onBlur={() => setAmountFocused(false)}
      placeholder="金額"
      className="h-8 text-xs text-right"
    />
  );

  return (
    <div className="rounded border bg-white p-2 space-y-1">
      {/* Row 1: 勘定科目 + 金額 */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1 items-center">
        {accountSelect}
        {amountInput}
      </div>

      {/* Row 2: 税区分 + 消費税勘定科目 + 税額（税フィールドON時のみ） */}
      {showTaxFields && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1 items-center">
          <Select
            value={line.taxClassification}
            onValueChange={(v) =>
              onUpdate(line.key, "taxClassification", v)
            }
          >
            <SelectTrigger className="h-7 text-xs w-full overflow-hidden">
              <SelectValue placeholder="税区分" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">なし</SelectItem>
              {taxClassificationOptions.map((tc) => (
                <SelectItem key={tc.value} value={tc.value}>
                  {tc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={(() => {
              if (!line.accountId || !line.taxClassification || line.taxClassification === "none") return "";
              const account = accounts.find((a) => String(a.id) === line.accountId);
              if (!account) return "";
              const taxAccId = determineTaxAccountId(
                account.category,
                taxAccounts.inputTaxAccountId!,
                taxAccounts.outputTaxAccountId!,
              );
              if (!taxAccId) return "";
              return accounts.find((a) => a.id === taxAccId)?.name ?? "";
            })()}
            disabled
            placeholder="税勘定科目"
            className="h-7 text-xs bg-gray-50"
          />
          <Input
            type="text"
            inputMode="numeric"
            value={displayTaxAmount}
            onChange={(e) => {
              const raw = unformatNumber(e.target.value);
              if (raw === "" || /^\d+$/.test(raw)) {
                onTaxAmountChange(line.key, raw);
              }
            }}
            onFocus={() => setTaxAmountFocused(true)}
            onBlur={() => setTaxAmountFocused(false)}
            placeholder="税額"
            className={`h-7 text-xs text-right ${
              line.taxManuallyEdited
                ? "border-amber-400 bg-amber-50"
                : ""
            }`}
          />
        </div>
      )}

      {/* Row 3: 明細摘要 + 削除ボタン */}
      <div className="flex gap-1 items-center">
        <Input
          value={line.description}
          onChange={(e) => onUpdate(line.key, "description", e.target.value)}
          placeholder="明細摘要（任意）"
          className="h-7 text-xs flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(line.key)}
          disabled={!canRemove}
          className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
