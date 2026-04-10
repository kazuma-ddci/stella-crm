"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef, CustomAction } from "@/components/crud-table";
import { addLineFriend, updateLineFriend, deleteLineFriend, triggerProLineSync, openRichMenu } from "./actions";
import { Button } from "@/components/ui/button";
import { RefreshCw, Menu } from "lucide-react";
import { toast } from "sonner";

type Props = {
  data: Record<string, unknown>[];
  lastSyncAt: string | null;
};

const activeStatusOptions = [
  { value: "稼働中", label: "稼働中" },
  { value: "ブロック", label: "ブロック" },
];

export function LineFriendsTable({ data, lastSyncAt }: Props) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);

  const columns: ColumnDef[] = [
    { key: "displayNo", header: "番号", editable: false },
    { key: "snsname", header: "LINE名", type: "text", filterable: true },
    { key: "password", header: "パスワード", type: "text" },
    { key: "emailLine", header: "LINE送信専用メルアド", type: "text" },
    { key: "emailRenkei", header: "連携用メールアドレス", type: "text" },
    { key: "emailLine2", header: "LINE送信専用メルアド２", type: "text" },
    { key: "email", header: "メールアドレス", type: "text", filterable: true },
    { key: "uid", header: "ユーザーID", type: "text", required: true, editableOnCreate: true, filterable: true },
    { key: "friendAddedDate", header: "友だち追加日", type: "datetime" },
    { key: "activeStatus", header: "稼働状態", type: "select", options: activeStatusOptions, filterable: true },
    { key: "lastActivityDate", header: "最終活動日", type: "text", editable: false },
    { key: "sei", header: "姓", type: "text", filterable: true },
    { key: "mei", header: "名", type: "text", filterable: true },
    { key: "nickname", header: "ニックネーム", type: "text" },
    { key: "phone", header: "電話番号", type: "text" },
    { key: "postcode", header: "郵便番号", type: "text" },
    { key: "address1", header: "住所１", type: "text" },
    { key: "address2", header: "住所２", type: "text" },
    { key: "address3", header: "住所３", type: "text" },
    { key: "nenrei", header: "年齢", type: "text" },
    { key: "nendai", header: "年代", type: "text" },
    { key: "seibetu", header: "性別", type: "text" },
    { key: "free1", header: "フリー項目１", type: "text" },
    { key: "free2", header: "フリー項目２", type: "text" },
    { key: "free3", header: "フリー項目３", type: "text" },
    { key: "free4", header: "フリー項目４", type: "text" },
    { key: "free5", header: "フリー項目５", type: "text" },
    { key: "free6", header: "フリー項目６", type: "text" },
    { key: "scenarioPos1", header: "シナリオ位置1", type: "text" },
    { key: "scenarioPos2", header: "現在の場所2", type: "text" },
    { key: "scenarioPos3", header: "現在の場所3", type: "text" },
    { key: "scenarioPos4", header: "現在の場所4", type: "text" },
    { key: "scenarioPos5", header: "現在の場所5", type: "text" },
  ];

  const handleAdd = async (formData: Record<string, unknown>) => {
    await addLineFriend(formData);
    router.refresh();
  };

  const handleUpdate = async (id: number, formData: Record<string, unknown>) => {
    await updateLineFriend(id, formData);
    router.refresh();
  };

  const handleDelete = async (id: number) => {
    await deleteLineFriend(id);
    router.refresh();
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await triggerProLineSync();
      if (result.success) {
        toast.success(
          `プロライン同期完了: 新規${result.created}件、更新${result.updated}件（合計${result.total}件）`
        );
        router.refresh();
      } else {
        toast.error(`同期に失敗しました: ${result.error}`);
      }
    } catch {
      toast.error("同期リクエストに失敗しました");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenRichMenu = async (item: Record<string, unknown>) => {
    const id = item.id as number;
    const name = (item.snsname as string | null) ?? "(名前なし)";
    if (!confirm(`${name} さんにリッチメニューを開放しますか？`)) return;
    try {
      const result = await openRichMenu(id);
      if (result.success) {
        toast.success(`${name} さんのリッチメニューを開放しました`);
      } else {
        toast.error(`リッチメニュー開放に失敗しました`, {
          description: result.error,
          duration: 10000,
        });
      }
    } catch {
      toast.error("リッチメニュー開放リクエストに失敗しました");
    }
  };

  const customActions: CustomAction[] = [
    {
      icon: <Menu className="h-4 w-4" />,
      label: "リッチメニューを開放する",
      onClick: handleOpenRichMenu,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {lastSyncAt && (
            <span>
              最終同期: {new Date(lastSyncAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "同期中..." : "プロライン同期"}
        </Button>
      </div>
      <CrudTable
        data={data}
        columns={columns}
        title="LINE友達"
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        customActions={customActions}
        emptyMessage="LINE友達情報が登録されていません"
      />
    </div>
  );
}
