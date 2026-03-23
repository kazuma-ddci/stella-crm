"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef, CustomRenderers, CustomAction } from "@/components/crud-table";
import { addMember, updateMember, deleteMember, remindMember, sendContractToMember, clearResubmitted, sendForm5Notification } from "./actions";
import { Bell, Send, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { SlpContractModal } from "./slp-contract-modal";
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

export function MembersTable({ data, memberOptions, contractStatusOptions, contractTypeOptions }: Props) {
  const router = useRouter();
  const [form5DialogOpen, setForm5DialogOpen] = useState(false);
  const [form5NotifyCount, setForm5NotifyCount] = useState(0);
  const pendingUpdateRef = useRef<{ id: number; formData: Record<string, unknown> } | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: number; name: string } | null>(null);

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
