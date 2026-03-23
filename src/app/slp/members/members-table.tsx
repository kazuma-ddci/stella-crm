"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CrudTable, ColumnDef, CustomRenderers, CustomAction } from "@/components/crud-table";
import { addMember, updateMember, deleteMember, remindMember, sendContractToMember, clearResubmitted, sendForm5Notification, bulkSendContracts } from "./actions";
import { Bell, Send, ScrollText, AlertTriangle, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { SlpContractModal } from "./slp-contract-modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type Props = {
  data: Record<string, unknown>[];
  memberOptions: { value: string; label: string }[];
  contractStatusOptions: { value: string; label: string }[];
  contractTypeOptions: { value: string; label: string }[];
  autoSendContract: boolean;
};

const statusOptions = [
  { value: "契約書未送付", label: "契約書未送付" },
  { value: "契約書送付済", label: "契約書送付済" },
  { value: "組合員契約書締結", label: "組合員契約書締結" },
  { value: "契約破棄", label: "契約破棄" },
  { value: "送付エラー", label: "送付エラー" },
];

const memberCategoryOptions = [
  { value: "個人（法人代表・役員・従業員）", label: "個人（法人代表・役員・従業員）" },
  { value: "法人担当者", label: "法人担当者" },
  { value: "代理店", label: "代理店" },
];

export function MembersTable({ data, memberOptions, contractStatusOptions, contractTypeOptions, autoSendContract }: Props) {
  const router = useRouter();
  const [form5DialogOpen, setForm5DialogOpen] = useState(false);
  const [form5NotifyCount, setForm5NotifyCount] = useState(0);
  const pendingUpdateRef = useRef<{ id: number; formData: Record<string, unknown> } | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: number; name: string } | null>(null);

  // 一括送付
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);

  // 未送付・送付エラーのメンバー
  const unsendableMembers = data.filter(
    (d) => (d.status === "契約書未送付" || d.status === "送付エラー") && d.email
  );

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === unsendableMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unsendableMembers.map((d) => d.id as number)));
    }
  };

  const handleBulkSend = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}名に契約書を一括送付しますか？`)) return;
    setBulkSending(true);
    try {
      const result = await bulkSendContracts(Array.from(selectedIds));
      if (result.failed > 0) {
        toast.warning(`${result.succeeded}名に送付成功、${result.failed}名が失敗`);
      } else {
        toast.success(`${result.succeeded}名に契約書を送付しました`);
      }
      setSelectedIds(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "一括送付に失敗しました");
    } finally {
      setBulkSending(false);
    }
  };

  const columns: ColumnDef[] = [
    { key: "id", header: "No.", editable: false },
    { key: "lineNo", header: "LINE番号", editable: false },
    { key: "name", header: "氏名", type: "text", required: true, filterable: true },
    { key: "email", header: "メールアドレス", type: "text", filterable: true },
    { key: "status", header: "ステータス", type: "select", options: statusOptions, filterable: true },
    { key: "contractSentDate", header: "契約書送付日", type: "text", editable: false },
    { key: "contractSignedDate", header: "契約締結日", type: "text", editable: false },
    { key: "formSubmittedAt", header: "フォーム送信日時", type: "text", editable: false },
    { key: "position", header: "役職", type: "text" },
    { key: "company", header: "会社", type: "text", filterable: true },
    { key: "memberCategory", header: "入会者区分", type: "select", options: memberCategoryOptions, filterable: true },
    { key: "lineName", header: "LINE名", type: "text" },
    { key: "uid", header: "UID", type: "text", required: true, editableOnCreate: true },
    { key: "phone", header: "電話番号", type: "text" },
    { key: "address", header: "住所", type: "text" },
    { key: "referrerUid", header: "紹介者", type: "select", options: memberOptions, searchable: true, hidden: true },
    { key: "referrerDisplay", header: "紹介者", editable: false, filterable: true },
    { key: "note", header: "備考", type: "textarea" },
    { key: "memo", header: "メモ", type: "textarea" },
    { key: "documentId", header: "documentID", type: "text" },
    { key: "cloudsignUrl", header: "クラウドサインURL", type: "text" },
    { key: "reminderCount", header: "リマインド回数", type: "number", defaultValue: 0 },
    { key: "lastReminderSentAt", header: "直近リマインド日時", type: "text", editable: false },
    { key: "emailChangeCount", header: "メアド変更回数", type: "number", editable: false },
    { key: "watermarkCode", header: "透かしコード", type: "text", editable: false },
  ];

  const customRenderers: CustomRenderers = {
    referrerDisplay: (value) => {
      if (!value) return "-";
      return String(value);
    },
    status: (value, row) => {
      const resubmitted = Boolean(row?.resubmitted);
      const statusStr = String(value || "");

      const isError = statusStr === "送付エラー";

      return (
        <div className="flex items-center gap-1.5">
          {isError ? (
            <span className="inline-flex items-center bg-red-100 text-red-800 text-xs font-semibold px-2 py-0.5 rounded-full">
              送付エラー
            </span>
          ) : (
            <span>{statusStr || "-"}</span>
          )}
          {resubmitted && (
            <span
              className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full cursor-pointer hover:bg-amber-200"
              title="未締結のまま再フォーム送信されました。クリックで通知をクリアします。"
              onClick={async (e) => {
                e.stopPropagation();
                const id = row?.id as number;
                if (id) {
                  await clearResubmitted(id);
                  toast.success("通知をクリアしました");
                  router.refresh();
                }
              }}
            >
              再送信
            </span>
          )}
        </div>
      );
    },
  };

  const customActions: CustomAction[] = [
    {
      label: "契約管理",
      icon: <ScrollText className="h-4 w-4" />,
      onClick: async (row) => {
        setSelectedMember({ id: row.id as number, name: row.name as string });
        setContractModalOpen(true);
      },
    },
    {
      label: "新規契約書送付",
      icon: <Send className="h-4 w-4" />,
      onClick: async (row) => {
        if (row.status === "組合員契約書締結") {
          toast.error("この組合員は契約締結済みです");
          return;
        }
        if (!row.email) {
          toast.error("メールアドレスが登録されていません");
          return;
        }
        const id = row.id as number;
        const name = row.name as string;
        const email = row.email as string;
        if (!confirm(`${name}さん（${email}）に新規契約書を送付しますか？`)) return;
        try {
          await sendContractToMember(id);
          toast.success(`${name}さんに契約書を送付しました`);
          router.refresh();
        } catch (error) {
          const msg = error instanceof Error ? error.message : "契約書送付に失敗しました";
          toast.error(msg);
        }
      },
    },
    {
      label: "リマインド送付",
      icon: <Bell className="h-4 w-4" />,
      onClick: async (row) => {
        if (row.status !== "契約書送付済" || !row.documentId) {
          toast.error("この組合員はリマインド対象ではありません");
          return;
        }
        const id = row.id as number;
        const name = row.name as string;
        if (!confirm(`${name}さんにリマインドを送付しますか？`)) return;
        try {
          await remindMember(id);
          toast.success(`${name}さんにリマインドを送付しました`);
          router.refresh();
        } catch (error) {
          const msg = error instanceof Error ? error.message : "リマインド送付に失敗しました";
          toast.error(msg);
        }
      },
    },
  ];

  const handleAdd = async (formData: Record<string, unknown>) => {
    await addMember(formData);
    router.refresh();
  };

  const handleUpdate = async (id: number, formData: Record<string, unknown>) => {
    // ステータスが「組合員契約書締結」に変更された場合、通知確認ダイアログを表示
    const currentRow = data.find((d) => d.id === id);
    const newStatus = formData.status as string | undefined;
    const oldStatus = currentRow?.status as string | undefined;

    if (
      newStatus === "組合員契約書締結" &&
      oldStatus !== "組合員契約書締結"
    ) {
      pendingUpdateRef.current = { id, formData };
      setForm5NotifyCount((currentRow?.form5NotifyCount as number) ?? 0);
      setForm5DialogOpen(true);
      return;
    }

    await updateMember(id, formData);
    router.refresh();
  };

  const handleForm5Confirm = useCallback(async (sendNotification: boolean) => {
    setForm5DialogOpen(false);
    const pending = pendingUpdateRef.current;
    if (!pending) return;
    pendingUpdateRef.current = null;

    try {
      await updateMember(pending.id, pending.formData);
      if (sendNotification) {
        try {
          await sendForm5Notification(pending.id);
          toast.success("紹介者に契約締結通知を送信しました");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "通知送信に失敗しました";
          toast.error(msg);
        }
      }
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "更新に失敗しました";
      toast.error(msg);
    }
  }, [router]);

  const handleDelete = async (id: number) => {
    await deleteMember(id);
    router.refresh();
  };

  return (
    <>
      {/* 自動送付OFF警告バナー */}
      {!autoSendContract && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800">
              契約書の自動送付が停止中です
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              フォームから登録されたメンバーには、手動で契約書を送付してください。
            </p>
          </div>
          <Link href="/slp/settings/project">
            <Button variant="outline" size="sm" className="shrink-0">
              <Settings className="h-4 w-4 mr-1" />
              設定を変更
            </Button>
          </Link>
        </div>
      )}

      {/* 一括送付バー */}
      {unsendableMembers.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2">
          <Checkbox
            checked={selectedIds.size === unsendableMembers.length && unsendableMembers.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            未送付メンバー: {unsendableMembers.length}名
            {selectedIds.size > 0 && `（${selectedIds.size}名選択中）`}
          </span>
          {unsendableMembers.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              {unsendableMembers.map((m) => {
                const id = m.id as number;
                const name = m.name as string;
                const isError = m.status === "送付エラー";
                return (
                  <label
                    key={id}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs cursor-pointer border transition-colors ${
                      selectedIds.has(id)
                        ? "bg-blue-100 border-blue-300 text-blue-800"
                        : isError
                          ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Checkbox
                      checked={selectedIds.has(id)}
                      onCheckedChange={() => toggleSelected(id)}
                      className="h-3 w-3"
                    />
                    {name}
                    {isError && <span className="text-[10px]">(エラー)</span>}
                  </label>
                );
              })}
            </div>
          )}
          <Button
            size="sm"
            className="ml-auto"
            disabled={selectedIds.size === 0 || bulkSending}
            onClick={handleBulkSend}
          >
            {bulkSending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            一括送付 ({selectedIds.size})
          </Button>
        </div>
      )}

      <CrudTable
        data={data}
        columns={columns}
        title="組合員"
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        customRenderers={customRenderers}
        customActions={customActions}
        emptyMessage="組合員が登録されていません"
      />

      {selectedMember && (
        <SlpContractModal
          open={contractModalOpen}
          onOpenChange={setContractModalOpen}
          memberId={selectedMember.id}
          memberName={selectedMember.name}
          contractStatusOptions={contractStatusOptions}
          contractTypeOptions={contractTypeOptions}
        />
      )}

      <AlertDialog open={form5DialogOpen} onOpenChange={setForm5DialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>紹介者への契約締結通知</AlertDialogTitle>
            <AlertDialogDescription>
              {form5NotifyCount === 0
                ? "紹介者に契約書締結を通知しますか？"
                : `すでに通知を${form5NotifyCount}回送信していますが、再度通知しますか？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleForm5Confirm(false)}>
              いいえ（通知なし）
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleForm5Confirm(true)}>
              はい（通知する）
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
