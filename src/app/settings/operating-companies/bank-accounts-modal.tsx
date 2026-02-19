"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addOperatingCompanyBankAccount,
  updateOperatingCompanyBankAccount,
  deleteOperatingCompanyBankAccount,
} from "./bank-account-actions";

type BankAccount = {
  id: number;
  operatingCompanyId: number;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountHolderName: string;
  note: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  companyName: string;
  bankAccounts: BankAccount[];
  canEdit: boolean;
};

export function BankAccountsModal({
  open,
  onOpenChange,
  companyId,
  companyName,
  bankAccounts: initialBankAccounts,
  canEdit,
}: Props) {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(initialBankAccounts);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editBankAccount, setEditBankAccount] = useState<BankAccount | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState<Partial<BankAccount>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBankAccounts(initialBankAccounts);
    setIsAddMode(false);
    setEditBankAccount(null);
    setFormData({});
    setDeleteConfirm(null);
  }, [initialBankAccounts, open]);

  const openAddForm = () => {
    setFormData({
      bankName: "",
      bankCode: "",
      branchName: "",
      branchCode: "",
      accountNumber: "",
      accountHolderName: "",
      note: null,
    });
    setIsAddMode(true);
  };

  const openEditForm = (bankAccount: BankAccount) => {
    setFormData({ ...bankAccount });
    setEditBankAccount(bankAccount);
  };

  const handleAdd = async () => {
    if (!formData.bankName || !formData.bankCode ||
        !formData.branchName || !formData.branchCode ||
        !formData.accountNumber || !formData.accountHolderName) {
      toast.error("銀行名、銀行コード、支店名、支店コード、口座番号、口座名義人は必須です");
      return;
    }
    setLoading(true);
    try {
      const newBankAccount = await addOperatingCompanyBankAccount(companyId, formData);
      setBankAccounts([...bankAccounts, newBankAccount as unknown as BankAccount]);
      toast.success("銀行情報を追加しました");
      setIsAddMode(false);
      setFormData({});
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editBankAccount ||
        !formData.bankName || !formData.bankCode ||
        !formData.branchName || !formData.branchCode ||
        !formData.accountNumber || !formData.accountHolderName) {
      toast.error("銀行名、銀行コード、支店名、支店コード、口座番号、口座名義人は必須です");
      return;
    }
    setLoading(true);
    try {
      const updated = await updateOperatingCompanyBankAccount(editBankAccount.id, formData);
      setBankAccounts(
        bankAccounts.map((b) =>
          b.id === editBankAccount.id ? (updated as unknown as BankAccount) : b
        )
      );
      toast.success("銀行情報を更新しました");
      setEditBankAccount(null);
      setFormData({});
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setLoading(true);
    try {
      await deleteOperatingCompanyBankAccount(deleteConfirm.id);
      setBankAccounts(bankAccounts.filter((b) => b.id !== deleteConfirm.id));
      toast.success("銀行情報を削除しました");
      setDeleteConfirm(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            銀行名 <span className="text-destructive">*</span>
          </Label>
          <Input
            value={formData.bankName || ""}
            onChange={(e) =>
              setFormData({ ...formData, bankName: e.target.value })
            }
            placeholder="みずほ銀行"
          />
        </div>
        <div className="space-y-2">
          <Label>
            銀行コード <span className="text-destructive">*</span>
          </Label>
          <Input
            value={formData.bankCode || ""}
            onChange={(e) =>
              setFormData({ ...formData, bankCode: e.target.value })
            }
            placeholder="0001"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            支店名 <span className="text-destructive">*</span>
          </Label>
          <Input
            value={formData.branchName || ""}
            onChange={(e) =>
              setFormData({ ...formData, branchName: e.target.value })
            }
            placeholder="東京営業部"
          />
        </div>
        <div className="space-y-2">
          <Label>
            支店コード <span className="text-destructive">*</span>
          </Label>
          <Input
            value={formData.branchCode || ""}
            onChange={(e) =>
              setFormData({ ...formData, branchCode: e.target.value })
            }
            placeholder="001"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            口座番号 <span className="text-destructive">*</span>
          </Label>
          <Input
            value={formData.accountNumber || ""}
            onChange={(e) =>
              setFormData({ ...formData, accountNumber: e.target.value })
            }
            placeholder="1234567"
          />
        </div>
        <div className="space-y-2">
          <Label>
            口座名義人 <span className="text-destructive">*</span>
          </Label>
          <Input
            value={formData.accountHolderName || ""}
            onChange={(e) =>
              setFormData({ ...formData, accountHolderName: e.target.value })
            }
            placeholder="カ）サンプルショウジ"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>メモ</Label>
        <Textarea
          value={formData.note || ""}
          onChange={(e) =>
            setFormData({ ...formData, note: e.target.value || null })
          }
          rows={2}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setIsAddMode(false);
            setEditBankAccount(null);
            setFormData({});
          }}
        >
          キャンセル
        </Button>
        <Button
          onClick={isAddMode ? handleAdd : handleUpdate}
          disabled={loading}
        >
          {loading ? "保存中..." : isAddMode ? "追加" : "更新"}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="mixed" className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>銀行情報 - {companyName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 追加ボタン */}
          {canEdit && !isAddMode && !editBankAccount && (
            <div className="flex justify-end">
              <Button onClick={openAddForm}>
                <Plus className="mr-2 h-4 w-4" />
                銀行情報を追加
              </Button>
            </div>
          )}

          {/* 追加/編集フォーム */}
          {(isAddMode || editBankAccount) && renderForm()}

          {/* 銀行情報一覧 */}
          {bankAccounts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              銀行情報が登録されていません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>銀行名</TableHead>
                    <TableHead>銀行コード</TableHead>
                    <TableHead>支店名</TableHead>
                    <TableHead>支店コード</TableHead>
                    <TableHead>口座番号</TableHead>
                    <TableHead>口座名義人</TableHead>
                    <TableHead>メモ</TableHead>
                    {canEdit && <TableHead className="w-[120px]">操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankAccounts.map((bankAccount) => (
                    <TableRow key={bankAccount.id}>
                      <TableCell className="font-medium">{bankAccount.bankName}</TableCell>
                      <TableCell className="font-mono">{bankAccount.bankCode}</TableCell>
                      <TableCell>{bankAccount.branchName}</TableCell>
                      <TableCell className="font-mono">{bankAccount.branchCode}</TableCell>
                      <TableCell className="font-mono">{bankAccount.accountNumber}</TableCell>
                      <TableCell>{bankAccount.accountHolderName}</TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {bankAccount.note || "-"}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditForm(bankAccount)}
                              disabled={isAddMode || !!editBankAccount}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirm(bankAccount)}
                              disabled={isAddMode || !!editBankAccount}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* 削除確認 */}
          {deleteConfirm && (
            <div className="border rounded-lg p-4 bg-destructive/10">
              <p className="mb-4">
                「{deleteConfirm.bankName} {deleteConfirm.branchName}」の銀行情報を削除しますか？
                この操作は取り消せません。
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                >
                  キャンセル
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? "削除中..." : "削除"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
