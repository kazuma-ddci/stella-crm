"use client";

import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef, CustomRenderers, CustomAction } from "@/components/crud-table";
import { addMember, updateMember, deleteMember, remindMember, sendContractToMember, clearResubmitted } from "./actions";
import { Bell, Send } from "lucide-react";
import { toast } from "sonner";

type Props = {
  data: Record<string, unknown>[];
  memberOptions: { value: string; label: string }[];
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

export function MembersTable({ data, memberOptions }: Props) {
  const router = useRouter();

  const columns: ColumnDef[] = [
    { key: "id", header: "No.", editable: false },
    { key: "lineNo", header: "LINE No.", editable: false },
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
    await updateMember(id, formData);
    router.refresh();
  };

  const handleDelete = async (id: number) => {
    await deleteMember(id);
    router.refresh();
  };

  return (
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
  );
}
