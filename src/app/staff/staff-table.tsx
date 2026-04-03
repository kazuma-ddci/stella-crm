"use client";

import { useState } from "react";
import { CrudTable, ColumnDef, CustomRenderers, CustomFormFields } from "@/components/crud-table";
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
  selfEditableProjects: { code: string; maxLevel: string }[];
  canEditOrganizationRole: boolean;
  canSetFounder: boolean;
  canEditRoleTypes: boolean;
  canManageStaff: boolean;
  canViewOtherPermissions: boolean;
  currentUserId: number;
  currentUserPermissionCodes: string[];
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

const PERM_LEVEL_ORDER: Record<string, number> = { none: 0, view: 1, edit: 2, manager: 3 };

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
  const max = PERM_LEVEL_ORDER[maxLevel] ?? 0;
  return PERMISSION_LEVELS.filter((l) => (PERM_LEVEL_ORDER[l.value] ?? 0) <= max);
}

/** 権限レベルのラベルを取得 */
function getPermissionLabel(value: unknown): string {
  const level = PERMISSION_LEVELS.find((l) => l.value === value);
  return level?.label ?? String(value ?? "なし");
}

export function StaffTable({ data, projectOptions, permissionProjects, editableProjects, selfEditableProjects, canEditOrganizationRole, canSetFounder, canEditRoleTypes, canManageStaff, canViewOtherPermissions, currentUserId, currentUserPermissionCodes, dynamicOptions }: Props) {
  // 編集可能なプロジェクトのマップ（他人編集用）
  const editableMap = new Map(editableProjects.map((p) => [p.code, p.maxLevel]));
  // 自分自身編集用のマップ（managerプロジェクトはmaxLevel="manager"）
  const selfEditableMap = new Map(selfEditableProjects.map((p) => [p.code, p.maxLevel]));

  // 表示する権限カラムのフィルタ:
  // - admin/founder: 誰かしらに「なし」以外の権限があるプロジェクト
  // - マネージャー以下: 自分が権限を持つプロジェクト + 編集可能プロジェクト
  const currentUserPermSet = new Set(currentUserPermissionCodes);
  const activePermissionProjects = permissionProjects.filter((p) => {
    if (canSetFounder) {
      // admin/founder: データに権限が存在するプロジェクトのみ
      return data.some((row) => {
        const val = row[`perm_${p.code}`];
        return val && val !== "none";
      });
    }
    // マネージャー以下: 自分が権限を持つプロジェクト or 編集可能プロジェクト
    return currentUserPermSet.has(p.code) || selfEditableMap.has(p.code);
  });

  const permissionColumns: ColumnDef[] = activePermissionProjects.flatMap((p) => {
    const isEditable = editableMap.has(p.code);
    return [
      {
        key: `perm_${p.code}`,
        header: `${p.name}権限`,
        type: "select" as const,
        options: isEditable
          ? getPermissionLevelsForMaxLevel(editableMap.get(p.code)!)
          : PERMISSION_LEVELS,
        editable: isEditable,
        simpleMode: true,
        hiddenWhen: { field: "organizationRole", value: "founder" },
      },
      // approve_xxx はデータ保持用の非表示カラム（perm_xxx のカスタムフォームから制御）
      {
        key: `approve_${p.code}`,
        header: `${p.name}承認`,
        type: "boolean" as const,
        hidden: true,
        editable: false,
        defaultValue: false,
        simpleMode: true,
      },
    ];
  });

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

  // 権限カラムの表示カスタマイズ
  const permRenderers: CustomRenderers = {};
  for (const project of activePermissionProjects) {
    const permKey = `perm_${project.code}`;
    const approveKey = `approve_${project.code}`;
    permRenderers[permKey] = (_value, row) => {
      // ファウンダー表示
      if (row.organizationRole === "founder") {
        return (
          <span className="text-xs text-muted-foreground">(全権限)</span>
        );
      }

      const isSelf = row.id === currentUserId;

      // 他人の権限で、閲覧権限がない場合は***
      if (!isSelf && !canViewOtherPermissions) {
        return <span className="text-muted-foreground">***</span>;
      }

      const hasApprove = row[approveKey] === true;
      return (
        <div>
          <span>{getPermissionLabel(_value)}</span>
          {hasApprove && (
            <div className="text-xs text-blue-600 font-medium">承認権限あり</div>
          )}
        </div>
      );
    };
  }

  // perm_xxx のカスタムフォームフィールド（セレクト + 承認チェックボックス + ダウングレード確認）
  const permFormFields: CustomFormFields = {};
  for (const project of permissionProjects) {
    const permKey = `perm_${project.code}`;
    const approveKey = `approve_${project.code}`;

    permFormFields[permKey] = {
      render: (_value, onChange, formData, setFormData) => {
        const permValue = (formData[permKey] as string) ?? "none";
        const approveValue = formData[approveKey] === true || formData[approveKey] === "true";
        const hasPermission = permValue !== "none";
        const editingStaffId = formData.id as number | undefined;
        const isSelfEdit = editingStaffId === currentUserId;

        // 自分自身か他人かで使うマップを切り替え
        const effectiveMap = isSelfEdit ? selfEditableMap : editableMap;
        const isEditable = effectiveMap.has(project.code);
        const maxLevel = effectiveMap.get(project.code) ?? "none";

        // 編集不可の場合: グレーアウト表示
        if (!isEditable) {
          return (
            <div className="space-y-2">
              <select
                value={permValue}
                disabled
                className="w-full h-10 rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed"
              >
                {PERMISSION_LEVELS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {hasPermission && approveValue && (
                <div className="text-xs text-blue-600 font-medium">承認権限あり</div>
              )}
            </div>
          );
        }

        // 自分自身の編集: 自分の現在の権限レベルまでのオプションを表示
        // 他人の編集: maxLevel までのオプション（+ DB値が超えていたらグレーアウト）
        let options: { value: string; label: string }[];
        let isDisabledBecauseAboveMax = false;

        if (isSelfEdit) {
          // 自分自身: 現在の権限レベルまでの全オプション
          options = getPermissionLevelsForMaxLevel(maxLevel);
        } else {
          // 他人: maxLevelまでのオプション
          const currentLevel = PERM_LEVEL_ORDER[permValue] ?? 0;
          const maxLevelOrder = PERM_LEVEL_ORDER[maxLevel] ?? 0;

          if (currentLevel > maxLevelOrder) {
            // DB値がmaxLevelを超えている場合（例: 他人のmanager権限をedit権限のマネージャーが見ている）
            isDisabledBecauseAboveMax = true;
            options = PERMISSION_LEVELS;
          } else {
            options = getPermissionLevelsForMaxLevel(maxLevel);
          }
        }

        const handlePermChange = (newValue: string) => {
          const oldLevel = PERM_LEVEL_ORDER[permValue] ?? 0;
          const newLevel = PERM_LEVEL_ORDER[newValue] ?? 0;

          // 自分自身のダウングレード確認
          if (isSelfEdit && newLevel < oldLevel && oldLevel >= PERM_LEVEL_ORDER["manager"]) {
            const confirmed = window.confirm(
              `${project.name}のマネージャー権限を失うと、スタッフの追加・権限管理ができなくなりますがよろしいですか？`
            );
            if (!confirmed) return;
          }

          onChange(newValue);
          // 権限がnoneになったら承認も外す
          if (newValue === "none") {
            setFormData({ ...formData, [permKey]: newValue, [approveKey]: false });
          }
        };

        return (
          <div className="space-y-2">
            <select
              value={permValue}
              disabled={isDisabledBecauseAboveMax}
              onChange={(e) => handlePermChange(e.target.value)}
              className={`w-full h-10 rounded-md border border-input px-3 text-sm ${
                isDisabledBecauseAboveMax
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-background"
              }`}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {hasPermission && canSetFounder && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={approveValue}
                  disabled={isDisabledBecauseAboveMax}
                  onChange={(e) => setFormData({ ...formData, [approveKey]: e.target.checked })}
                  className="rounded"
                />
                承認権限
              </label>
            )}
          </div>
        );
      },
    };
  }

  const customRenderers: CustomRenderers = {
    ...permRenderers,
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
      customFormFields={permFormFields}
      emptyMessage="スタッフが登録されていません"
      sortableItems={sortableItems}
      onReorder={reorderStaff}
      dynamicOptions={dynamicOptions}
    />
  );
}
