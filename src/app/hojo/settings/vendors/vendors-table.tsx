"use client";

import { CrudTable, ColumnDef, CustomRenderers, CustomAction } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import {
  addVendor, updateVendor, deleteVendor, reorderVendors,
  addVendorContact, updateVendorContact, deleteVendorContact, setPrimaryContact,
} from "./actions";
import { Copy, Plus, Trash2, Star, Users, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ContactData = {
  id: number;
  lineFriendId: number | null;
  lineFriendName: string | null;
  joseiLineFriendId: number | null;
  joseiLineFriendName: string | null;
  isPrimary: boolean;
};

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
  lineFriendOptions: { value: string; label: string }[];
  joseiLineFriendOptions: { value: string; label: string }[];
  scLabel: string;
  joseiLabel: string;
};

export function VendorsTable({ data, canEdit, lineFriendOptions, joseiLineFriendOptions, scLabel, joseiLabel }: Props) {
  const router = useRouter();
  const [contactsDialog, setContactsDialog] = useState<{ vendorId: number; vendorName: string; contacts: ContactData[] } | null>(null);
  const [contactFormDialog, setContactFormDialog] = useState<{
    vendorId: number;
    editContact?: ContactData;
  } | null>(null);
  const [formScId, setFormScId] = useState<string>("");
  const [formJoseiId, setFormJoseiId] = useState<string>("");

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    // 旧フィールド（編集ダイアログ用に残す）
    { key: "lineFriendId", header: `${scLabel}LINE`, type: "select", options: lineFriendOptions, searchable: true, hidden: true },
    { key: "joseiLineFriendId", header: `${joseiLabel}LINE`, type: "select", options: joseiLineFriendOptions, searchable: true, hidden: true },
    { key: "name", header: "ベンダー名", type: "text", required: true, filterable: true },
    { key: "accessToken", header: "専用ページURL", editable: false },
    { key: "primaryContactDisplay", header: "メイン担当者", editable: false },
    { key: "contacts", header: "担当者", editable: false },
    { key: "memo", header: "備考", type: "textarea" },
    { key: "isActive", header: "有効", type: "boolean" },
  ];

  const customRenderers: CustomRenderers = {
    name: (value, row) => {
      const id = row.id as number;
      return (
        <a
          href={`/hojo/settings/vendors/${id}`}
          className="text-blue-600 hover:underline font-medium"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {String(value)}
        </a>
      );
    },
    accessToken: (value) => {
      if (!value) return "-";
      const path = `/hojo/vendor/${value}`;
      const vendorDomain = process.env.NEXT_PUBLIC_VENDOR_DOMAIN || "https://vendor.alkes.jp";
      const fullUrl = `${vendorDomain}${path}`;
      const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(fullUrl);
        toast.success("URLをコピーしました");
      };
      return (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{fullUrl}</span>
          <button onClick={handleCopy} className="text-gray-400 hover:text-blue-600 shrink-0">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    },
    primaryContactDisplay: (value) => {
      if (!value || value === "-") return <span className="text-gray-400">-</span>;
      return <span className="text-sm">{String(value)}</span>;
    },
    contacts: (_, row) => {
      const contacts = (row.contacts || []) as ContactData[];
      const count = contacts.length;
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openContactsDialog(row);
          }}
          className="flex items-center gap-1 text-sm hover:text-blue-600 transition-colors"
        >
          <Users className="h-3.5 w-3.5" />
          <span>{count}人</span>
        </button>
      );
    },
  };

  const customActions: CustomAction[] = canEdit ? [
    {
      icon: <Users className="h-4 w-4" />,
      label: "担当者管理",
      onClick: (item) => openContactsDialog(item),
    },
  ] : [];

  function openContactsDialog(row: Record<string, unknown>) {
    setContactsDialog({
      vendorId: row.id as number,
      vendorName: row.name as string,
      contacts: (row.contacts || []) as ContactData[],
    });
  }

  function openAddForm(vendorId: number) {
    setFormScId("");
    setFormJoseiId("");
    setContactFormDialog({ vendorId });
  }

  function openEditForm(vendorId: number, contact: ContactData) {
    setFormScId(contact.lineFriendId ? String(contact.lineFriendId) : "");
    setFormJoseiId(contact.joseiLineFriendId ? String(contact.joseiLineFriendId) : "");
    setContactFormDialog({ vendorId, editContact: contact });
  }

  function closeForm() {
    setContactFormDialog(null);
    setFormScId("");
    setFormJoseiId("");
  }

  const handleSaveContact = async () => {
    if (!contactFormDialog) return;
    const scId = formScId ? Number(formScId) : null;
    const joseiId = formJoseiId ? Number(formJoseiId) : null;
    if (!scId && !joseiId) {
      toast.error("いずれかのLINE情報を選択してください");
      return;
    }
    try {
      if (contactFormDialog.editContact) {
        await updateVendorContact(contactFormDialog.editContact.id, scId, joseiId);
        toast.success("担当者を更新しました");
      } else {
        await addVendorContact(contactFormDialog.vendorId, scId, joseiId);
        toast.success("担当者を追加しました");
      }
      closeForm();
      setContactsDialog(null);
      router.refresh();
    } catch {
      toast.error("保存に失敗しました");
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!confirm("この担当者を削除しますか？")) return;
    try {
      await deleteVendorContact(contactId);
      toast.success("担当者を削除しました");
      setContactsDialog(null);
      router.refresh();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const handleSetPrimary = async (contactId: number) => {
    try {
      await setPrimaryContact(contactId);
      toast.success("主担当を変更しました");
      setContactsDialog(null);
      router.refresh();
    } catch {
      toast.error("変更に失敗しました");
    }
  };

  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
  }));

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="ベンダー"
        onAdd={canEdit ? addVendor : undefined}
        onUpdate={canEdit ? updateVendor : undefined}
        onDelete={canEdit ? deleteVendor : undefined}
        emptyMessage="ベンダーが登録されていません"
        sortableItems={canEdit ? sortableItems : undefined}
        onReorder={canEdit ? reorderVendors : undefined}
        customRenderers={customRenderers}
        customActions={customActions}
      />

      {/* 担当者一覧ダイアログ */}
      <Dialog open={!!contactsDialog} onOpenChange={() => setContactsDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{contactsDialog?.vendorName} — 担当者管理</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {contactsDialog?.contacts.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">担当者が登録されていません</p>
            )}
            {contactsDialog?.contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-2 p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {c.isPrimary && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                        <Star className="h-3 w-3 mr-0.5 fill-amber-500" />主担当
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm space-y-0.5">
                    <div className="text-gray-600">
                      {scLabel}LINE: {c.lineFriendId ? `${c.lineFriendId} ${c.lineFriendName || ""}` : "-"}
                    </div>
                    <div className="text-gray-600">
                      {joseiLabel}LINE: {c.joseiLineFriendId ? `${c.joseiLineFriendId} ${c.joseiLineFriendName || ""}` : "-"}
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (contactsDialog) openEditForm(contactsDialog.vendorId, c);
                      }}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600"
                      title="編集"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!c.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(c.id)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-amber-600"
                        title="主担当にする"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(c.id)}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {canEdit && (
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (contactsDialog) openAddForm(contactsDialog.vendorId);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                担当者を追加
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* 担当者 追加/編集ダイアログ */}
      <Dialog open={!!contactFormDialog} onOpenChange={() => closeForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {contactFormDialog?.editContact ? "担当者を編集" : "担当者を追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">{scLabel}LINE</label>
              <Select value={formScId} onValueChange={setFormScId}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">選択なし</SelectItem>
                  {lineFriendOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{joseiLabel}LINE</label>
              <Select value={formJoseiId} onValueChange={setFormJoseiId}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">選択なし</SelectItem>
                  {joseiLineFriendOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              キャンセル
            </Button>
            <Button onClick={handleSaveContact}>
              {contactFormDialog?.editContact ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
