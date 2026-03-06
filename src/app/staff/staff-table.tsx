"use client";

import { useState } from "react";
import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import { Button } from "@/components/ui/button";
import { addStaff, updateStaff, deleteStaff, sendStaffInvite, reorderStaff } from "./actions";
import { Mail, Check, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  data: Record<string, unknown>[];
  roleTypeOptions: { value: string; label: string }[];
  projectOptions: { value: string; label: string }[];
  permissionProjects: { code: string; name: string }[];
  editableProjects: { code: string; maxLevel: string }[];
  canEditOrganizationRole: boolean;
  canSetFounder: boolean;
  canEditRoleTypes: boolean;
  canManageStaff: boolean;
  dynamicOptions?: Record<string, Record<string, { value: string; label: string }[]>>;
};

const CONTRACT_TYPES = [
  { value: "役員", label: "役員" },
  { value: "正社員", label: "正社員" },
  { value: "契約社員", label: "契約社員" },
  { value: "業務委託", label: "業務委託" },
  { value: "パート", label: "パート" },
  { value: "アルバイト", label: "アルバイト" },
];

const PERMISSION_LEVELS = [
  { value: "none", label: "なし" },
  { value: "view", label: "閲覧" },
  { value: "edit", label: "編集" },
  { value: "manager", label: "マネージャー" },
];

const ORGANIZATION_ROLES = [
  { value: "member", label: "メンバー" },
  { value: "founder", label: "ファウンダー" },
];

function InviteButton({ row }: { row: Record<string, unknown> }) {
  const [loading, setLoading] = useState(false);

  const hasEmail = !!row.email;
  const hasPassword = row.hasPassword as boolean;
  const hasInviteToken = row.hasInviteToken as boolean;
  const inviteTokenExpired = row.inviteTokenExpired as boolean;

  // パスワード設定済み → 招待不要
  if (hasPassword) {
    return (
      <span className="flex items-center gap-1 text-sm text-green-600">
        <Check className="h-4 w-4" />
        設定済み
      </span>
    );
  }

  // メールアドレスがない → 招待不可
  if (!hasEmail) {
    return (
      <span className="text-sm text-muted-foreground">
        メール未設定
      </span>
    );
  }

  const handleInvite = async () => {
    setLoading(true);
    try {
      const result = await sendStaffInvite(row.id as number);
      if (result.success) {
        toast.success("招待メールを送信しました");
      } else {
        toast.error(result.error || "招待メールの送信に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 招待済み（トークンあり）
  if (hasInviteToken && !inviteTokenExpired) {
    return (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1 text-sm text-amber-600">
          <Clock className="h-4 w-4" />
          招待中
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleInvite}
          disabled={loading}
          className="h-6 px-2 text-xs"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "再送信"}
        </Button>
      </div>
    );
  }

  // 招待可能（トークンなし or 期限切れ）
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleInvite}
      disabled={loading}
      className="h-8"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Mail className="h-4 w-4 mr-1" />
          招待送信
        </>
      )}
    </Button>
  );
}

/** 天井レベルに基づいて選択可能な権限レベルを返す */
function getPermissionLevelsForMaxLevel(maxLevel: string): { value: string; label: string }[] {
  const levelOrder: Record<string, number> = { none: 0, view: 1, edit: 2, manager: 3 };
  const max = levelOrder[maxLevel] ?? 0;
  return PERMISSION_LEVELS.filter((l) => (levelOrder[l.value] ?? 0) <= max);
}

export function StaffTable({ data, roleTypeOptions, projectOptions, permissionProjects, editableProjects, canEditOrganizationRole, canSetFounder, canEditRoleTypes, canManageStaff, dynamicOptions }: Props) {
  // 権限カラム（編集可能なプロジェクトがある場合のみ表示）
  const editableMap = new Map(editableProjects.map((p) => [p.code, p.maxLevel]));
  const permissionColumns: ColumnDef[] = editableProjects.length > 0
    ? [
        // 各プロジェクト権限（天井に基づく選択肢制限、ファウンダー時は非表示）
        ...permissionProjects
          .filter((p) => editableMap.has(p.code))
          .map((p) => ({
            key: `perm_${p.code}`,
            header: `${p.name}権限`,
            type: "select" as const,
            options: getPermissionLevelsForMaxLevel(editableMap.get(p.code)!),
            simpleMode: true,
            hiddenWhen: { field: "organizationRole", value: "founder" },
          })),
      ]
    : [];

  // 権限カラムのキー一覧（customRenderers用）
  const permissionColumnKeys = permissionProjects
    .filter((p) => editableMap.has(p.code))
    .map((p) => `perm_${p.code}`);

  // 組織ロールカラム（admin/founderのみ編集可能）
  const organizationRoleColumn: ColumnDef[] = canEditOrganizationRole
    ? [{
        key: "organizationRole",
        header: "組織ロール",
        type: "select" as const,
        options: canSetFounder ? ORGANIZATION_ROLES : ORGANIZATION_ROLES.filter((r) => r.value !== "founder"),
        simpleMode: true,
      }]
    : [{
        key: "organizationRoleLabel",
        header: "組織ロール",
        editable: false,
      }];

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "name", header: "名前", type: "text", required: true, simpleMode: true },
    { key: "nameKana", header: "フリガナ", type: "text" },
    { key: "email", header: "メールアドレス", type: "text", simpleMode: true },
    { key: "phone", header: "電話番号", type: "text" },
    { key: "contractType", header: "契約形態", type: "select", options: CONTRACT_TYPES },
    // プロジェクト（複数選択）
    { key: "projectIds", header: "プロジェクト（選択）", type: "multiselect", options: projectOptions, simpleMode: true, hidden: true },
    { key: "projectNames", header: "プロジェクト", editable: false, filterable: true },
    // 役割（複数選択）— edit以上で編集可能
    ...(canEditRoleTypes
      ? [
          { key: "roleTypeIds", header: "役割（選択）", type: "multiselect" as const, dynamicOptionsKey: "roleTypesByProject", dependsOn: "projectIds", simpleMode: true, hidden: true },
          { key: "roleTypeNames", header: "役割", editable: false, filterable: true },
        ]
      : [
          { key: "roleTypeNames", header: "役割", editable: false, filterable: true },
        ]),
    // 組織ロール
    ...organizationRoleColumn,
    // 権限
    ...permissionColumns,
    { key: "isActive", header: "有効", type: "boolean" as const, ...(canManageStaff ? {} : { editable: false }) },
    // 招待状態
    { key: "inviteStatus", header: "アカウント", editable: false },
  ];

  // ファウンダーの行では権限カラムに「ファウンダー（全権限）」を表示
  const founderPermRenderers: CustomRenderers = {};
  for (const key of permissionColumnKeys) {
    founderPermRenderers[key] = (_value, row) => {
      if (row.organizationRole === "founder") {
        return (
          <span className="text-xs text-muted-foreground">(全権限)</span>
        );
      }
      const level = PERMISSION_LEVELS.find((l) => l.value === _value);
      return <span>{level?.label ?? String(_value ?? "なし")}</span>;
    };
  }

  const customRenderers: CustomRenderers = {
    ...founderPermRenderers,
    inviteStatus: (_value, row) => <InviteButton row={row} />,
  };

  const sortableItems: SortableItem[] = data.map((item) => ({
    id: item.id as number,
    label: item.name as string,
    subLabel: item.contractType as string | undefined,
  }));

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="スタッフ"
      onAdd={canManageStaff ? addStaff : undefined}
      onUpdate={updateStaff}
      onDelete={canManageStaff ? deleteStaff : undefined}
      customRenderers={customRenderers}
      emptyMessage="スタッフが登録されていません"
      sortableItems={sortableItems}
      onReorder={reorderStaff}
      dynamicOptions={dynamicOptions}
    />
  );
}
