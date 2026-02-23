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
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
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
  smtpPass: string | null;
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

export function EmailsModal({
  open,
  onOpenChange,
  companyId,
  companyName,
  emails: initialEmails,
  canEdit,
}: Props) {
  const [emails, setEmails] = useState<CompanyEmail[]>(initialEmails);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editEmail, setEditEmail] = useState<CompanyEmail | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CompanyEmail | null>(null);
  const [formData, setFormData] = useState<Partial<CompanyEmail>>({});
  const [loading, setLoading] = useState(false);
  const [showSmtp, setShowSmtp] = useState(false);

  useEffect(() => {
    setEmails(initialEmails);
    setIsAddMode(false);
    setEditEmail(null);
    setFormData({});
    setDeleteConfirm(null);
    setShowSmtp(false);
  }, [initialEmails, open]);

  const openAddForm = () => {
    setFormData({
      email: "",
      label: null,
      smtpHost: null,
      smtpPort: null,
      smtpUser: null,
      smtpPass: null,
      isDefault: false,
    });
    setShowSmtp(false);
    setIsAddMode(true);
  };

  const openEditForm = (email: CompanyEmail) => {
    setFormData({ ...email });
    setShowSmtp(!!(email.smtpHost || email.smtpPort || email.smtpUser));
    setEditEmail(email);
  };

  const handleAdd = async () => {
    if (!formData.email) {
      toast.error("メールアドレスは必須です");
      return;
    }
    setLoading(true);
    try {
      const newEmail = await addOperatingCompanyEmail(companyId, formData);
      if (newEmail.isDefault) {
        setEmails((prev) =>
          [...prev.map((e) => ({ ...e, isDefault: false })), newEmail as unknown as CompanyEmail]
        );
      } else {
        setEmails([...emails, newEmail as unknown as CompanyEmail]);
      }
      toast.success("メールアドレスを追加しました");
      setIsAddMode(false);
      setFormData({});
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editEmail || !formData.email) {
      toast.error("メールアドレスは必須です");
      return;
    }
    setLoading(true);
    try {
      const updated = await updateOperatingCompanyEmail(editEmail.id, formData);
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
      setEditEmail(null);
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
    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            メールアドレス <span className="text-destructive">*</span>
          </Label>
          <Input
            type="email"
            value={formData.email || ""}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="info@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label>用途ラベル</Label>
          <Input
            value={formData.label || ""}
            onChange={(e) =>
              setFormData({ ...formData, label: e.target.value || null })
            }
            placeholder="請求書送付用"
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          checked={formData.isDefault === true}
          onCheckedChange={(checked: boolean) =>
            setFormData({ ...formData, isDefault: checked })
          }
        />
        <Label>デフォルトに設定</Label>
      </div>

      {/* SMTP設定 */}
      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setShowSmtp(!showSmtp)}
        >
          {showSmtp ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          SMTP設定（個別設定する場合）
        </button>
        {showSmtp && (
          <div className="mt-3 space-y-3 pl-5 border-l-2 border-muted">
            <p className="text-xs text-muted-foreground">
              未入力の場合はシステム共通のSMTP設定が使用されます
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTPホスト</Label>
                <Input
                  value={formData.smtpHost || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, smtpHost: e.target.value || null })
                  }
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label>SMTPポート</Label>
                <Input
                  type="number"
                  value={formData.smtpPort ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      smtpPort: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="587"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTPユーザー</Label>
                <Input
                  value={formData.smtpUser || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, smtpUser: e.target.value || null })
                  }
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>SMTPパスワード</Label>
                <Input
                  type="password"
                  value={formData.smtpPass || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, smtpPass: e.target.value || null })
                  }
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setIsAddMode(false);
            setEditEmail(null);
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
      <DialogContent size="mixed" className="p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
          <DialogTitle>メールアドレス - {companyName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4">
          <div className="space-y-4">
            {/* 追加ボタン */}
            {canEdit && !isAddMode && !editEmail && (
              <div className="flex justify-end">
                <Button onClick={openAddForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  メールアドレスを追加
                </Button>
              </div>
            )}

            {/* 追加/編集フォーム */}
            {(isAddMode || editEmail) && renderForm()}

            {/* メールアドレス一覧 */}
            {emails.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                メールアドレスが登録されていません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>メールアドレス</TableHead>
                      <TableHead>用途</TableHead>
                      <TableHead>SMTP</TableHead>
                      <TableHead>デフォルト</TableHead>
                      {canEdit && <TableHead className="w-[120px]">操作</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emails.map((email) => (
                      <TableRow key={email.id}>
                        <TableCell className="font-medium">
                          {email.email}
                        </TableCell>
                        <TableCell>{email.label || "-"}</TableCell>
                        <TableCell>
                          {email.smtpHost ? (
                            <Badge variant="outline">個別設定</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              共通
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {email.isDefault && (
                            <Badge>デフォルト</Badge>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditForm(email)}
                                disabled={isAddMode || !!editEmail}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm(email)}
                                disabled={isAddMode || !!editEmail}
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
                  「{deleteConfirm.email}」を削除しますか？
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
