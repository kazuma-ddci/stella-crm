"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ChevronsUpDown, Check, AlertCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { MultiFileUpload, FileDisplay, type FileInfo } from "@/components/multi-file-upload";
import { useTimedFormCache } from "@/hooks/use-timed-form-cache";

registerLocale("ja", ja);

export type CustomerType = {
  id: number;
  name: string;
  projectId: number;
  displayOrder: number;
  project: {
    id: number;
    name: string;
    displayOrder: number;
  };
};

export type ContactHistory = {
  id: number;
  contactDate: string;
  contactMethodId: number | null;
  contactMethodName: string | null;
  contactCategoryId: number | null;
  contactCategoryName: string | null;
  assignedTo: string | null;
  assignedToNames: string | null;
  customerParticipants: string | null;
  meetingMinutes: string | null;
  note: string | null;
  customerTypeIds?: number[];
  files?: FileInfo[];
  sessionId?: number | null;
  // Zoom情報（SLP用、その他プロジェクトは undefined）
  zoomRecordingCount?: number;
  hasScheduledZoom?: boolean;
  hasFailedZoom?: boolean;
};

export type ContactCategoryOption = {
  id: number;
  name: string;
  projectId: number;
  project: {
    id: number;
    name: string;
    displayOrder: number;
  };
};

export type ContactHistoryModalConfig = {
  entityId: number;
  entityName: string;
  requiredCustomerTypeId: number;
  requiredCustomerTypeName: string;
  cacheKeyPrefix: string;
  warningLink: { href: string; label: string };
  popoverWidth?: string; // default "w-[400px]"
  actions: {
    add: (entityId: number, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
    update: (historyId: number, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
    delete: (historyId: number) => Promise<void>;
  };
};

export type BaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderInline?: boolean;
  config: ContactHistoryModalConfig;
  contactHistories: Record<string, unknown>[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  contactCategories: ContactCategoryOption[];
  // 任意: SLP事業者詳細で「打ち合わせに紐付ける」UIを出したい場合に渡す
  sessionSelect?: {
    options: { value: string; label: string }[]; // 各打ち合わせを表す選択肢
    label?: string; // デフォルト「打ち合わせに紐付け（任意）」
    hint?: string; // フォーム下部に出す補足
  };
  /**
   * 編集モード時に「Zoom情報」セクションを任意でレンダリングするためのフック。
   * SLPで手動Zoom議事録連携を接触履歴に紐付けるUIを差し込むために使用。
   * - 引数: 編集対象の接触履歴ID（必ず既存レコード）
   */
  renderZoomSection?: (contactHistoryId: number) => React.ReactNode;
  /**
   * 閲覧モード時に「Zoom情報」セクションを任意でレンダリングするためのフック。
   * SLPで読み取り専用のZoom情報一覧＋詳細ボタンを表示するために使用。
   */
  renderZoomSectionForView?: (contactHistoryId: number) => React.ReactNode;
  /**
   * true の場合、接触履歴を新規追加した直後に編集モードに自動遷移する。
   * SLP では追加後にそのまま「Zoom議事録連携を追加」できるようにするために有効化。
   * 他プロジェクト（STP/HOJO等）は false（既存挙動：一覧に戻る）。
   */
  autoEnterEditAfterAdd?: boolean;
  /**
   * 追加フォームの下に差し込む任意セクション（SLPの Zoom議事録連携エントリ等）
   */
  renderAddExtraSection?: () => React.ReactNode;
  /**
   * 接触履歴を新規追加した直後に呼ばれるフック。
   * SLP ではここで Zoom エントリを addManualZoomToContactHistory に流し込む。
   * `ctx.toastId` を渡すので、追加処理全体で単一のトーストを使って
   * ローディング→完了の状態遷移を表現できる。呼び出し側が最終的に
   * `toast.success/error({ id: toastId })` でトーストを確定する責務を持つ。
   */
  onAfterAdd?: (
    created: ContactHistory,
    ctx: { toastId: string | number }
  ) => Promise<void> | void;
  /**
   * 親側で保持している追加セクションの未保存状態。true の場合、formData が
   * 変更されていなくてもダーティ扱いにする（例: SLP の Zoom URL 入力）。
   */
  extraIsDirty?: boolean;
  /**
   * ユーザーが未保存変更を「破棄して閉じる」で確定した時に呼ばれるフック。
   * 親側で保持している状態（Zoom エントリ等）をクリアするために使用。
   */
  onDiscard?: () => void;
};

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactHistoryModalBase({
  open,
  onOpenChange,
  renderInline,
  config,
  contactHistories: initialHistories,
  contactMethodOptions,
  staffOptions,
  customerTypes,
  staffByProject,
  contactCategories,
  sessionSelect,
  renderZoomSection,
  renderZoomSectionForView,
  autoEnterEditAfterAdd,
  renderAddExtraSection,
  onAfterAdd,
  extraIsDirty,
  onDiscard,
}: BaseProps) {
  const isActive = open || !!renderInline;
  const {
    entityId,
    entityName,
    requiredCustomerTypeId,
    requiredCustomerTypeName,
    cacheKeyPrefix,
    warningLink,
    popoverWidth = "w-[400px]",
    actions,
  } = config;

  const [histories, setHistories] = useState<ContactHistory[]>(
    initialHistories as unknown as ContactHistory[]
  );
  const [isAddMode, setIsAddMode] = useState(false);
  const [editHistory, setEditHistory] = useState<ContactHistory | null>(null);
  const [viewHistory, setViewHistory] = useState<ContactHistory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ContactHistory | null>(null);
  const [editConfirm, setEditConfirm] = useState(false);
  const [pendingEditData, setPendingEditData] = useState<Partial<ContactHistory> | null>(null);
  const [formData, setFormData] = useState<Partial<ContactHistory>>({});
  const [loading, setLoading] = useState(false);
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);
  const [requiredWarning, setRequiredWarning] = useState(false);
  // 破棄確認ダイアログ。pendingに「続行時の処理」を保持する
  const [discardConfirm, setDiscardConfirm] = useState<{ proceed: () => void } | null>(null);

  // フォーム開始時点のスナップショットを保持（ダーティ判定の基準）
  const initialSnapshotRef = useRef<string>("");

  const snapshotFormData = (data: Partial<ContactHistory>): string =>
    JSON.stringify({
      contactDate: data.contactDate ?? null,
      contactMethodId: data.contactMethodId ?? null,
      contactCategoryId: data.contactCategoryId ?? null,
      assignedTo: data.assignedTo ?? "",
      customerParticipants: data.customerParticipants ?? "",
      meetingMinutes: data.meetingMinutes ?? "",
      note: data.note ?? "",
      customerTypeIds: [...(data.customerTypeIds ?? [])].sort((a, b) => a - b),
      files: data.files ?? [],
      sessionId: data.sessionId ?? null,
    });

  // 別のエンティティが選択された場合に履歴データを更新
  useEffect(() => {
    setHistories(initialHistories as unknown as ContactHistory[]);
  }, [initialHistories]);

  type CachedState = {
    formData: Partial<ContactHistory>;
    isAddMode: boolean;
    editHistory: ContactHistory | null;
  };
  const { restore, save, clear: clearFormCache } = useTimedFormCache<CachedState>(
    `${cacheKeyPrefix}-${entityId}`
  );
  const formStateRef = useRef<CachedState>({
    formData: {},
    isAddMode: false,
    editHistory: null,
  });
  formStateRef.current = { formData, isAddMode, editHistory };

  // クローズ時にキャッシュ保存
  useEffect(() => {
    if (!isActive) return;
    return () => {
      save(formStateRef.current);
    };
  }, [isActive, save]);

  useEffect(() => {
    if (isActive) {
      const cached = restore();
      if (cached) {
        setFormData(cached.formData);
        setIsAddMode(cached.isAddMode);
        setEditHistory(cached.editHistory);
        // ダーティ判定の基準を復元元のモードに応じてセット
        if (cached.isAddMode) {
          initialSnapshotRef.current = snapshotFormData({
            customerTypeIds: [requiredCustomerTypeId],
            files: [],
          });
        } else if (cached.editHistory) {
          initialSnapshotRef.current = snapshotFormData({
            ...cached.editHistory,
            contactCategoryId: cached.editHistory.contactCategoryId || null,
            customerTypeIds:
              cached.editHistory.customerTypeIds || [requiredCustomerTypeId],
            files: cached.editHistory.files || [],
          });
        } else {
          initialSnapshotRef.current = "";
        }
      } else {
        setFormData({});
        setIsAddMode(false);
        setEditHistory(null);
        initialSnapshotRef.current = "";
      }
      // 一時的なUI状態は常にリセット
      setDeleteConfirm(null);
      setEditConfirm(false);
      setPendingEditData(null);
      setStaffPopoverOpen(false);
      setRequiredWarning(false);
      setDiscardConfirm(null);
    }
  }, [isActive, restore, requiredCustomerTypeId]);

  // スタッフIDからスタッフ名を取得するヘルパー
  const getStaffNames = (assignedTo: string | null): string => {
    if (!assignedTo) return "-";
    const ids = assignedTo.split(",").filter(Boolean);
    const names = ids.map((id) => {
      const staff = staffOptions.find((s) => s.value === id);
      return staff?.label || id;
    });
    return names.length > 0 ? names.join(", ") : "-";
  };

  const openAddForm = () => {
    const initial: Partial<ContactHistory> = {
      contactDate: undefined,
      contactMethodId: null,
      contactCategoryId: null,
      assignedTo: "",
      customerParticipants: "",
      meetingMinutes: "",
      note: "",
      customerTypeIds: [requiredCustomerTypeId],
      files: [],
    };
    setFormData(initial);
    initialSnapshotRef.current = snapshotFormData(initial);
    setRequiredWarning(false);
    setIsAddMode(true);
  };

  const openEditForm = (history: ContactHistory) => {
    const initial: Partial<ContactHistory> = {
      ...history,
      contactCategoryId: history.contactCategoryId || null,
      customerTypeIds: history.customerTypeIds || [requiredCustomerTypeId],
      files: history.files || [],
    };
    setFormData(initial);
    initialSnapshotRef.current = snapshotFormData(initial);
    setRequiredWarning(false);
    setEditHistory(history);
  };

  // 顧客種別のチェック状態を変更
  const handleCustomerTypeChange = (customerTypeId: number, checked: boolean) => {
    const currentIds = formData.customerTypeIds || [requiredCustomerTypeId];

    // 必須の顧客種別を外そうとした場合は警告を表示
    if (customerTypeId === requiredCustomerTypeId && !checked) {
      setRequiredWarning(true);
      return;
    }

    let newIds: number[];
    if (checked) {
      newIds = [...currentIds, customerTypeId];
    } else {
      newIds = currentIds.filter((id) => id !== customerTypeId);
    }
    setFormData({ ...formData, customerTypeIds: newIds });
  };

  const handleStaffChange = (staffId: string) => {
    const currentIds = (formData.assignedTo || "").split(",").filter(Boolean);
    const isSelected = currentIds.includes(staffId);
    let newIds: string[];
    if (isSelected) {
      newIds = currentIds.filter((id) => id !== staffId);
    } else {
      newIds = [...currentIds, staffId];
    }
    setFormData({ ...formData, assignedTo: newIds.join(",") });
  };

  const handleAdd = async () => {
    if (!formData.contactDate) {
      toast.error("接触日時は必須です");
      return;
    }
    if (!formData.customerTypeIds || formData.customerTypeIds.length === 0) {
      toast.error("顧客種別を1つ以上選択してください");
      return;
    }
    setLoading(true);
    // 追加全体で単一のトーストを使う（onAfterAdd 有りの場合は呼び出し側が最終確定する）
    const toastId = toast.loading("接触履歴を追加中...");
    try {
      const newHistory = await actions.add(entityId, {
        contactDate: formData.contactDate,
        contactMethodId: formData.contactMethodId,
        contactCategoryId: formData.contactCategoryId || null,
        assignedTo: formData.assignedTo || null,
        customerParticipants: formData.customerParticipants || null,
        meetingMinutes: formData.meetingMinutes,
        note: formData.note,
        customerTypeIds: formData.customerTypeIds,
        files: formData.files,
        sessionId: formData.sessionId ?? null,
      });
      const historyWithNames = {
        ...newHistory,
        assignedToNames: getStaffNames(newHistory.assignedTo as string | null),
      } as unknown as ContactHistory;
      setHistories([historyWithNames, ...histories]);

      // 追加後のフック（SLPではZoomエントリ処理）。
      // onAfterAdd が toast を最終確定する責務を持つ。
      if (onAfterAdd) {
        try {
          await onAfterAdd(historyWithNames, { toastId });
        } catch (e) {
          console.error("[contact-history-modal] onAfterAdd failed:", e);
          toast.error("追加後の処理に失敗しました", { id: toastId });
        }
      } else {
        toast.success("接触履歴を追加しました", { id: toastId });
      }

      setIsAddMode(false);
      if (autoEnterEditAfterAdd) {
        // 追加直後に編集モードへ遷移（Zoom議事録連携などを続けて行う用途）
        setEditHistory(historyWithNames);
        const nextFormData: Partial<ContactHistory> = {
          ...historyWithNames,
          contactCategoryId: historyWithNames.contactCategoryId || null,
          customerTypeIds:
            historyWithNames.customerTypeIds || [requiredCustomerTypeId],
          files: historyWithNames.files || [],
        };
        setFormData(nextFormData);
        initialSnapshotRef.current = snapshotFormData(nextFormData);
      } else {
        setFormData({});
        initialSnapshotRef.current = "";
      }
      clearFormCache();
    } catch {
      toast.error("追加に失敗しました", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const confirmEdit = () => {
    setPendingEditData(formData);
    setEditConfirm(true);
  };

  const handleUpdate = async () => {
    if (!editHistory || !pendingEditData?.contactDate) {
      toast.error("接触日時は必須です");
      return;
    }
    if (!pendingEditData.customerTypeIds || pendingEditData.customerTypeIds.length === 0) {
      toast.error("顧客種別を1つ以上選択してください");
      return;
    }
    setLoading(true);
    try {
      const updated = await actions.update(editHistory.id, {
        contactDate: pendingEditData.contactDate,
        contactMethodId: pendingEditData.contactMethodId,
        contactCategoryId: pendingEditData.contactCategoryId || null,
        assignedTo: pendingEditData.assignedTo || null,
        customerParticipants: pendingEditData.customerParticipants || null,
        meetingMinutes: pendingEditData.meetingMinutes,
        note: pendingEditData.note,
        customerTypeIds: pendingEditData.customerTypeIds,
        files: pendingEditData.files,
        sessionId: pendingEditData.sessionId ?? null,
      });
      const updatedWithNames = {
        ...updated,
        assignedToNames: getStaffNames(updated.assignedTo as string | null),
      } as unknown as ContactHistory;
      setHistories(
        histories.map((h) =>
          h.id === editHistory.id ? updatedWithNames : h
        )
      );
      toast.success("接触履歴を更新しました");
      setEditHistory(null);
      setFormData({});
      initialSnapshotRef.current = "";
      clearFormCache();
      setEditConfirm(false);
      setPendingEditData(null);
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
      await actions.delete(deleteConfirm.id);
      setHistories(histories.filter((h) => h.id !== deleteConfirm.id));
      toast.success("接触履歴を削除しました");
      setDeleteConfirm(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const selectedStaffIds = (formData.assignedTo || "").split(",").filter(Boolean);

  // 選択されたプロジェクトに応じて担当者をフィルタリング
  const getAvailableStaffOptions = () => {
    const selectedCustomerTypeIds = formData.customerTypeIds || [];
    if (selectedCustomerTypeIds.length === 0) {
      return staffOptions; // プロジェクト未選択時は全スタッフ
    }

    // 選択されたcustomerTypeIdsからprojectIdを取得
    const selectedProjectIds = new Set<number>();
    selectedCustomerTypeIds.forEach((ctId) => {
      const ct = customerTypes.find((c) => c.id === ctId);
      if (ct) {
        selectedProjectIds.add(ct.projectId);
      }
    });

    // 選択されたプロジェクトに割り当てられたスタッフを取得（重複除去）
    const availableStaffMap = new Map<string, { value: string; label: string }>();
    selectedProjectIds.forEach((projectId) => {
      const projectStaff = staffByProject[projectId] || [];
      projectStaff.forEach((s) => {
        if (!availableStaffMap.has(s.value)) {
          availableStaffMap.set(s.value, s);
        }
      });
    });

    const availableStaff = Array.from(availableStaffMap.values());
    // スタッフがいない場合は全スタッフを表示
    return availableStaff.length > 0 ? availableStaff : staffOptions;
  };

  const availableStaffOptions = getAvailableStaffOptions();

  const renderViewDetail = (history: ContactHistory) => {
    // 顧客種別名を取得
    const customerTypeNames = (history.customerTypeIds || [])
      .map((id) => customerTypes.find((ct) => ct.id === id)?.name)
      .filter(Boolean)
      .join(", ");

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailField label="接触日時">
            {formatDateTime(history.contactDate)}
          </DetailField>
          <DetailField label="接触方法">
            {history.contactMethodName || <EmptyText />}
          </DetailField>
        </div>

        <DetailField label="プロジェクト・顧客種別">
          {customerTypeNames || <EmptyText />}
        </DetailField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailField label="接触種別">
            {history.contactCategoryName || <EmptyText />}
          </DetailField>
          <DetailField label="担当者">
            {history.assignedToNames || getStaffNames(history.assignedTo) || <EmptyText />}
          </DetailField>
        </div>

        <DetailField label="先方参加者">
          {history.customerParticipants || <EmptyText />}
        </DetailField>

        <DetailField label="議事録" variant="textarea">
          {history.meetingMinutes ? (
            <div className="whitespace-pre-wrap">{history.meetingMinutes}</div>
          ) : (
            <EmptyText />
          )}
        </DetailField>

        <DetailField label="備考" variant="textarea">
          {history.note ? (
            <div className="whitespace-pre-wrap">{history.note}</div>
          ) : (
            <EmptyText />
          )}
        </DetailField>

        <DetailField label="添付ファイル" variant="tags">
          {history.files && history.files.length > 0 ? (
            <FileDisplay files={history.files} />
          ) : (
            <EmptyText />
          )}
        </DetailField>

        {/* 閲覧モードのZoom情報（読み取り専用。詳細押下でZoom商談詳細モーダル起動） */}
        {renderZoomSectionForView && (
          <div className="rounded-md border border-input bg-muted/30 p-3">
            {renderZoomSectionForView(history.id)}
          </div>
        )}
      </div>
    );
  };

  const renderForm = () => (
    <div className="flex flex-col border rounded-lg bg-muted/50 max-h-[60vh] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            接触日時 <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            selected={formData.contactDate ? new Date(formData.contactDate) : null}
            onChange={(date: Date | null) => {
              setFormData({
                ...formData,
                contactDate: date ? date.toISOString() : undefined,
              });
            }}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat="yyyy/MM/dd HH:mm"
            locale="ja"
            placeholderText="日時を選択"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            wrapperClassName="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label>接触方法</Label>
          <Select
            value={formData.contactMethodId ? String(formData.contactMethodId) : ""}
            onValueChange={(v) =>
              setFormData({ ...formData, contactMethodId: v ? Number(v) : null })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {contactMethodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* 顧客種別選択（プロジェクトごとにグループ化） */}
      <div className="space-y-2">
        <Label>プロジェクト・顧客種別 <span className="text-destructive">*</span></Label>
        <div className="border rounded-lg p-3 space-y-4">
          {/* プロジェクトごとにグループ化 */}
          {(() => {
            const projectGroups = customerTypes.reduce((acc, ct) => {
              const projectName = ct.project.name;
              if (!acc[projectName]) {
                acc[projectName] = { projectId: ct.projectId, displayOrder: ct.project.displayOrder, types: [] };
              }
              acc[projectName].types.push(ct);
              return acc;
            }, {} as Record<string, { projectId: number; displayOrder: number; types: CustomerType[] }>);

            return Object.entries(projectGroups)
              .sort(([, a], [, b]) => a.displayOrder - b.displayOrder)
              .map(([projectName, group]) => (
                <div key={projectName}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{projectName}</p>
                  <div className="flex flex-wrap gap-4 ml-2">
                    {group.types.map((ct) => {
                      const isRequired = ct.id === requiredCustomerTypeId;
                      const isChecked = (formData.customerTypeIds || []).includes(ct.id);
                      return (
                        <div key={ct.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`customer-type-${ct.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => handleCustomerTypeChange(ct.id, !!checked)}
                          />
                          <label
                            htmlFor={`customer-type-${ct.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {ct.name}
                            {isRequired && <span className="text-muted-foreground ml-1">（必須）</span>}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
          })()}
          {/* 必須顧客種別を外そうとした場合の警告 */}
          {requiredWarning && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded mt-2">
              <AlertCircle className="h-4 w-4" />
              <span>
                「{requiredCustomerTypeName}」を外す場合は、
                <a href={warningLink.href} className="underline font-medium">{warningLink.label}</a>
                ページから接触履歴を追加してください。
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 px-2"
                onClick={() => setRequiredWarning(false)}
              >
                閉じる
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>接触種別</Label>
          <Select
            value={formData.contactCategoryId ? String(formData.contactCategoryId) : ""}
            onValueChange={(v) =>
              setFormData({ ...formData, contactCategoryId: v ? Number(v) : null })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                const selectedProjectIds = new Set<number>();
                (formData.customerTypeIds || []).forEach((ctId) => {
                  const ct = customerTypes.find((c) => c.id === ctId);
                  if (ct) {
                    selectedProjectIds.add(ct.projectId);
                  }
                });
                const filtered = selectedProjectIds.size > 0
                  ? contactCategories.filter((cc) => selectedProjectIds.has(cc.projectId))
                  : contactCategories;
                return filtered.map((cc) => (
                  <SelectItem key={cc.id} value={String(cc.id)}>
                    {cc.name}
                  </SelectItem>
                ));
              })()}
            </SelectContent>
          </Select>
        </div>
        <div />
      </div>
      <div className="space-y-2">
        <Label>担当者（複数選択可）</Label>
        <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between min-h-10 h-auto"
            >
              <span className="flex flex-wrap gap-1">
                {selectedStaffIds.length === 0 ? (
                  <span className="text-muted-foreground">選択してください...</span>
                ) : (
                  selectedStaffIds.map((id) => {
                    const staff = staffOptions.find((s) => s.value === id);
                    return (
                      <span key={id} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-sm">
                        {staff?.label || id}
                      </span>
                    );
                  })
                )}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className={`${popoverWidth} p-0`} align="start">
            <Command>
              <CommandInput placeholder="担当者を検索..." />
              <CommandList maxHeight={300}>
                <CommandEmpty>
                  {availableStaffOptions.length === 0
                    ? "選択されたプロジェクトに担当者が割り当てられていません"
                    : "見つかりませんでした"}
                </CommandEmpty>
                <CommandGroup>
                  {availableStaffOptions.map((staff) => {
                    const isSelected = selectedStaffIds.includes(staff.value);
                    return (
                      <CommandItem
                        key={staff.value}
                        value={staff.label}
                        onSelect={() => handleStaffChange(staff.value)}
                      >
                        {isSelected && <Check className="mr-2 h-4 w-4" />}
                        {!isSelected && <span className="mr-2 w-4" />}
                        {staff.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label>先方参加者</Label>
        <Input
          value={formData.customerParticipants || ""}
          onChange={(e) => setFormData({ ...formData, customerParticipants: e.target.value })}
          placeholder="先方の参加者名を入力"
        />
      </div>
      <div className="space-y-2">
        <Label>議事録</Label>
        <Textarea
          value={formData.meetingMinutes || ""}
          onChange={(e) => setFormData({ ...formData, meetingMinutes: e.target.value })}
          rows={4}
          placeholder="議事録を入力"
        />
      </div>
      <div className="space-y-2">
        <Label>備考</Label>
        <Textarea
          value={formData.note || ""}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          rows={2}
          placeholder="備考"
        />
      </div>
      {sessionSelect && (
        <div className="space-y-2">
          <Label>{sessionSelect.label ?? "打ち合わせに紐付け（任意）"}</Label>
          <Select
            value={formData.sessionId ? String(formData.sessionId) : "__none__"}
            onValueChange={(v) =>
              setFormData({
                ...formData,
                sessionId: v === "__none__" ? null : Number(v),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="紐付けなし" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">紐付けなし</SelectItem>
              {sessionSelect.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sessionSelect.hint && (
            <p className="text-xs text-muted-foreground">{sessionSelect.hint}</p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label>添付ファイル</Label>
        <MultiFileUpload
          value={formData.files || []}
          onChange={(files) => setFormData({ ...formData, files })}
          contactHistoryId={editHistory?.id}
        />
      </div>
      {/* Zoom情報セクション（編集モード・既存レコードのみ） */}
      {editHistory && renderZoomSection && (
        <div className="rounded border p-3 bg-muted/20">
          {renderZoomSection(editHistory.id)}
        </div>
      )}
      {/* 追加モードのみ: 拡張セクション（SLP の Zoom議事録連携エントリ） */}
      {isAddMode && renderAddExtraSection && (
        <div className="rounded border p-3 bg-muted/20">
          {renderAddExtraSection()}
        </div>
      )}
      </div>
      {/* sticky footer: スクロール領域の外に固定 */}
      <div className="shrink-0 flex gap-2 justify-end border-t bg-white/80 px-4 py-3">
        <Button
          variant="outline"
          disabled={loading}
          onClick={() =>
            requestClose(() => {
              setIsAddMode(false);
              setEditHistory(null);
              setFormData({});
              initialSnapshotRef.current = "";
              clearFormCache();
              onDiscard?.();
            })
          }
        >
          キャンセル
        </Button>
        <Button
          onClick={isAddMode ? handleAdd : confirmEdit}
          disabled={loading}
        >
          {loading ? "保存中..." : isAddMode ? "追加" : "更新"}
        </Button>
      </div>
    </div>
  );

  // 日付でソート（降順）
  // 「予定のZoomあり」フィルタ（SLP固有、hasScheduledZoom が undefined のプロジェクトはそもそも何も起こらない）
  const [filterPendingZoom, setFilterPendingZoom] = useState(false);

  const hasAnyScheduledZoom = histories.some((h) => h.hasScheduledZoom);

  const sortedHistories = [...histories]
    .filter((h) => (filterPendingZoom ? h.hasScheduledZoom === true : true))
    .sort(
      (a, b) => new Date(b.contactDate).getTime() - new Date(a.contactDate).getTime()
    );

  // 追加/編集モード中は操作列を非表示（参照専用にしてUI混乱を解消）
  const isFormActive = isAddMode || !!editHistory;

  // 未保存変更の有無（formDataの変更 or 親が extraIsDirty で通知した拡張セクションの変更）
  const isDirty =
    isFormActive &&
    (snapshotFormData(formData) !== initialSnapshotRef.current ||
      !!extraIsDirty);

  // 破棄確認が必要な場面で使うヘルパー（確認してから proceed を実行）
  const requestClose = (proceed: () => void) => {
    if (isDirty) {
      setDiscardConfirm({ proceed });
    } else {
      proceed();
    }
  };

  // ブラウザ離脱時（リロード、タブ閉じ等）に警告
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const content = (
    <>
      {!renderInline && (
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-base">接触履歴管理 - {entityName}</DialogTitle>
        </DialogHeader>
      )}

      <div className={renderInline ? "flex flex-col gap-2 flex-1 min-h-0" : "px-4 py-3 flex flex-col gap-2 flex-1 min-h-0"}>
        {/* 追加ボタン + フィルタ */}
        {!isAddMode && !editHistory && (
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {hasAnyScheduledZoom && (
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterPendingZoom}
                    onChange={(e) => setFilterPendingZoom(e.target.checked)}
                  />
                  <span>📌 予定のZoomあり のみ表示</span>
                </label>
              )}
            </div>
            <Button size="sm" onClick={openAddForm}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              接触履歴を追加
            </Button>
          </div>
        )}

        {/* 追加/編集フォーム（フォーム内部で overflow/stickyを管理） */}
        {(isAddMode || editHistory) && (
          <div className="shrink-0">{renderForm()}</div>
        )}

        {/* 接触履歴一覧 */}
        {sortedHistories.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            接触履歴が登録されていません
          </div>
        ) : (
          <>
            {isFormActive && (
              <p className="text-xs text-muted-foreground shrink-0">
                ※ 入力中は過去の接触履歴は参照のみです（{isAddMode ? "追加" : "更新"}後に操作できます）
              </p>
            )}
          <Table containerClassName="border rounded-lg flex-1 min-h-0" containerStyle={{ overflow: 'auto' }}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px] whitespace-nowrap">接触日時</TableHead>
                <TableHead className="w-[72px] whitespace-nowrap">接触方法</TableHead>
                <TableHead className="w-[72px] whitespace-nowrap">接触種別</TableHead>
                <TableHead className="w-[80px] whitespace-nowrap">担当者</TableHead>
                <TableHead className="w-[80px] whitespace-nowrap">先方参加者</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">議事録</TableHead>
                <TableHead className="min-w-[100px] whitespace-nowrap">備考</TableHead>
                <TableHead className="w-[48px] whitespace-nowrap">添付</TableHead>
                {!isFormActive && (
                  <TableHead className="w-[130px] whitespace-nowrap sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHistories.map((history) => (
                <TableRow key={history.id}>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{formatDateTime(history.contactDate)}</span>
                      {history.hasScheduledZoom && (
                        <span
                          className="inline-flex items-center rounded bg-amber-100 text-amber-900 border border-amber-200 px-1 py-0 text-[10px]"
                          title="予定のZoomあり"
                        >
                          🕐 予定Zoom
                        </span>
                      )}
                      {history.hasFailedZoom && (
                        <span
                          className="inline-flex items-center rounded bg-red-100 text-red-900 border border-red-200 px-1 py-0 text-[10px]"
                          title="取得失敗のZoomあり"
                        >
                          ⚠️ 取得失敗
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{history.contactMethodName || "-"}</TableCell>
                  <TableCell>{history.contactCategoryName || "-"}</TableCell>
                  <TableCell>{history.assignedToNames || getStaffNames(history.assignedTo)}</TableCell>
                  <TableCell>{history.customerParticipants || "-"}</TableCell>
                  <TableCell>
                    <TextPreviewCell text={history.meetingMinutes} title="議事録" />
                  </TableCell>
                  <TableCell>
                    <TextPreviewCell text={history.note} title="備考" />
                  </TableCell>
                  <TableCell>
                    <FileDisplay files={history.files || []} />
                  </TableCell>
                  {!isFormActive && (
                    <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setViewHistory(history);
                            setEditHistory(null);
                            setIsAddMode(false);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setViewHistory(null);
                            openEditForm(history);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(history)}
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
          </>
        )}
      </div>
    </>
  );

  const viewDetailDialog = (
    <Dialog open={!!viewHistory} onOpenChange={(o) => !o && setViewHistory(null)}>
      <DialogContent
        size="fullwidth"
        className="sm:!max-w-[880px] max-h-[74vh] h-[74vh] flex flex-col overflow-hidden p-0 gap-0"
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b flex-shrink-0">
          <DialogTitle>接触履歴の詳細</DialogTitle>
        </DialogHeader>
        {viewHistory && (
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {renderViewDetail(viewHistory)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (renderInline) {
    return (
      <>
        <div className="flex flex-col flex-1 min-h-0">{content}</div>

        {viewDetailDialog}

        {/* 編集確認ダイアログ */}
        <AlertDialog open={editConfirm} onOpenChange={setEditConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>接触履歴を更新しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この操作により、接触履歴の内容が更新されます。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setEditConfirm(false)}>
                キャンセル
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleUpdate} disabled={loading}>
                {loading ? "更新中..." : "はい"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 削除確認ダイアログ */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>接触履歴を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteConfirm && (
                  <>
                    {formatDateTime(deleteConfirm.contactDate)}の接触履歴を削除します。
                    この操作は取り消せません。
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>
                キャンセル
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={loading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {loading ? "削除中..." : "はい"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 未保存変更の破棄確認ダイアログ */}
        <AlertDialog
          open={!!discardConfirm}
          onOpenChange={(open) => !open && setDiscardConfirm(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>保存していない内容があります</AlertDialogTitle>
              <AlertDialogDescription>
                入力中の内容は破棄されます。よろしいですか？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDiscardConfirm(null)}>
                入力に戻る
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const p = discardConfirm?.proceed;
                  setDiscardConfirm(null);
                  p?.();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                破棄して閉じる
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            requestClose(() => {
              setIsAddMode(false);
              setEditHistory(null);
              setViewHistory(null);
              setFormData({});
              initialSnapshotRef.current = "";
              clearFormCache();
              onDiscard?.();
              onOpenChange(false);
            });
          } else {
            onOpenChange(true);
          }
        }}
      >
        <DialogContent
          size="datagrid-cw"
          className="p-0 overflow-hidden flex flex-col"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {content}
        </DialogContent>
      </Dialog>

      {viewDetailDialog}

      {/* 編集確認ダイアログ */}
      <AlertDialog open={editConfirm} onOpenChange={setEditConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>接触履歴を更新しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作により、接触履歴の内容が更新されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEditConfirm(false)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdate} disabled={loading}>
              {loading ? "更新中..." : "はい"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>接触履歴を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm && (
                <>
                  {formatDateTime(deleteConfirm.contactDate)}の接触履歴を削除します。
                  この操作は取り消せません。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "削除中..." : "はい"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 未保存変更の破棄確認ダイアログ */}
      <AlertDialog
        open={!!discardConfirm}
        onOpenChange={(open) => !open && setDiscardConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>保存していない内容があります</AlertDialogTitle>
            <AlertDialogDescription>
              入力中の内容は破棄されます。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDiscardConfirm(null)}>
              入力に戻る
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const p = discardConfirm?.proceed;
                setDiscardConfirm(null);
                p?.();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              破棄して閉じる
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailField({
  label,
  children,
  variant = "default",
}: {
  label: string;
  children: React.ReactNode;
  variant?: "default" | "textarea" | "tags";
}) {
  const boxClass =
    variant === "textarea"
      ? "min-h-[96px] w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm"
      : variant === "tags"
        ? "min-h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm"
        : "flex min-h-10 w-full items-center rounded-md border border-input bg-muted/30 px-3 py-2 text-sm";
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className={boxClass}>{children}</div>
    </div>
  );
}

function EmptyText() {
  return <span className="text-gray-400">-</span>;
}
