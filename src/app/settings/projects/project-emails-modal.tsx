"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Trash2,
  Pencil,
  Star,
  StarOff,
  Loader2,
} from "lucide-react";
import {
  addProjectEmail,
  linkExistingEmail,
  getAvailableEmails,
  updateProjectEmailMemo,
  updateEmailSettings,
  setProjectDefaultEmail,
  deleteProjectEmail,
  getProjectEmails,
} from "./actions";

// ============================================
// 型定義
// ============================================

type ProjectEmail = {
  id: number;
  emailId: number;
  email: string;
  memo: string | null;
  isDefault: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  hasSmtpPass: boolean;
  hasSmtpConfig: boolean;
  imapHost: string | null;
  imapPort: number | null;
  enableInbound: boolean;
};

type AvailableEmail = {
  id: number;
  email: string;
  label: string | null;
  hasSmtpConfig: boolean;
  enableInbound: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
  isSystemAdmin: boolean;
};

// ============================================
// メインコンポーネント
// ============================================

export function ProjectEmailsModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  isSystemAdmin,
}: Props) {
  const [emails, setEmails] = useState<ProjectEmail[]>([]);
  const [, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 追加モード: "select" = 既存から選択, "new" = 新規追加, null = 非表示
  const [addMode, setAddMode] = useState<"select" | "new" | null>(null);
  const [availableEmails, setAvailableEmails] = useState<AvailableEmail[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [selectMemo, setSelectMemo] = useState("");
  const [addForm, setAddForm] = useState({
    email: "",
    memo: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpPass: "",
    imapHost: "imap.gmail.com",
    imapPort: "993",
    enableInbound: false,
  });
  const [addSaving, setAddSaving] = useState(false);

  // 編集（メモ + メール設定を統合）
  const [editingEmail, setEditingEmail] = useState<ProjectEmail | null>(null);
  const [editForm, setEditForm] = useState({
    memo: "",
    smtpHost: "",
    smtpPort: "",
    smtpPass: "",
    imapHost: "",
    imapPort: "",
    enableInbound: false,
  });
  const [editSaving, setEditSaving] = useState(false);

  // 削除確認
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectEmail | null>(null);

  const clearError = () => {
    setTimeout(() => setError(null), 3000);
  };

  // データ取得
  const loadEmails = async () => {
    const data = await getProjectEmails(projectId);
    setEmails(data);
    setLoaded(true);
  };

  // モーダルが開いたらデータ取得
  useEffect(() => {
    if (open && projectId) {
      setLoaded(false);
      loadEmails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setAddMode(null);
      setEditingEmail(null);
      setDeleteConfirm(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  // ============================================
  // メール追加
  // ============================================

  const openSelectMode = async () => {
    const available = await getAvailableEmails(projectId);
    setAvailableEmails(available);
    setSelectedEmailId(null);
    setSelectMemo("");
    if (available.length > 0) {
      setAddMode("select");
    } else {
      openNewMode();
    }
  };

  const openNewMode = () => {
    setAddForm({
      email: "",
      memo: "",
      smtpHost: "smtp.gmail.com",
      smtpPort: "587",
      smtpPass: "",
      imapHost: "imap.gmail.com",
      imapPort: "993",
      enableInbound: false,
    });
    setAddMode("new");
  };

  const handleLinkExisting = async () => {
    if (!selectedEmailId) return;
    setAddSaving(true);
    setError(null);

    try {
      const result = await linkExistingEmail({
        projectId,
        emailId: selectedEmailId,
        memo: selectMemo.trim() || null,
      });

      if (!result.success) {
        setError(result.error ?? "追加に失敗しました");
        clearError();
        return;
      }

      setAddMode(null);
      await loadEmails();
    } catch {
      setError("追加に失敗しました");
      clearError();
    } finally {
      setAddSaving(false);
    }
  };

  const handleAddNew = async () => {
    if (!addForm.email.trim()) return;
    setAddSaving(true);
    setError(null);

    try {
      const result = await addProjectEmail({
        projectId,
        email: addForm.email.trim(),
        memo: addForm.memo.trim() || null,
        smtpHost: isSystemAdmin ? (addForm.smtpHost.trim() || "smtp.gmail.com") : "smtp.gmail.com",
        smtpPort: isSystemAdmin ? (addForm.smtpPort ? parseInt(addForm.smtpPort) : 587) : 587,
        smtpPass: isSystemAdmin ? (addForm.smtpPass.trim() || null) : null,
        imapHost: isSystemAdmin ? (addForm.imapHost.trim() || "imap.gmail.com") : "imap.gmail.com",
        imapPort: isSystemAdmin ? (addForm.imapPort ? parseInt(addForm.imapPort) : 993) : 993,
        enableInbound: isSystemAdmin ? addForm.enableInbound : false,
      });

      if (!result.success) {
        setError(result.error ?? "追加に失敗しました");
        clearError();
        return;
      }

      setAddMode(null);
      await loadEmails();
    } catch {
      setError("追加に失敗しました");
      clearError();
    } finally {
      setAddSaving(false);
    }
  };

  // ============================================
  // 編集（メモ + メール設定統合）
  // ============================================

  const openEditForm = (pe: ProjectEmail) => {
    setEditingEmail(pe);
    setEditForm({
      memo: pe.memo ?? "",
      smtpHost: pe.smtpHost ?? "smtp.gmail.com",
      smtpPort: pe.smtpPort?.toString() ?? "587",
      smtpPass: "",
      imapHost: pe.imapHost ?? "imap.gmail.com",
      imapPort: pe.imapPort?.toString() ?? "993",
      enableInbound: pe.enableInbound,
    });
  };

  const saveEdit = async () => {
    if (!editingEmail) return;
    setEditSaving(true);
    setError(null);

    try {
      // メモを更新
      await updateProjectEmailMemo(editingEmail.id, editForm.memo.trim() || null);

      // メール設定を更新（admin のみ）
      if (isSystemAdmin) {
        await updateEmailSettings(editingEmail.emailId, {
          smtpHost: editForm.smtpHost.trim() || null,
          smtpPort: editForm.smtpPort ? parseInt(editForm.smtpPort) : null,
          smtpPass: editForm.smtpPass.trim() || null,
          imapHost: editForm.imapHost.trim() || null,
          imapPort: editForm.imapPort ? parseInt(editForm.imapPort) : null,
          enableInbound: editForm.enableInbound,
        });
      }

      setEditingEmail(null);
      await loadEmails();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      clearError();
    } finally {
      setEditSaving(false);
    }
  };

  // ============================================
  // デフォルト切り替え
  // ============================================

  const handleToggleDefault = async (pe: ProjectEmail) => {
    setError(null);
    const newDefault = pe.isDefault ? null : pe.id;
    const result = await setProjectDefaultEmail(projectId, newDefault);
    if (!result.success) {
      setError(result.error ?? "設定に失敗しました");
      clearError();
      return;
    }
    setEmails((prev) =>
      prev.map((e) => ({
        ...e,
        isDefault: newDefault === null ? false : e.id === pe.id,
      }))
    );
  };

  // ============================================
  // 削除
  // ============================================

  const handleDelete = async (pe: ProjectEmail) => {
    try {
      await deleteProjectEmail(pe.id);
      setEmails((prev) => prev.filter((e) => e.id !== pe.id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
      clearError();
    }
  };

  // フォーム表示中かどうか
  const isFormOpen = !!addMode || !!editingEmail;

  // ============================================
  // レンダリング
  // ============================================

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{projectName} — メール管理</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* 追加ボタン */}
        {!isFormOpen && (
          <div className="flex justify-end">
            <Button size="sm" onClick={openSelectMode}>
              <Plus className="h-4 w-4 mr-1" />
              メールアドレスを追加
            </Button>
          </div>
        )}

        {/* 既存メールから選択 */}
        {addMode === "select" && (
          <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
            <p className="text-sm font-medium">運営法人のメールアドレスから選択</p>
            <div className="space-y-2">
              {availableEmails.map((ae) => (
                <label
                  key={ae.id}
                  className={`flex items-center gap-3 p-2.5 border rounded-md cursor-pointer transition-colors ${
                    selectedEmailId === ae.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="selectEmail"
                    checked={selectedEmailId === ae.id}
                    onChange={() => setSelectedEmailId(ae.id)}
                    className="accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm">{ae.email}</span>
                    {ae.label && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({ae.label})
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {ae.hasSmtpConfig ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300">
                        送信可
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-500 border-orange-300">
                        SMTP未設定
                      </Badge>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {selectedEmailId && (
              <div className="space-y-1">
                <Label className="text-xs">メモ（プロジェクト用）</Label>
                <Input
                  value={selectMemo}
                  onChange={(e) => setSelectMemo(e.target.value)}
                  placeholder="例: 請求書送付用"
                  className="h-8 text-sm"
                />
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <Button
                size="sm"
                variant="link"
                className="text-xs px-0"
                onClick={openNewMode}
              >
                新しいメールアドレスを登録
              </Button>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddMode(null)}
                >
                  キャンセル
                </Button>
                <Button
                  size="sm"
                  onClick={handleLinkExisting}
                  disabled={addSaving || !selectedEmailId}
                >
                  {addSaving ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" />追加中</>
                  ) : (
                    "追加"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 新規メールアドレス追加 */}
        {addMode === "new" && (
          <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
            <p className="text-sm font-medium">新しいメールアドレスを登録</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">メールアドレス *</Label>
                <Input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="example@gmail.com"
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">メモ</Label>
                <Input
                  value={addForm.memo}
                  onChange={(e) => setAddForm({ ...addForm, memo: e.target.value })}
                  placeholder="例: 請求書送付用"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {isSystemAdmin && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">SMTP設定（送信）</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">SMTPホスト</Label>
                    <Input
                      value={addForm.smtpHost}
                      onChange={(e) => setAddForm({ ...addForm, smtpHost: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">SMTPポート</Label>
                    <Input
                      type="number"
                      value={addForm.smtpPort}
                      onChange={(e) => setAddForm({ ...addForm, smtpPort: e.target.value })}
                      placeholder="587"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground pt-2">IMAP設定（受信）</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">IMAPホスト</Label>
                    <Input
                      value={addForm.imapHost}
                      onChange={(e) => setAddForm({ ...addForm, imapHost: e.target.value })}
                      placeholder="imap.gmail.com"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">IMAPポート</Label>
                    <Input
                      type="number"
                      value={addForm.imapPort}
                      onChange={(e) => setAddForm({ ...addForm, imapPort: e.target.value })}
                      placeholder="993"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1 pt-1">
                  <Label className="text-xs">アプリパスワード（送受信共通）</Label>
                  <Input
                    type="password"
                    value={addForm.smtpPass}
                    onChange={(e) => setAddForm({ ...addForm, smtpPass: e.target.value })}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="h-7 text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addForm.enableInbound}
                    onChange={(e) => setAddForm({ ...addForm, enableInbound: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-xs">受信チェックを有効にする</span>
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddMode(null)}
              >
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={handleAddNew}
                disabled={addSaving || !addForm.email.trim()}
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

        {/* 編集フォーム（メモ + メール設定統合） */}
        {editingEmail && (
          <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
            <p className="text-sm font-medium">
              <span className="font-mono">{editingEmail.email}</span> の設定
            </p>
            <div className="space-y-1">
              <Label className="text-xs">メモ（プロジェクト用）</Label>
              <Input
                value={editForm.memo}
                onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                placeholder="例: 請求書送付用"
                className="h-8 text-sm"
                autoFocus
              />
            </div>

            {isSystemAdmin && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">SMTP設定（送信）</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">SMTPホスト</Label>
                    <Input
                      value={editForm.smtpHost}
                      onChange={(e) => setEditForm({ ...editForm, smtpHost: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">SMTPポート</Label>
                    <Input
                      type="number"
                      value={editForm.smtpPort}
                      onChange={(e) => setEditForm({ ...editForm, smtpPort: e.target.value })}
                      placeholder="587"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground pt-2">IMAP設定（受信）</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">IMAPホスト</Label>
                    <Input
                      value={editForm.imapHost}
                      onChange={(e) => setEditForm({ ...editForm, imapHost: e.target.value })}
                      placeholder="imap.gmail.com"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">IMAPポート</Label>
                    <Input
                      type="number"
                      value={editForm.imapPort}
                      onChange={(e) => setEditForm({ ...editForm, imapPort: e.target.value })}
                      placeholder="993"
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1 pt-1">
                  <Label className="text-xs">アプリパスワード（送受信共通）</Label>
                  <Input
                    type="password"
                    value={editForm.smtpPass}
                    onChange={(e) => setEditForm({ ...editForm, smtpPass: e.target.value })}
                    placeholder="変更時のみ入力"
                    className="h-7 text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.enableInbound}
                    onChange={(e) => setEditForm({ ...editForm, enableInbound: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-xs">受信チェックを有効にする</span>
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingEmail(null)}
              >
                キャンセル
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" />保存中</>
                ) : (
                  "保存"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* メールアドレス一覧 */}
        {emails.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            メールアドレスが登録されていません
          </div>
        ) : (
          <div style={{ overflow: "auto" }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] text-center">既定</TableHead>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>メモ</TableHead>
                  <TableHead>送信</TableHead>
                  <TableHead>受信</TableHead>
                  <TableHead className="w-[80px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((pe) => (
                  <TableRow key={pe.id} className="group/row">
                    <TableCell className="text-center">
                      <button
                        onClick={() => handleToggleDefault(pe)}
                        className={`transition-colors ${
                          pe.isDefault
                            ? "text-yellow-500"
                            : "text-gray-300 hover:text-yellow-400"
                        }`}
                        title={
                          pe.isDefault
                            ? "デフォルトを解除"
                            : pe.hasSmtpConfig
                            ? "デフォルトに設定"
                            : "SMTP未設定のため選択不可"
                        }
                        disabled={!pe.isDefault && !pe.hasSmtpConfig}
                      >
                        {pe.isDefault ? (
                          <Star className="h-4 w-4 fill-current" />
                        ) : (
                          <StarOff className="h-4 w-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{pe.email}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {pe.memo || (
                          <span className="text-muted-foreground italic">-</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {pe.hasSmtpConfig ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 text-green-600 border-green-300"
                        >
                          可能
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 text-orange-500 border-orange-300"
                        >
                          未設定
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {pe.enableInbound ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-300"
                        >
                          有効
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 text-gray-400 border-gray-300"
                        >
                          無効
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEditForm(pe)}
                          disabled={isFormOpen}
                          title="設定を編集"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => setDeleteConfirm(pe)}
                          disabled={isFormOpen}
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
              <strong>{deleteConfirm.email}</strong> を削除しますか？
            </p>
            {deleteConfirm.isDefault && (
              <p className="text-xs text-destructive">
                ※ 現在のデフォルト送信元です。削除するとデフォルトが未設定になります。
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
