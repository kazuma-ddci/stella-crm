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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  addOperatingCompanyEmail,
  updateOperatingCompanyEmail,
  deleteOperatingCompanyEmail,
} from "./email-actions";

export type CompanyEmail = {
  id: number;
  operatingCompanyId: number;
  email: string;
  label: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  hasSmtpPass: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapUser: string | null;
  hasImapPass: boolean;
  enableInbound: boolean;
  isDefault: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  companyName: string;
  emails: CompanyEmail[];
  canEdit: boolean;
};

type FormData = {
  email: string;
  label: string;
  isDefault: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpPass: string;
  imapHost: string;
  imapPort: string;
  enableInbound: boolean;
};

const defaultForm: FormData = {
  email: "",
  label: "",
  isDefault: false,
  smtpHost: "smtp.gmail.com",
  smtpPort: "587",
  smtpPass: "",
  imapHost: "imap.gmail.com",
  imapPort: "993",
  enableInbound: false,
};

export function EmailsModal({
  open,
  onOpenChange,
  companyId,
  companyName,
  emails: initialEmails,
  canEdit,
}: Props) {
  const [emails, setEmails] = useState<CompanyEmail[]>(initialEmails);
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editEmail, setEditEmail] = useState<CompanyEmail | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CompanyEmail | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEmails(initialEmails);
    setMode("list");
    setEditEmail(null);
    setForm(defaultForm);
    setDeleteConfirm(null);
  }, [initialEmails, open]);

  const openAddForm = () => {
    setForm(defaultForm);
    setMode("add");
  };

  const openEditForm = (email: CompanyEmail) => {
    setEditEmail(email);
    setForm({
      email: email.email,
      label: email.label || "",
      isDefault: email.isDefault,
      smtpHost: email.smtpHost || "smtp.gmail.com",
      smtpPort: email.smtpPort?.toString() || "587",
      smtpPass: "",
      imapHost: email.imapHost || "imap.gmail.com",
      imapPort: email.imapPort?.toString() || "993",
      enableInbound: email.enableInbound,
    });
    setMode("edit");
  };

  const cancelForm = () => {
    setMode("list");
    setEditEmail(null);
    setForm(defaultForm);
  };

  const handleAdd = async () => {
    if (!form.email.trim()) {
      toast.error("メールアドレスは必須です");
      return;
    }
    setLoading(true);
    try {
      const newEmail = await addOperatingCompanyEmail(companyId, {
        email: form.email.trim(),
        label: form.label.trim() || null,
        isDefault: form.isDefault,
        smtpHost: form.smtpHost.trim() || null,
        smtpPort: form.smtpPort ? Number(form.smtpPort) : null,
        smtpPass: form.smtpPass.trim() || null,
        imapHost: form.imapHost.trim() || null,
        imapPort: form.imapPort ? Number(form.imapPort) : null,
        enableInbound: form.enableInbound,
      });
      if (newEmail.isDefault) {
        setEmails((prev) => [
          ...prev.map((e) => ({ ...e, isDefault: false })),
          newEmail as unknown as CompanyEmail,
        ]);
      } else {
        setEmails([...emails, newEmail as unknown as CompanyEmail]);
      }
      toast.success("メールアドレスを追加しました");
      cancelForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editEmail || !form.email.trim()) {
      toast.error("メールアドレスは必須です");
      return;
    }
    setLoading(true);
    try {
      const updated = await updateOperatingCompanyEmail(editEmail.id, {
        email: form.email.trim(),
        label: form.label.trim() || null,
        isDefault: form.isDefault,
        smtpHost: form.smtpHost.trim() || null,
        smtpPort: form.smtpPort ? Number(form.smtpPort) : null,
        smtpPass: form.smtpPass.trim() || null,
        imapHost: form.imapHost.trim() || null,
        imapPort: form.imapPort ? Number(form.imapPort) : null,
        enableInbound: form.enableInbound,
      });
      if (updated.isDefault) {
        setEmails(
          emails.map((e) =>
            e.id === editEmail.id
              ? (updated as unknown as CompanyEmail)
              : { ...e, isDefault: false }
          )
        );
      } else {
        setEmails(
          emails.map((e) =>
            e.id === editEmail.id ? (updated as unknown as CompanyEmail) : e
          )
        );
      }
      toast.success("メールアドレスを更新しました");
      cancelForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setLoading(true);
    try {
      await deleteOperatingCompanyEmail(deleteConfirm.id);
      setEmails(emails.filter((e) => e.id !== deleteConfirm.id));
      toast.success("メールアドレスを削除しました");
      setDeleteConfirm(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
      <p className="text-sm font-medium">
        {mode === "add" ? "メールアドレスを追加" : "メールアドレスを編集"}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">
            メールアドレス <span className="text-destructive">*</span>
          </Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="example@gmail.com"
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">用途ラベル</Label>
          <Input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="例: 請求書送付用"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          checked={form.isDefault}
          onCheckedChange={(checked: boolean) =>
            setForm({ ...form, isDefault: checked })
          }
        />
        <Label className="text-xs">送信デフォルトに設定</Label>
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">SMTP設定（送信）</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">SMTPホスト</Label>
            <Input
              value={form.smtpHost}
              onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
              placeholder="smtp.gmail.com"
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">SMTPポート</Label>
            <Input
              type="number"
              value={form.smtpPort}
              onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
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
              value={form.imapHost}
              onChange={(e) => setForm({ ...form, imapHost: e.target.value })}
              placeholder="imap.gmail.com"
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">IMAPポート</Label>
            <Input
              type="number"
              value={form.imapPort}
              onChange={(e) => setForm({ ...form, imapPort: e.target.value })}
              placeholder="993"
              className="h-7 text-xs"
            />
          </div>
        </div>
        <div className="space-y-1 pt-1">
          <Label className="text-xs">アプリパスワード（送受信共通）</Label>
          <Input
            type="password"
            value={form.smtpPass}
            onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
            placeholder={mode === "edit" && editEmail?.hasSmtpPass ? "変更時のみ入力" : "xxxx xxxx xxxx xxxx"}
            className="h-7 text-xs"
          />
        </div>
        <label className="flex items-center gap-2 pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enableInbound}
            onChange={(e) => setForm({ ...form, enableInbound: e.target.checked })}
            className="rounded border-gray-300"
          />
          <span className="text-xs">受信チェックを有効にする</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={cancelForm}>
          キャンセル
        </Button>
        <Button
          size="sm"
          onClick={mode === "add" ? handleAdd : handleUpdate}
          disabled={loading || !form.email.trim()}
        >
          {loading ? (
            <><Loader2 className="h-3 w-3 mr-1 animate-spin" />{mode === "add" ? "追加中" : "保存中"}</>
          ) : (
            mode === "add" ? "追加" : "保存"
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="mixed" className="p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
          <DialogTitle>メールアドレス - {companyName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4">
          <div className="space-y-4">
            {/* 追加ボタン */}
            {canEdit && mode === "list" && (
              <div className="flex justify-end">
                <Button size="sm" onClick={openAddForm}>
                  <Plus className="mr-1 h-4 w-4" />
                  メールアドレスを追加
                </Button>
              </div>
            )}

            {/* 追加/編集フォーム */}
            {(mode === "add" || mode === "edit") && renderForm()}

            {/* メールアドレス一覧 */}
            {emails.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                メールアドレスが登録されていません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>メールアドレス</TableHead>
                      <TableHead>用途</TableHead>
                      <TableHead>送信</TableHead>
                      <TableHead>受信</TableHead>
                      <TableHead>デフォルト</TableHead>
                      {canEdit && (
                        <TableHead className="w-[100px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          操作
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emails.map((email) => (
                      <TableRow key={email.id} className="group/row">
                        <TableCell className="font-mono text-sm">
                          {email.email}
                        </TableCell>
                        <TableCell className="text-sm">
                          {email.label || "-"}
                        </TableCell>
                        <TableCell>
                          {email.smtpHost && email.smtpUser && email.hasSmtpPass ? (
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
                          {email.enableInbound ? (
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
                        <TableCell>
                          {email.isDefault && (
                            <Badge className="text-[10px] px-1.5 py-0">
                              デフォルト
                            </Badge>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                            <div className="flex gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditForm(email)}
                                disabled={mode !== "list"}
                                title="編集"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={() => setDeleteConfirm(email)}
                                disabled={mode !== "list"}
                                title="削除"
                              >
                                <Trash2 className="h-3 w-3" />
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
              <div className="border rounded-lg p-4 bg-destructive/10 space-y-2">
                <p className="text-sm">
                  <strong>{deleteConfirm.email}</strong> を削除しますか？
                </p>
                {deleteConfirm.isDefault && (
                  <p className="text-xs text-destructive">
                    ※ 現在のデフォルト送信元です。削除するとデフォルトが未設定になります。
                  </p>
                )}
                <div className="flex gap-2 justify-end">
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
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    {loading ? "削除中..." : "削除"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
