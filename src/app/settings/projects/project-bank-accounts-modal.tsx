"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Pencil,
  Star,
  StarOff,
  Loader2,
  X,
  Check,
} from "lucide-react";
import {
  getProjectBankAccounts,
  getAvailableBankAccounts,
  addProjectBankAccount,
  updateProjectBankAccountMemo,
  setProjectDefaultBankAccount,
  deleteProjectBankAccount,
} from "./actions";

// ============================================
// 型定義
// ============================================

type ProjectBankAccount = {
  id: number;
  bankAccountId: number;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountHolderName: string;
  memo: string | null;
  isDefault: boolean;
};

type AvailableBankAccount = {
  id: number;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountHolderName: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
};

// ============================================
// メインコンポーネント
// ============================================

export function ProjectBankAccountsModal({
  open,
  onOpenChange,
  projectId,
  projectName,
}: Props) {
  const [accounts, setAccounts] = useState<ProjectBankAccount[]>([]);
  const [available, setAvailable] = useState<AvailableBankAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 追加フォーム
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [addMemo, setAddMemo] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // メモ編集
  const [editingMemoId, setEditingMemoId] = useState<number | null>(null);
  const [memoValue, setMemoValue] = useState("");

  // 削除確認
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectBankAccount | null>(null);

  const clearError = () => {
    setTimeout(() => setError(null), 3000);
  };

  // データ取得
  const loadData = async () => {
    const [accts, avail] = await Promise.all([
      getProjectBankAccounts(projectId),
      getAvailableBankAccounts(projectId),
    ]);
    setAccounts(accts);
    setAvailable(avail);
    setLoaded(true);
  };

  // モーダルが開いたらデータ取得
  useEffect(() => {
    if (open && projectId) {
      setLoaded(false);
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsAddMode(false);
      setEditingMemoId(null);
      setDeleteConfirm(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  // ============================================
  // 口座追加
  // ============================================

  const openAddForm = () => {
    setSelectedBankAccountId("");
    setAddMemo("");
    setIsAddMode(true);
  };

  const handleAdd = async () => {
    if (!selectedBankAccountId) return;
    setAddSaving(true);
    setError(null);

    const result = await addProjectBankAccount({
      projectId,
      bankAccountId: parseInt(selectedBankAccountId),
      memo: addMemo.trim() || null,
    });

    setAddSaving(false);
    if (!result.success) {
      setError(result.error ?? "追加に失敗しました");
      clearError();
      return;
    }

    setIsAddMode(false);
    await loadData();
  };

  // ============================================
  // メモ編集
  // ============================================

  const startMemoEdit = (pba: ProjectBankAccount) => {
    setEditingMemoId(pba.id);
    setMemoValue(pba.memo ?? "");
  };

  const saveMemo = async (pbaId: number) => {
    try {
      await updateProjectBankAccountMemo(pbaId, memoValue.trim() || null);
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === pbaId ? { ...a, memo: memoValue.trim() || null } : a
        )
      );
      setEditingMemoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "メモの更新に失敗しました");
      clearError();
    }
  };

  // ============================================
  // デフォルト切り替え
  // ============================================

  const handleToggleDefault = async (pba: ProjectBankAccount) => {
    setError(null);
    const newDefault = pba.isDefault ? null : pba.id;
    const result = await setProjectDefaultBankAccount(projectId, newDefault);
    if (!result.success) {
      setError(result.error ?? "設定に失敗しました");
      clearError();
      return;
    }
    setAccounts((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: newDefault === null ? false : a.id === pba.id,
      }))
    );
  };

  // ============================================
  // 削除
  // ============================================

  const handleDelete = async (pba: ProjectBankAccount) => {
    try {
      await deleteProjectBankAccount(pba.id);
      setAccounts((prev) => prev.filter((a) => a.id !== pba.id));
      // 削除した口座を選択肢に戻す
      setAvailable((prev) => [
        ...prev,
        {
          id: pba.bankAccountId,
          bankName: pba.bankName,
          branchName: pba.branchName,
          accountNumber: pba.accountNumber,
          accountHolderName: pba.accountHolderName,
        },
      ]);
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
      clearError();
    }
  };

  // ============================================
  // レンダリング
  // ============================================

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{projectName} — 銀行口座管理</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* 追加ボタン / 追加フォーム */}
        {!isAddMode && (
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={openAddForm}
              disabled={available.length === 0}
              title={available.length === 0 ? "追加できる口座がありません" : undefined}
            >
              <Plus className="h-4 w-4 mr-1" />
              銀行口座を追加
            </Button>
          </div>
        )}

        {isAddMode && (
          <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
            <p className="text-sm font-medium">銀行口座を追加</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">口座を選択 *</Label>
                <Select
                  value={selectedBankAccountId}
                  onValueChange={setSelectedBankAccountId}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="口座を選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((ba) => (
                      <SelectItem key={ba.id} value={String(ba.id)}>
                        {ba.bankName} {ba.branchName} {ba.accountNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">メモ</Label>
                <Input
                  value={addMemo}
                  onChange={(e) => setAddMemo(e.target.value)}
                  placeholder="例: 請求書振込先"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddMode(false)}
              >
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={addSaving || !selectedBankAccountId}
              >
                {addSaving ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" />追加中</>
                ) : (
                  "追加"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* 口座一覧 */}
        {!loaded ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            読み込み中...
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            銀行口座が登録されていません
          </div>
        ) : (
          <div style={{ overflow: "auto" }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] text-center">既定</TableHead>
                  <TableHead>銀行名</TableHead>
                  <TableHead>支店名</TableHead>
                  <TableHead>口座番号</TableHead>
                  <TableHead>口座名義人</TableHead>
                  <TableHead>メモ</TableHead>
                  <TableHead className="w-[80px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((pba) => (
                  <TableRow key={pba.id} className="group/row">
                    <TableCell className="text-center">
                      <button
                        onClick={() => handleToggleDefault(pba)}
                        className={`transition-colors ${
                          pba.isDefault
                            ? "text-yellow-500"
                            : "text-gray-300 hover:text-yellow-400"
                        }`}
                        title={pba.isDefault ? "デフォルトを解除" : "デフォルトに設定"}
                      >
                        {pba.isDefault ? (
                          <Star className="h-4 w-4 fill-current" />
                        ) : (
                          <StarOff className="h-4 w-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm">{pba.bankName}</TableCell>
                    <TableCell className="text-sm">{pba.branchName}</TableCell>
                    <TableCell className="font-mono text-sm">{pba.accountNumber}</TableCell>
                    <TableCell className="text-sm">{pba.accountHolderName}</TableCell>
                    <TableCell>
                      {editingMemoId === pba.id ? (
                        <div className="flex gap-1 items-center">
                          <Input
                            value={memoValue}
                            onChange={(e) => setMemoValue(e.target.value)}
                            className="h-7 text-xs w-32"
                            placeholder="メモ"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveMemo(pba.id);
                              if (e.key === "Escape") setEditingMemoId(null);
                            }}
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => saveMemo(pba.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setEditingMemoId(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-xs text-left hover:text-primary cursor-pointer"
                          onClick={() => startMemoEdit(pba)}
                        >
                          {pba.memo || (
                            <span className="text-muted-foreground italic">
                              メモを追加
                            </span>
                          )}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => startMemoEdit(pba)}
                          title="メモを編集"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => setDeleteConfirm(pba)}
                          title="削除"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 削除確認 */}
        {deleteConfirm && (
          <div className="border rounded-lg p-4 bg-destructive/10 space-y-2">
            <p className="text-sm">
              <strong>
                {deleteConfirm.bankName} {deleteConfirm.branchName} {deleteConfirm.accountNumber}
              </strong>{" "}
              を削除しますか？
            </p>
            {deleteConfirm.isDefault && (
              <p className="text-xs text-destructive">
                ※ 現在のデフォルト口座です。削除するとデフォルトが未設定になります。
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
              >
                キャンセル
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(deleteConfirm)}
              >
                削除
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
