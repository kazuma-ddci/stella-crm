"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, GripVertical, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  getAllScWholesaleStatuses,
  addScWholesaleStatus,
  updateScWholesaleStatus,
  deleteScWholesaleStatus,
  reorderScWholesaleStatuses,
  getAllConsultingPlanStatuses,
  addConsultingPlanStatus,
  updateConsultingPlanStatus,
  deleteConsultingPlanStatus,
  reorderConsultingPlanStatuses,
  getAllVendorRegistrationStatuses,
  addVendorRegistrationStatus,
  updateVendorRegistrationStatus,
  deleteVendorRegistrationStatus,
  reorderVendorRegistrationStatuses,
  getAllContractStatuses,
  addContractStatus,
  updateContractStatus,
  deleteContractStatus,
  reorderContractStatuses,
} from "./vendor-status-actions";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PRESET_COLOR_OPTIONS, getBadgeClasses, type BadgeColor } from "@/lib/badge-color";

type StatusItem = {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
  color?: string;
  isCompleted?: boolean;
};

type RenameContext = {
  id: number;
  oldName: string;
  newName: string;
};

export type StatusType = "scWholesale" | "consultingPlan" | "vendorRegistration" | "contractStatus";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: StatusType;
};

const CONFIG = {
  scWholesale: {
    title: "セキュリティクラウド卸ステータス管理",
    getAll: getAllScWholesaleStatuses,
    add: addScWholesaleStatus,
    update: updateScWholesaleStatus,
    remove: deleteScWholesaleStatus,
    reorder: reorderScWholesaleStatuses,
    hasColor: true,
    hasCompleted: false,
  },
  consultingPlan: {
    title: "コンサルティングプランステータス管理",
    getAll: getAllConsultingPlanStatuses,
    add: addConsultingPlanStatus,
    update: updateConsultingPlanStatus,
    remove: deleteConsultingPlanStatus,
    reorder: reorderConsultingPlanStatuses,
    hasColor: true,
    hasCompleted: false,
  },
  vendorRegistration: {
    title: "ベンダー登録ステータス管理",
    getAll: getAllVendorRegistrationStatuses,
    add: addVendorRegistrationStatus,
    update: updateVendorRegistrationStatus,
    remove: deleteVendorRegistrationStatus,
    reorder: reorderVendorRegistrationStatuses,
    hasColor: false,
    hasCompleted: true,
  },
  contractStatus: {
    title: "契約状況管理（共通）",
    getAll: getAllContractStatuses,
    add: addContractStatus,
    update: updateContractStatus,
    remove: deleteContractStatus,
    reorder: reorderContractStatuses,
    hasColor: false,
    hasCompleted: true,
  },
} as const;

function ColorPreview({ color, label }: { color: string; label: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${getBadgeClasses(color as BadgeColor)}`}>
      {label}
    </span>
  );
}

function SortableStatusRow({
  status,
  editingId,
  editName,
  setEditName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleActive,
  onChangeColor,
  onToggleCompleted,
  onDelete,
  loading,
  hasColor,
  hasCompleted,
}: {
  status: StatusItem;
  editingId: number | null;
  editName: string;
  setEditName: (name: string) => void;
  onStartEdit: (status: StatusItem) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleActive: (status: StatusItem) => void;
  onChangeColor: (status: StatusItem, color: string) => void;
  onToggleCompleted: (status: StatusItem) => void;
  onDelete: (status: StatusItem) => void;
  loading: boolean;
  hasColor: boolean;
  hasCompleted: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isEditing = editingId === status.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 border rounded-lg bg-white"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-8"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancelEdit();
            }}
          />
          <Button size="sm" variant="ghost" onClick={onSaveEdit} disabled={loading}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelEdit} disabled={loading}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          {hasColor ? (
            <span className={`flex-1 text-sm ${!status.isActive ? "opacity-40" : ""}`}>
              <ColorPreview color={status.color || "gray"} label={status.name} />
            </span>
          ) : (
            <span className={`flex-1 text-sm ${!status.isActive ? "text-gray-400 line-through" : ""}`}>
              {status.name}
            </span>
          )}
          <div className="flex items-center gap-2">
            {hasColor && (
              <Select
                value={status.color || "gray"}
                onValueChange={(v) => onChangeColor(status, v)}
                disabled={loading}
              >
                <SelectTrigger className="h-7 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_COLOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-3 w-3 rounded ${getBadgeClasses(opt.value as BadgeColor)}`} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasCompleted && (
              <>
                <Label htmlFor={`completed-${status.id}`} className="text-xs text-gray-500">
                  完了
                </Label>
                <Switch
                  id={`completed-${status.id}`}
                  checked={!!status.isCompleted}
                  onCheckedChange={() => onToggleCompleted(status)}
                  disabled={loading}
                />
              </>
            )}
            <Label htmlFor={`active-${status.id}`} className="text-xs text-gray-500">
              有効
            </Label>
            <Switch
              id={`active-${status.id}`}
              checked={status.isActive}
              onCheckedChange={() => onToggleActive(status)}
              disabled={loading}
            />
            <Button size="sm" variant="ghost" onClick={() => onStartEdit(status)} disabled={loading}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(status)} disabled={loading}>
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function VendorStatusManagementModal({ open, onOpenChange, type }: Props) {
  const router = useRouter();
  const config = CONFIG[type];
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("gray");
  const [newCompleted, setNewCompleted] = useState(false);
  const [addingNew, setAddingNew] = useState(false);

  // 名前変更確認ダイアログ
  const [renameConfirm, setRenameConfirm] = useState<RenameContext | null>(null);

  // 削除確認ダイアログ
  const [deleteConfirm, setDeleteConfirm] = useState<StatusItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadStatuses = useCallback(async () => {
    const data = await config.getAll();
    setStatuses(data);
  }, [config]);

  useEffect(() => {
    if (open) {
      loadStatuses();
    }
  }, [open, loadStatuses]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setEditingId(null);
      setAddingNew(false);
      setNewName("");
      setNewColor("gray");
      setNewCompleted(false);
      router.refresh();
    }
    onOpenChange(isOpen);
  };

  // 追加
  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { name: newName.trim(), isActive: true };
      if (config.hasColor) payload.color = newColor;
      if (config.hasCompleted) payload.isCompleted = newCompleted;
      await config.add(payload);
      setNewName("");
      setNewColor("gray");
      setNewCompleted(false);
      setAddingNew(false);
      await loadStatuses();
      toast.success("ステータスを追加しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 編集開始
  const handleStartEdit = (status: StatusItem) => {
    setEditingId(status.id);
    setEditName(status.name);
  };

  // 編集保存（名前変更確認フロー）
  const handleSaveEdit = () => {
    if (editingId === null) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    const current = statuses.find((s) => s.id === editingId);
    if (!current) return;

    // 名前が変わっていない場合はそのまま閉じる
    if (current.name === trimmed) {
      setEditingId(null);
      return;
    }

    // 確認ダイアログを表示
    setRenameConfirm({
      id: editingId,
      oldName: current.name,
      newName: trimmed,
    });
  };

  // 名前変更確認: はい
  const handleRenameConfirmYes = async () => {
    if (!renameConfirm) return;
    setLoading(true);
    try {
      await config.update(renameConfirm.id, { name: renameConfirm.newName });
      setEditingId(null);
      setRenameConfirm(null);
      await loadStatuses();
      toast.success("ステータス名を変更しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 名前変更確認: キャンセル
  const handleRenameCancel = () => {
    setRenameConfirm(null);
  };

  // 有効/無効切り替え
  const handleToggleActive = async (status: StatusItem) => {
    setLoading(true);
    try {
      await config.update(status.id, { isActive: !status.isActive });
      await loadStatuses();
      toast.success(`ステータスを${status.isActive ? "無効" : "有効"}にしました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 色変更
  const handleChangeColor = async (status: StatusItem, color: string) => {
    setLoading(true);
    try {
      await config.update(status.id, { color });
      await loadStatuses();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "色の変更に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 完了フラグ切り替え
  const handleToggleCompleted = async (status: StatusItem) => {
    setLoading(true);
    try {
      await config.update(status.id, { isCompleted: !status.isCompleted });
      await loadStatuses();
      toast.success(`完了フラグを${status.isCompleted ? "オフ" : "オン"}にしました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 削除
  const handleDeleteClick = (status: StatusItem) => {
    setDeleteConfirm(status);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setLoading(true);
    try {
      await config.remove(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadStatuses();
      toast.success("ステータスを削除しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 並び替え
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = statuses.findIndex((s) => s.id === active.id);
    const newIndex = statuses.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(statuses, oldIndex, newIndex);
    setStatuses(newOrder);

    try {
      await config.reorder(newOrder.map((s) => s.id));
    } catch {
      toast.error("並び替えに失敗しました");
      await loadStatuses();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={statuses.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {statuses.map((status) => (
                  <SortableStatusRow
                    key={status.id}
                    status={status}
                    editingId={editingId}
                    editName={editName}
                    setEditName={setEditName}
                    onStartEdit={handleStartEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onToggleActive={handleToggleActive}
                    onChangeColor={handleChangeColor}
                    onToggleCompleted={handleToggleCompleted}
                    onDelete={handleDeleteClick}
                    loading={loading}
                    hasColor={config.hasColor}
                    hasCompleted={config.hasCompleted}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {statuses.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                ステータスが登録されていません
              </p>
            )}

            {addingNew ? (
              <div className="flex flex-wrap items-center gap-2 p-2 border rounded-lg border-dashed">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ステータス名"
                  className="h-8 flex-1 min-w-[120px]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setAddingNew(false);
                      setNewName("");
                      setNewColor("gray");
                      setNewCompleted(false);
                    }
                  }}
                />
                {config.hasColor && (
                  <Select value={newColor} onValueChange={setNewColor}>
                    <SelectTrigger className="h-8 w-[110px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_COLOR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-3 w-3 rounded ${getBadgeClasses(opt.value as BadgeColor)}`} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {config.hasCompleted && (
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-gray-500">完了</Label>
                    <Switch checked={newCompleted} onCheckedChange={setNewCompleted} />
                  </div>
                )}
                <Button size="sm" onClick={handleAdd} disabled={loading || !newName.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingNew(false);
                    setNewName("");
                    setNewColor("gray");
                    setNewCompleted(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setAddingNew(true)}
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 名前変更確認ダイアログ */}
      <AlertDialog open={!!renameConfirm} onOpenChange={(open) => !open && handleRenameCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ステータス名の変更確認</AlertDialogTitle>
            <AlertDialogDescription>
              「{renameConfirm?.oldName}」を「{renameConfirm?.newName}」に変更します。このステータスを使用中のデータも全て新しい名前で表示されます。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={handleRenameCancel} disabled={loading}>
              キャンセル
            </Button>
            <Button onClick={handleRenameConfirmYes} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              はい
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ステータスの削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteConfirm?.name}」を削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={loading}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              削除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
