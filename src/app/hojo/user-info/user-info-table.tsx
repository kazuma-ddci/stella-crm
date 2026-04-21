"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef } from "@/components/crud-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { updateCustomerUserType } from "./actions";

import {
  addLineFriend as addSC,
  updateLineFriend as updateSC,
  deleteLineFriend as deleteSC,
  triggerProLineSync as syncSC,
} from "@/app/hojo/line-friends/security-cloud/actions";
import {
  addLineFriend as addAlkes,
  updateLineFriend as updateAlkes,
  deleteLineFriend as deleteAlkes,
  triggerProLineSync as syncAlkes,
} from "@/app/hojo/line-friends/alkes/actions";
import {
  addLineFriend as addShinsei,
  updateLineFriend as updateShinsei,
  deleteLineFriend as deleteShinsei,
  triggerProLineSync as syncShinsei,
} from "@/app/hojo/line-friends/shinsei-support/actions";

type Props = {
  customerData: Record<string, unknown>[];
  securityCloudData: Record<string, unknown>[];
  securityCloudLastSync: string | null;
  securityCloudLabel: string;
  alkesData: Record<string, unknown>[];
  alkesLastSync: string | null;
  alkesInvalidIds: number[];
  alkesDuplicateIds: number[];
  alkesLabel: string;
  shinseiData: Record<string, unknown>[];
  shinseiLastSync: string | null;
  shinseiInvalidIds: number[];
  shinseiDuplicateIds: number[];
  shinseiLabel: string;
};

// --- 顧客情報タブ用 ---

type CustomerRow = {
  id: number;
  snsname: string | null;
  uid: string;
  userType: string;
  isVendor: boolean;
  hasShinseiSupport: boolean;
  hasAlkes: boolean;
};

const USER_TYPE_OPTIONS = [
  { value: "顧客", label: "顧客" },
  { value: "AS", label: "AS" },
  { value: "スタッフ", label: "スタッフ" },
  { value: "その他", label: "その他" },
];

function getCustomerColumns(shinseiLabel: string, alkesLabel: string): ColumnDef[] {
  return [
    { key: "id", header: "顧客番号", editable: false, width: 1, cellClassName: "text-center" },
    { key: "snsname", header: "LINE名", type: "text", editable: false, filterable: true },
    { key: "uid", header: "UID", type: "text", editable: false, filterable: true },
    { key: "userType", header: "ユーザー種別", editable: false, filterable: true },
    { key: "hasShinseiSupport", header: shinseiLabel, editable: false, filterable: true },
    { key: "hasAlkes", header: alkesLabel, editable: false, filterable: true },
    { key: "referrer", header: "紹介者", editable: false, filterable: true },
  ];
}

const checkRenderer = (value: unknown) =>
  value ? (
    <Check className="h-4 w-4 text-green-600 mx-auto" />
  ) : (
    <span className="text-gray-400 block text-center">-</span>
  );

// --- LINE友達タブ用（共通カラム定義） ---

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

// --- LINE友達テーブルサブコンポーネント ---

function LineFriendTab({
  data,
  lastSyncAt,
  invalidIds = [],
  duplicateIds = [],
  onAdd,
  onUpdate,
  onDelete,
  onSync,
  tableId,
}: {
  data: Record<string, unknown>[];
  lastSyncAt: string | null;
  invalidIds?: number[];
  duplicateIds?: number[];
  onAdd: (formData: Record<string, unknown>) => Promise<import("@/lib/action-result").ActionResult | void>;
  onUpdate: (id: number, formData: Record<string, unknown>) => Promise<import("@/lib/action-result").ActionResult | void>;
  onDelete: (id: number) => Promise<import("@/lib/action-result").ActionResult | void>;
  onSync: () => Promise<{ success: boolean; created?: number; updated?: number; total?: number; error?: string }>;
  tableId: string;
}) {
  const invalidIdSet = new Set(invalidIds);
  const duplicateIdSet = new Set(duplicateIds);
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleAdd = async (formData: Record<string, unknown>) => {
    const result = await onAdd(formData);
    if (result && "ok" in result && !result.ok) return result;
    router.refresh();
    return result;
  };

  const handleUpdate = async (id: number, formData: Record<string, unknown>) => {
    const result = await onUpdate(id, formData);
    if (result && "ok" in result && !result.ok) return result;
    router.refresh();
    return result;
  };

  const handleDelete = async (id: number) => {
    const result = await onDelete(id);
    if (result && "ok" in result && !result.ok) return result;
    router.refresh();
    return result;
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await onSync();
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
    <div>
      {invalidIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">
            フリー項目１のデータがセキュリティクラウドのUIDに存在しないユーザーが
            <strong>{invalidIds.length}件</strong>あります（赤色の行）。データを確認してください。
          </p>
        </div>
      )}
      {duplicateIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">
            フリー項目１に重複データが<strong>{duplicateIds.length}件</strong>あります（赤枠の行）。
            同じフリー項目１の値を持つレコードが複数存在します。
          </p>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {lastSyncAt && (
            <span>
              最終同期: {new Date(lastSyncAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "同期中..." : "プロライン同期"}
        </Button>
      </div>
      <CrudTable
        tableId={tableId}
        data={data}
        columns={lineFriendColumns}
        title="LINE友達"
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        emptyMessage="LINE友達情報が登録されていません"
        rowClassName={(item) => {
          const id = item.id as number;
          if (invalidIdSet.has(id)) return "!bg-red-100 hover:!bg-red-200";
          if (duplicateIdSet.has(id)) return "!bg-red-50 hover:!bg-red-100 !border-l-4 !border-l-red-500";
          return undefined;
        }}
        customRenderers={{
          free1: (value, row) => {
            const id = row.id as number;
            const isInvalid = invalidIdSet.has(id);
            const isDuplicate = duplicateIdSet.has(id);
            if (isInvalid) {
              return (
                <span className="inline-block bg-red-300 text-red-900 px-2 py-0.5 rounded font-bold">
                  {String(value ?? "")}
                </span>
              );
            }
            if (isDuplicate) {
              return (
                <span className="inline-block bg-red-200 text-red-800 px-2 py-0.5 rounded font-bold" title="重複データ">
                  {String(value ?? "")}
                </span>
              );
            }
            return <span>{String(value ?? "")}</span>;
          },
        }}
      />
    </div>
  );
}

// --- メインコンポーネント ---

export function CustomerPageClient({
  customerData,
  securityCloudData,
  securityCloudLastSync,
  securityCloudLabel,
  alkesData,
  alkesLastSync,
  alkesInvalidIds,
  alkesDuplicateIds,
  alkesLabel,
  shinseiData,
  shinseiLastSync,
  shinseiInvalidIds,
  shinseiDuplicateIds,
  shinseiLabel,
}: Props) {
  const router = useRouter();

  const handleUserTypeChange = async (id: number, newType: string) => {
    const result = await updateCustomerUserType(id, newType);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <Tabs defaultValue="customer">
      <TabsList>
        <TabsTrigger value="customer">顧客情報</TabsTrigger>
        <TabsTrigger value="security-cloud">{securityCloudLabel}</TabsTrigger>
        <TabsTrigger value="alkes">{alkesLabel}</TabsTrigger>
        <TabsTrigger value="shinsei">{shinseiLabel}</TabsTrigger>
      </TabsList>

      <TabsContent value="customer">
        <CrudTable
          tableId="hojo.user-info.customer"
          data={customerData}
          columns={getCustomerColumns(shinseiLabel, alkesLabel)}
          title="顧客情報"
          customRenderers={{
            userType: (value, row) => {
              const r = row as unknown as CustomerRow;
              if (r.isVendor) {
                return (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    {String(value)}
                  </span>
                );
              }
              return (
                <select
                  value={String(value)}
                  onChange={(e) => handleUserTypeChange(r.id, e.target.value)}
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
            hasShinseiSupport: checkRenderer,
            hasAlkes: checkRenderer,
          }}
        />
      </TabsContent>

      <TabsContent value="security-cloud">
        <LineFriendTab
          data={securityCloudData}
          lastSyncAt={securityCloudLastSync}
          onAdd={addSC}
          onUpdate={updateSC}
          onDelete={deleteSC}
          onSync={syncSC}
          tableId="hojo.user-info.security-cloud"
        />
      </TabsContent>

      <TabsContent value="alkes">
        <LineFriendTab
          data={alkesData}
          lastSyncAt={alkesLastSync}
          invalidIds={alkesInvalidIds}
          duplicateIds={alkesDuplicateIds}
          onAdd={addAlkes}
          onUpdate={updateAlkes}
          onDelete={deleteAlkes}
          onSync={syncAlkes}
          tableId="hojo.user-info.alkes"
        />
      </TabsContent>

      <TabsContent value="shinsei">
        <LineFriendTab
          data={shinseiData}
          lastSyncAt={shinseiLastSync}
          invalidIds={shinseiInvalidIds}
          duplicateIds={shinseiDuplicateIds}
          onAdd={addShinsei}
          onUpdate={updateShinsei}
          onDelete={deleteShinsei}
          onSync={syncShinsei}
          tableId="hojo.user-info.shinsei"
        />
      </TabsContent>
    </Tabs>
  );
}
