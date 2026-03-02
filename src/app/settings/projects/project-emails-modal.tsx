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
  Settings,
  Star,
  StarOff,
  Loader2,
  X,
  Check,
} from "lucide-react";
import {
  addProjectEmail,
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
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 追加フォーム
  const [isAddMode, setIsAddMode] = useState(false);
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

  // メモ編集
  const [editingMemoId, setEditingMemoId] = useState<number | null>(null);
  const [memoValue, setMemoValue] = useState("");

  // メール設定編集
  const [smtpEditId, setSmtpEditId] = useState<number | null>(null);
  const [smtpForm, setSmtpForm] = useState({
    smtpHost: "",
    smtpPort: "",
    smtpPass: "",
    imapHost: "",
    imapPort: "",
    enableInbound: false,
  });
  const [smtpSaving, setSmtpSaving] = useState(false);

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
      setIsAddMode(false);
      setEditingMemoId(null);
      setSmtpEditId(null);
      setDeleteConfirm(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  // ============================================
  // メール追加
  // ============================================

  const openAddForm = () => {
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
    setIsAddMode(true);
  };

  const handleAdd = async () => {
    if (!addForm.email.trim()) return;
    setAddSaving(true);
    setError(null);

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

    setAddSaving(false);
    if (!result.success) {
      setError(result.error ?? "追加に失敗しました");
      clearError();
      return;
    }

    setIsAddMode(false);
    await loadEmails();
  };

  // ============================================
  // メモ編集
  // ============================================

  const startMemoEdit = (pe: ProjectEmail) => {
    setEditingMemoId(pe.id);
    setMemoValue(pe.memo ?? "");
  };

  const saveMemo = async (peId: number) => {
    try {
      await updateProjectEmailMemo(peId, memoValue.trim() || null);
      setEmails((prev) =>
        prev.map((e) =>
          e.id === peId ? { ...e, memo: memoValue.trim() || null } : e
        )
      );
      setEditingMemoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "メモの更新に失敗しました");
      clearError();
    }
  };

  // ============================================
  // SMTP編集（admin専用）
  // ============================================

  const openSmtpEdit = (pe: ProjectEmail) => {
    setSmtpEditId(pe.emailId);
    setSmtpForm({
      smtpHost: pe.smtpHost ?? "smtp.gmail.com",
      smtpPort: pe.smtpPort?.toString() ?? "587",
      smtpPass: "",
      imapHost: pe.imapHost ?? "imap.gmail.com",
      imapPort: pe.imapPort?.toString() ?? "993",
      enableInbound: pe.enableInbound,
    });
  };

  const saveSmtp = async () => {
    if (smtpEditId === null) return;
    setSmtpSaving(true);
    setError(null);

    try {
      await updateEmailSettings(smtpEditId, {
        smtpHost: smtpForm.smtpHost.trim() || null,
        smtpPort: smtpForm.smtpPort ? parseInt(smtpForm.smtpPort) : null,
        smtpPass: smtpForm.smtpPass.trim() || null,
        imapHost: smtpForm.imapHost.trim() || null,
        imapPort: smtpForm.imapPort ? parseInt(smtpForm.imapPort) : null,
        enableInbound: smtpForm.enableInbound,
      });
      setSmtpEditId(null);
      await loadEmails();
    } catch (err) {
      setError(err instanceof Error ? err.message : "メール設定の更新に失敗しました");
      clearError();
    } finally {
      setSmtpSaving(false);
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

        {/* 追加ボタン / 追加フォーム */}
        {!isAddMode && !smtpEditId && (
          <div className="flex justify-end">
            <Button size="sm" onClick={openAddForm}>
              <Plus className="h-4 w-4 mr-1" />
              メールアドレスを追加
            </Button>
          </div>
        )}

        {isAddMode && (
          <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
            <p className="text-sm font-medium">メールアドレスを追加</p>
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
                onClick={() => setIsAddMode(false)}
              >
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
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

        {/* メール設定編集フォーム（admin専用） */}
        {smtpEditId !== null && (
          <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
            <p className="text-sm font-medium">メール設定を編集</p>
            <p className="text-xs font-medium text-muted-foreground">SMTP設定（送信）</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">SMTPホスト</Label>
                <Input
                  value={smtpForm.smtpHost}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SMTPポート</Label>
                <Input
                  type="number"
                  value={smtpForm.smtpPort}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtpPort: e.target.value })}
                  placeholder="587"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground pt-2">IMAP設定（受信）</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">IMAPホスト</Label>
                <Input
                  value={smtpForm.imapHost}
                  onChange={(e) => setSmtpForm({ ...smtpForm, imapHost: e.target.value })}
                  placeholder="imap.gmail.com"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IMAPポート</Label>
                <Input
                  type="number"
                  value={smtpForm.imapPort}
                  onChange={(e) => setSmtpForm({ ...smtpForm, imapPort: e.target.value })}
                  placeholder="993"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1 pt-1">
              <Label className="text-xs">アプリパスワード（送受信共通）</Label>
              <Input
                type="password"
                value={smtpForm.smtpPass}
                onChange={(e) => setSmtpForm({ ...smtpForm, smtpPass: e.target.value })}
                placeholder="変更時のみ入力"
                className="h-8 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={smtpForm.enableInbound}
                onChange={(e) => setSmtpForm({ ...smtpForm, enableInbound: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-xs">受信チェックを有効にする</span>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSmtpEditId(null)}
              >
                キャンセル
              </Button>
              <Button size="sm" onClick={saveSmtp} disabled={smtpSaving}>
                {smtpSaving ? (
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
                  <TableHead className="w-[100px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
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
                      {editingMemoId === pe.id ? (
                        <div className="flex gap-1 items-center">
                          <Input
                            value={memoValue}
                            onChange={(e) => setMemoValue(e.target.value)}
                            className="h-7 text-xs w-32"
                            placeholder="メモ"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveMemo(pe.id);
                              if (e.key === "Escape") setEditingMemoId(null);
                            }}
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => saveMemo(pe.id)}
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
                          onClick={() => startMemoEdit(pe)}
                        >
                          {pe.memo || (
                            <span className="text-muted-foreground italic">
                              メモを追加
                            </span>
                          )}
                        </button>
                      )}
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
                          onClick={() => startMemoEdit(pe)}
                          title="メモを編集"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {isSystemAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openSmtpEdit(pe)}
                            title="メール設定"
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => setDeleteConfirm(pe)}
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
