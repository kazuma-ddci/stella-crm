"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Loader2, Plus, Star, StarOff, Trash2, X } from "lucide-react";
import {
  addCostCenterBankAccount,
  createAndAddCostCenterBankAccount,
  deleteCostCenterBankAccount,
  getAvailableCostCenterBankAccounts,
  getCostCenterBankAccounts,
  setCostCenterDefaultBankAccount,
  updateCostCenterBankAccountMemo,
} from "./actions";

type CostCenterBankAccount = {
  id: number;
  bankAccountId: number;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolderName: string;
  memo: string | null;
  isDefault: boolean;
};

type AvailableBankAccount = {
  id: number;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolderName: string;
};

const ACCOUNT_TYPE_OPTIONS = ["普通", "当座", "貯蓄", "その他"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenterId: number;
  costCenterName: string;
};

export function CostCenterBankAccountsModal({
  open,
  onOpenChange,
  costCenterId,
  costCenterName,
}: Props) {
  const [accounts, setAccounts] = useState<CostCenterBankAccount[]>([]);
  const [available, setAvailable] = useState<AvailableBankAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"select" | "new" | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [selectMemo, setSelectMemo] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [editingMemoId, setEditingMemoId] = useState<number | null>(null);
  const [memoValue, setMemoValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<CostCenterBankAccount | null>(null);
  const [addForm, setAddForm] = useState({
    bankName: "",
    bankCode: "",
    branchName: "",
    branchCode: "",
    accountType: "普通",
    accountNumber: "",
    accountHolderName: "",
    memo: "",
  });

  const clearError = () => {
    setTimeout(() => setError(null), 3000);
  };

  const loadData = async () => {
    const accountRecords = await getCostCenterBankAccounts(costCenterId);
    const availableResult = await getAvailableCostCenterBankAccounts(costCenterId);
    setAccounts(accountRecords);
    setAvailable(availableResult.ok ? availableResult.data : []);
    if (!availableResult.ok) {
      setError(availableResult.error);
      clearError();
    }
    setLoaded(true);
  };

  useEffect(() => {
    if (open && costCenterId) {
      setLoaded(false);
      setError(null);
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, costCenterId]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setAddMode(null);
      setEditingMemoId(null);
      setDeleteConfirm(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const openSelectMode = () => {
    setSelectedBankAccountId(null);
    setSelectMemo("");
    if (available.length > 0) {
      setAddMode("select");
      return;
    }
    openNewMode();
  };

  const openNewMode = () => {
    setAddForm({
      bankName: "",
      bankCode: "",
      branchName: "",
      branchCode: "",
      accountType: "普通",
      accountNumber: "",
      accountHolderName: "",
      memo: "",
    });
    setAddMode("new");
  };

  const handleLinkExisting = async () => {
    if (!selectedBankAccountId) return;
    setAddSaving(true);
    setError(null);

    try {
      const result = await addCostCenterBankAccount({
        costCenterId,
        bankAccountId: selectedBankAccountId,
        memo: selectMemo.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        clearError();
        return;
      }
      setAddMode(null);
      await loadData();
    } catch {
      setError("追加に失敗しました");
      clearError();
    } finally {
      setAddSaving(false);
    }
  };

  const handleAddNew = async () => {
    if (!addForm.bankName.trim() || !addForm.accountNumber.trim() || !addForm.accountHolderName.trim()) return;
    setAddSaving(true);
    setError(null);

    try {
      const result = await createAndAddCostCenterBankAccount({
        costCenterId,
        bankName: addForm.bankName.trim(),
        bankCode: addForm.bankCode.trim(),
        branchName: addForm.branchName.trim(),
        branchCode: addForm.branchCode.trim(),
        accountType: addForm.accountType,
        accountNumber: addForm.accountNumber.trim(),
        accountHolderName: addForm.accountHolderName.trim(),
        memo: addForm.memo.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        clearError();
        return;
      }
      setAddMode(null);
      await loadData();
    } catch {
      setError("追加に失敗しました");
      clearError();
    } finally {
      setAddSaving(false);
    }
  };

  const handleToggleDefault = async (account: CostCenterBankAccount) => {
    const newDefault = account.isDefault ? null : account.id;
    const result = await setCostCenterDefaultBankAccount(costCenterId, newDefault);
    if (!result.ok) {
      setError(result.error);
      clearError();
      return;
    }
    setAccounts((prev) =>
      prev.map((item) => ({
        ...item,
        isDefault: newDefault === null ? false : item.id === account.id,
      }))
    );
  };

  const saveMemo = async (accountId: number) => {
    const result = await updateCostCenterBankAccountMemo(accountId, memoValue.trim() || null);
    if (!result.ok) {
      setError(result.error);
      clearError();
      return;
    }
    setAccounts((prev) =>
      prev.map((item) =>
        item.id === accountId ? { ...item, memo: memoValue.trim() || null } : item
      )
    );
    setEditingMemoId(null);
  };

  const handleDelete = async (account: CostCenterBankAccount) => {
    const result = await deleteCostCenterBankAccount(account.id);
    if (!result.ok) {
      setError(result.error);
      clearError();
      return;
    }
    setAccounts((prev) => prev.filter((item) => item.id !== account.id));
    setAvailable((prev) => [
      ...prev,
      {
        id: account.bankAccountId,
        bankName: account.bankName,
        branchName: account.branchName,
        accountType: account.accountType,
        accountNumber: account.accountNumber,
        accountHolderName: account.accountHolderName,
      },
    ]);
    setDeleteConfirm(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="wide" className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{costCenterName} - 銀行口座管理</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!addMode && (
          <div className="flex justify-end">
            <Button size="sm" onClick={openSelectMode}>
              <Plus className="mr-1 h-4 w-4" />
              銀行口座を追加
            </Button>
          </div>
        )}

        {addMode === "select" && (
          <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
            <p className="text-sm font-medium">運営法人の銀行口座から選択</p>
            <div className="space-y-2">
              {available.map((account) => (
                <label
                  key={account.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border p-2.5 transition-colors ${
                    selectedBankAccountId === account.id ? "border-primary bg-primary/5" : "hover:bg-muted/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="selectCostCenterBankAccount"
                    checked={selectedBankAccountId === account.id}
                    onChange={() => setSelectedBankAccountId(account.id)}
                    className="accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm">{account.bankName} {account.branchName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{account.accountType}</span>
                    <span className="ml-1 font-mono text-xs text-muted-foreground">{account.accountNumber}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{account.accountHolderName}</span>
                  </div>
                </label>
              ))}
            </div>
            {selectedBankAccountId && (
              <div className="space-y-1">
                <Label className="text-xs">メモ（経理用プロジェクト用）</Label>
                <Input
                  value={selectMemo}
                  onChange={(event) => setSelectMemo(event.target.value)}
                  placeholder="例: 請求書振込先"
                  className="h-8 text-sm"
                />
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <Button size="sm" variant="link" className="px-0 text-xs" onClick={openNewMode}>
                新しい銀行口座を登録
              </Button>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAddMode(null)}>
                  キャンセル
                </Button>
                <Button size="sm" onClick={handleLinkExisting} disabled={addSaving || !selectedBankAccountId}>
                  {addSaving ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" />追加中</>
                  ) : (
                    "追加"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {addMode === "new" && (
          <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
            <p className="text-sm font-medium">新しい銀行口座を登録</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">銀行名 *</Label>
                <Input value={addForm.bankName} onChange={(event) => setAddForm({ ...addForm, bankName: event.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">銀行コード</Label>
                <Input value={addForm.bankCode} onChange={(event) => setAddForm({ ...addForm, bankCode: event.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">支店名</Label>
                <Input value={addForm.branchName} onChange={(event) => setAddForm({ ...addForm, branchName: event.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">支店コード</Label>
                <Input value={addForm.branchCode} onChange={(event) => setAddForm({ ...addForm, branchCode: event.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">口座種別</Label>
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={addForm.accountType}
                  onChange={(event) => setAddForm({ ...addForm, accountType: event.target.value })}
                >
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">口座番号 *</Label>
                <Input value={addForm.accountNumber} onChange={(event) => setAddForm({ ...addForm, accountNumber: event.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">口座名義人 *</Label>
                <Input value={addForm.accountHolderName} onChange={(event) => setAddForm({ ...addForm, accountHolderName: event.target.value })} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">メモ</Label>
              <Input value={addForm.memo} onChange={(event) => setAddForm({ ...addForm, memo: event.target.value })} className="h-8 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setAddMode(null)}>
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={handleAddNew}
                disabled={addSaving || !addForm.bankName.trim() || !addForm.accountNumber.trim() || !addForm.accountHolderName.trim()}
              >
                {addSaving ? (
                  <><Loader2 className="mr-1 h-3 w-3 animate-spin" />追加中</>
                ) : (
                  "追加"
                )}
              </Button>
            </div>
          </div>
        )}

        {!loaded ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            読み込み中...
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            銀行口座が登録されていません
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] text-center">既定</TableHead>
                  <TableHead>銀行名</TableHead>
                  <TableHead>支店名</TableHead>
                  <TableHead>口座種別</TableHead>
                  <TableHead>口座番号</TableHead>
                  <TableHead>口座名義人</TableHead>
                  <TableHead>メモ</TableHead>
                  <TableHead className="w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="text-center">
                      <button
                        onClick={() => handleToggleDefault(account)}
                        className={account.isDefault ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"}
                        title={account.isDefault ? "デフォルトを解除" : "デフォルトに設定"}
                      >
                        {account.isDefault ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm">{account.bankName}</TableCell>
                    <TableCell className="text-sm">{account.branchName}</TableCell>
                    <TableCell className="text-sm">{account.accountType}</TableCell>
                    <TableCell className="font-mono text-sm">{account.accountNumber}</TableCell>
                    <TableCell className="text-sm">{account.accountHolderName}</TableCell>
                    <TableCell>
                      {editingMemoId === account.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={memoValue}
                            onChange={(event) => setMemoValue(event.target.value)}
                            className="h-7 w-32 text-xs"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") saveMemo(account.id);
                              if (event.key === "Escape") setEditingMemoId(null);
                            }}
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveMemo(account.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMemoId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-left text-xs hover:text-primary"
                          onClick={() => {
                            setEditingMemoId(account.id);
                            setMemoValue(account.memo ?? "");
                          }}
                        >
                          {account.memo || <span className="text-muted-foreground italic">メモを追加</span>}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(account)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {deleteConfirm && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm">
              {deleteConfirm.bankName} {deleteConfirm.branchName} {deleteConfirm.accountNumber} を削除しますか？
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)}>
                キャンセル
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(deleteConfirm)}>
                削除
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
