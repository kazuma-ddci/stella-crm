"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef } from "@/components/crud-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { updateUserType } from "./actions";
import {
  addLineFriend,
  updateLineFriend,
  deleteLineFriend,
  triggerProLineSync,
} from "@/app/hojo/line-friends/josei-support/actions";

// --- 型定義 ---

type ApplicantRow = {
  id: number;
  snsname: string | null;
  uid: string;
  userType: string;
  isVendor: boolean;
  vendorName: string | null;
  hasError: boolean;
};

type Props = {
  applicantData: ApplicantRow[];
  joseiData: Record<string, unknown>[];
  joseiLastSync: string | null;
  joseiInvalidIds: number[];
  joseiLabel: string;
};

// --- 申請者情報タブ用 ---

const USER_TYPE_OPTIONS = [
  { value: "顧客", label: "顧客" },
  { value: "AS", label: "AS" },
  { value: "スタッフ", label: "スタッフ" },
  { value: "その他", label: "その他" },
];

const applicantColumns: ColumnDef[] = [
  { key: "id", header: "申請者番号", editable: false, width: 1, cellClassName: "text-center" },
  { key: "snsname", header: "LINE名", type: "text", editable: false, filterable: true },
  { key: "uid", header: "UID", type: "text", editable: false, filterable: true },
  { key: "userType", header: "ユーザー種別", editable: false, filterable: true },
  { key: "vendorName", header: "ベンダー", editable: false, filterable: true },
];

// --- 助成金申請サポートタブ用 ---

const activeStatusOptions = [
  { value: "稼働中", label: "稼働中" },
  { value: "ブロック", label: "ブロック" },
];

const lineFriendColumns: ColumnDef[] = [
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

// --- メインコンポーネント ---

export function ApplicantPageClient({
  applicantData,
  joseiData,
  joseiLastSync,
  joseiInvalidIds,
  joseiLabel,
}: Props) {
  const joseiInvalidIdSet = new Set(joseiInvalidIds);
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleUserTypeChange = async (id: number, newType: string, isVendor: boolean) => {
    if (isVendor) {
      toast.error("このユーザーはベンダーとして登録されているため、ユーザー種別を変更できません");
      return;
    }
    try {
      await updateUserType(id, newType);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    }
  };

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

  return (
    <Tabs defaultValue="applicant">
      <TabsList>
        <TabsTrigger value="applicant">申請者情報</TabsTrigger>
        <TabsTrigger value="josei">{joseiLabel}</TabsTrigger>
      </TabsList>

      <TabsContent value="applicant">
        <CrudTable
          data={applicantData as unknown as Record<string, unknown>[]}
          columns={applicantColumns}
          title="申請者情報"
          rowClassName={(row) => {
            const r = row as unknown as ApplicantRow;
            return r.hasError ? "!bg-red-50" : undefined;
          }}
          customRenderers={{
            userType: (value, row) => {
              const r = row as unknown as ApplicantRow;
              if (r.isVendor) {
                return (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    ベンダー
                  </span>
                );
              }
              return (
                <select
                  value={String(value)}
                  onChange={(e) => handleUserTypeChange(r.id, e.target.value, r.isVendor)}
                  className="border rounded px-2 py-1 text-sm bg-white"
                >
                  {USER_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              );
            },
            vendorName: (value) =>
              value ? (
                <span className="text-sm">{String(value)}</span>
              ) : (
                <span className="text-gray-400">-</span>
              ),
          }}
        />
      </TabsContent>

      <TabsContent value="josei">
        <div>
          {joseiInvalidIds.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-sm text-red-700">
                フリー項目１のデータがベンダーに紐づいていないユーザーが
                <strong>{joseiInvalidIds.length}件</strong>あります（赤色の行）。データを確認してください。
              </p>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {joseiLastSync && (
                <span>
                  最終同期: {new Date(joseiLastSync).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "同期中..." : "プロライン同期"}
            </Button>
          </div>
          <CrudTable
            data={joseiData}
            columns={lineFriendColumns}
            title="LINE友達"
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            emptyMessage="LINE友達情報が登録されていません"
            rowClassName={(item) =>
              joseiInvalidIdSet.has(item.id as number) ? "!bg-red-100 hover:!bg-red-200" : undefined
            }
            customRenderers={{
              free1: (value, row) => {
                const isInvalid = joseiInvalidIdSet.has(row.id as number);
                if (isInvalid) {
                  return (
                    <span className="inline-block bg-red-300 text-red-900 px-2 py-0.5 rounded font-bold">
                      {String(value ?? "")}
                    </span>
                  );
                }
                return <span>{String(value ?? "")}</span>;
              },
            }}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
