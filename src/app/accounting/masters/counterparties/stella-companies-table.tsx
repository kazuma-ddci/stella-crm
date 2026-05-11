"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, Check, Building2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addStellaCompanyBankAccount,
  deleteStellaCompanyBankAccount,
  updateStellaCompanyBankAccount,
  updateStellaCompanyInvoiceInfo,
} from "./actions";

type BankAccount = {
  id: number;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountHolderName: string;
  note: string | null;
};

type StellaCompanyRow = {
  id: number;
  companyCode: string;
  name: string;
  corporateNumber: string | null;
  isInvoiceRegistered: boolean;
  invoiceRegistrationNumber: string | null;
  invoiceEffectiveDate: Date | null;
  closingDay: number | null;
  paymentMonthOffset: number | null;
  paymentDay: number | null;
  bankAccounts: BankAccount[];
  counterparties: { id: number; displayId: string | null }[];
};

type Props = {
  data: StellaCompanyRow[];
};

function formatDay(day: number | null): string {
  if (day === null || day === undefined) return "-";
  if (day === 0) return "末日";
  return `${day}日`;
}

function formatPaymentTerm(
  closingDay: number | null,
  paymentMonthOffset: number | null,
  paymentDay: number | null
): string {
  if (closingDay === null && paymentMonthOffset === null && paymentDay === null) {
    return "-";
  }
  const closing = formatDay(closingDay);
  const monthLabel =
    paymentMonthOffset === null
      ? ""
      : paymentMonthOffset === 0
        ? "当月"
        : paymentMonthOffset === 1
          ? "翌月"
          : `${paymentMonthOffset}ヶ月後`;
  const payment = formatDay(paymentDay);
  return `${closing}締め ${monthLabel}${payment}払い`;
}

export function StellaCompaniesTable({ data }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchText, setSearchText] = useState("");
  const [editCompany, setEditCompany] = useState<StellaCompanyRow | null>(null);
  const [activeEditTab, setActiveEditTab] = useState("invoice");
  const [editInvoiceRegistered, setEditInvoiceRegistered] = useState(false);
  const [editRegNumber, setEditRegNumber] = useState("");
  const [editInvoiceEffectiveDate, setEditInvoiceEffectiveDate] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [bankForm, setBankForm] = useState({
    bankName: "",
    bankCode: "",
    branchName: "",
    branchCode: "",
    accountNumber: "",
    accountHolderName: "",
    note: "",
  });
  const [bankSaving, setBankSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!searchText.trim()) return data;
    const q = searchText.trim().toLowerCase();
    return data.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.companyCode.toLowerCase().includes(q) ||
        c.corporateNumber?.toLowerCase().includes(q) ||
        c.invoiceRegistrationNumber?.toLowerCase().includes(q)
    );
  }, [data, searchText]);

  const openEdit = (company: StellaCompanyRow) => {
    setEditCompany(company);
    setActiveEditTab("invoice");
    setEditInvoiceRegistered(company.isInvoiceRegistered);
    setEditRegNumber(company.invoiceRegistrationNumber ?? "");
    setEditInvoiceEffectiveDate(
      company.invoiceEffectiveDate
        ? new Date(company.invoiceEffectiveDate).toISOString().split("T")[0]
        : ""
    );
    setBankAccounts(company.bankAccounts);
    setBankDialogOpen(false);
    setEditingBank(null);
  };

  const handleSave = () => {
    if (!editCompany) return;
    startTransition(async () => {
      try {
        const result = await updateStellaCompanyInvoiceInfo(editCompany.id, {
          isInvoiceRegistered: editInvoiceRegistered,
          invoiceRegistrationNumber: editRegNumber || null,
          invoiceEffectiveDate: editInvoiceEffectiveDate || null,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("インボイス情報を更新しました");
        setEditCompany(null);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "更新に失敗しました"
        );
      }
    });
  };

  const openAddBank = () => {
    setEditingBank(null);
    setBankForm({
      bankName: "",
      bankCode: "",
      branchName: "",
      branchCode: "",
      accountNumber: "",
      accountHolderName: "",
      note: "",
    });
    setBankDialogOpen(true);
  };

  const openEditBank = (bankAccount: BankAccount) => {
    setEditingBank(bankAccount);
    setBankForm({
      bankName: bankAccount.bankName,
      bankCode: bankAccount.bankCode,
      branchName: bankAccount.branchName,
      branchCode: bankAccount.branchCode,
      accountNumber: bankAccount.accountNumber,
      accountHolderName: bankAccount.accountHolderName,
      note: bankAccount.note ?? "",
    });
    setBankDialogOpen(true);
  };

  const handleSaveBank = async () => {
    if (!editCompany) return;
    setBankSaving(true);
    try {
      const result = editingBank
        ? await updateStellaCompanyBankAccount(editingBank.id, bankForm)
        : await addStellaCompanyBankAccount(editCompany.id, bankForm);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const saved = result.data;
      if (editingBank) {
        setBankAccounts((current) =>
          current.map((item) => (item.id === saved.id ? saved : item))
        );
        toast.success("銀行口座を更新しました");
      } else {
        setBankAccounts((current) => [...current, saved]);
        toast.success("銀行口座を追加しました");
      }
      setBankDialogOpen(false);
      setEditingBank(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "銀行口座の保存に失敗しました");
    } finally {
      setBankSaving(false);
    }
  };

  const handleDeleteBank = async (bankAccount: BankAccount) => {
    if (!window.confirm(`「${bankAccount.bankName} ${bankAccount.branchName}」の銀行口座を削除しますか？`)) {
      return;
    }
    const result = await deleteStellaCompanyBankAccount(bankAccount.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setBankAccounts((current) => current.filter((item) => item.id !== bankAccount.id));
    toast.success("銀行口座を削除しました");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="企業名・コード・登録番号で検索..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-80"
        />
        <span className="text-sm text-muted-foreground">
          {filtered.length}件
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          顧客マスタデータがありません
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>コード</TableHead>
                <TableHead>企業名</TableHead>
                <TableHead>法人番号</TableHead>
                <TableHead>インボイス</TableHead>
                <TableHead>登録番号</TableHead>
                <TableHead>支払条件</TableHead>
                <TableHead>銀行口座</TableHead>
                <TableHead className="w-[60px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((company) => (
                <TableRow key={company.id} className="group/row">
                  <TableCell className="font-mono text-xs">
                    {company.companyCode}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {company.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {company.corporateNumber ?? "-"}
                  </TableCell>
                  <TableCell>
                    {company.isInvoiceRegistered ? (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Check className="h-3 w-3 mr-1" />
                          有
                        </Badge>
                        {company.invoiceEffectiveDate && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(company.invoiceEffectiveDate).toLocaleDateString("ja-JP")}〜
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">無</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {company.isInvoiceRegistered
                      ? (company.invoiceRegistrationNumber ?? "-")
                      : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatPaymentTerm(
                      company.closingDay,
                      company.paymentMonthOffset,
                      company.paymentDay
                    )}
                  </TableCell>
                  <TableCell>
                    {company.bankAccounts.length > 0 ? (
                      <div className="space-y-1">
                        {company.bankAccounts.map((ba) => (
                          <div key={ba.id} className="text-xs flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {ba.bankName} {ba.branchName} {ba.accountNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openEdit(company)}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 全顧客マスタ編集モーダル */}
      <Dialog
        open={!!editCompany}
        onOpenChange={(open) => {
          if (!open) setEditCompany(null);
        }}
      >
        <DialogContent size="wide" className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              全顧客マスタ編集 - {editCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <Tabs
            value={activeEditTab}
            onValueChange={setActiveEditTab}
            className="flex-1 min-h-0 flex flex-col"
          >
            <TabsList className="w-fit">
              <TabsTrigger value="invoice">インボイス情報</TabsTrigger>
              <TabsTrigger value="bankAccounts">銀行口座 ({bankAccounts.length})</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0 overflow-y-auto pt-4">
              <TabsContent value="invoice" className="mt-0 space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="editInvoiceRegistered"
                    checked={editInvoiceRegistered}
                    onCheckedChange={(checked) => {
                      setEditInvoiceRegistered(checked === true);
                      if (!checked) setEditRegNumber("");
                    }}
                  />
                  <Label htmlFor="editInvoiceRegistered" className="cursor-pointer">
                    インボイス登録有り
                  </Label>
                </div>
                {editInvoiceRegistered && (
                  <>
                    <div>
                      <Label>登録番号</Label>
                      <Input
                        value={editRegNumber}
                        onChange={(e) => setEditRegNumber(e.target.value)}
                        placeholder="T1234567890123"
                        className="mt-1 font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        T + 13桁の数字で入力してください
                      </p>
                    </div>
                    <div>
                      <Label>インボイス適用日</Label>
                      <DatePicker
                        value={editInvoiceEffectiveDate}
                        onChange={setEditInvoiceEffectiveDate}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        この日以降の仕訳で税区分チェックが有効になります
                      </p>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="bankAccounts" className="mt-0 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    請求・支払確認で参照する顧客側の銀行口座です。
                  </p>
                  <Button variant="outline" size="sm" onClick={openAddBank}>
                    <Plus className="mr-1 h-4 w-4" />
                    追加
                  </Button>
                </div>
                {bankAccounts.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    銀行口座が登録されていません
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bankAccounts.map((bankAccount) => (
                      <div
                        key={bankAccount.id}
                        className="flex items-start justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="font-medium">
                            {bankAccount.bankName} {bankAccount.branchName}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>口座番号: {bankAccount.accountNumber}</span>
                            <span>名義: {bankAccount.accountHolderName || "-"}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>銀行コード: {bankAccount.bankCode || "-"}</span>
                            <span>支店コード: {bankAccount.branchCode || "-"}</span>
                          </div>
                          {bankAccount.note && (
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                              {bankAccount.note}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditBank(bankAccount)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteBank(bankAccount)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditCompany(null)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            {activeEditTab === "invoice" && (
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? "保存中..." : "保存"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent size="form" className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingBank ? "銀行口座を編集" : "銀行口座を追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>銀行名 *</Label>
                <Input
                  value={bankForm.bankName}
                  onChange={(e) =>
                    setBankForm((current) => ({ ...current, bankName: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>銀行コード</Label>
                <Input
                  value={bankForm.bankCode}
                  onChange={(e) =>
                    setBankForm((current) => ({ ...current, bankCode: e.target.value }))
                  }
                  className="mt-1"
                  placeholder="4桁"
                />
              </div>
              <div>
                <Label>支店名</Label>
                <Input
                  value={bankForm.branchName}
                  onChange={(e) =>
                    setBankForm((current) => ({ ...current, branchName: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>支店コード</Label>
                <Input
                  value={bankForm.branchCode}
                  onChange={(e) =>
                    setBankForm((current) => ({ ...current, branchCode: e.target.value }))
                  }
                  className="mt-1"
                  placeholder="3桁"
                />
              </div>
              <div>
                <Label>口座番号 *</Label>
                <Input
                  value={bankForm.accountNumber}
                  onChange={(e) =>
                    setBankForm((current) => ({ ...current, accountNumber: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>口座名義人</Label>
                <Input
                  value={bankForm.accountHolderName}
                  onChange={(e) =>
                    setBankForm((current) => ({ ...current, accountHolderName: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>備考</Label>
              <Textarea
                value={bankForm.note}
                onChange={(e) =>
                  setBankForm((current) => ({ ...current, note: e.target.value }))
                }
                className="mt-1 max-h-[30vh]"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBankDialogOpen(false)}
              disabled={bankSaving}
            >
              キャンセル
            </Button>
            <Button onClick={handleSaveBank} disabled={bankSaving}>
              {bankSaving ? "保存中..." : editingBank ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
