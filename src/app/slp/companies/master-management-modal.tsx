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
import { Plus, Pencil, Trash2, GripVertical, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  getAllMasterOptions,
  addMasterOption,
  updateMasterOption,
  deleteMasterOption,
  reorderMasterOptions,
  type MasterKind,
  type MasterItem,
} from "./actions";
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

type RenameContext = {
  id: number;
  oldName: string;
  newName: string;
};

const TITLES: Record<MasterKind, string> = {
  industry: "業種マスタ管理",
  flow_source: "流入経路マスタ管理",
  status1: "ステータス①マスタ管理",
  status2: "ステータス②マスタ管理",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: MasterKind;
};

function SortableMasterRow({
  item,
  editingId,
  editName,
  setEditName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleActive,
  onDelete,
  loading,
}: {
  item: MasterItem;
  editingId: number | null;
  editName: string;
  setEditName: (name: string) => void;
  onStartEdit: (item: MasterItem) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleActive: (item: MasterItem) => void;
  onDelete: (item: MasterItem) => void;
  loading: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isEditing = editingId === item.id;

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
          <span
            className={`flex-1 text-sm ${
              !item.isActive ? "text-gray-400 line-through" : ""
            }`}
          >
            {item.name}
          </span>
          <div className="flex items-center gap-2">
            <Label htmlFor={`active-${item.id}`} className="text-xs text-gray-500">
              有効
            </Label>
            <Switch
              id={`active-${item.id}`}
              checked={item.isActive}
              onCheckedChange={() => onToggleActive(item)}
              disabled={loading}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onStartEdit(item)}
              disabled={loading}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(item)}
              disabled={loading}
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function MasterManagementModal({ open, onOpenChange, kind }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [addingNew, setAddingNew] = useState(false);

  // 名前変更確認ダイアログ
  const [renameConfirm, setRenameConfirm] = useState<RenameContext | null>(null);
  // 削除確認ダイアログ
  const [deleteConfirm, setDeleteConfirm] = useState<MasterItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadItems = useCallback(async () => {
    const data = await getAllMasterOptions(kind);
    setItems(data);
  }, [kind]);

  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open, loadItems]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setEditingId(null);
      setAddingNew(false);
      setNewName("");
      router.refresh();
    }
    onOpenChange(isOpen);
  };

  // 追加（確定ボタンでのみ実行 - Enterでは追加しない）
  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const result = await addMasterOption(kind, newName.trim(), true);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNewName("");
      setAddingNew(false);
      await loadItems();
      toast.success("追加しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 編集開始
  const handleStartEdit = (item: MasterItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  // 編集保存（名前変更確認フロー）
  const handleSaveEdit = () => {
    if (editingId === null) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    const current = items.find((s) => s.id === editingId);
    if (!current) return;

    if (current.name === trimmed) {
      setEditingId(null);
      return;
    }

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
      const result = await updateMasterOption(kind, renameConfirm.id, { name: renameConfirm.newName });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditingId(null);
      setRenameConfirm(null);
      await loadItems();
      toast.success("名称を変更しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleRenameCancel = () => {
    setRenameConfirm(null);
  };

  // 有効/無効切り替え
  const handleToggleActive = async (item: MasterItem) => {
    setLoading(true);
    try {
      const result = await updateMasterOption(kind, item.id, { isActive: !item.isActive });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      await loadItems();
      toast.success(`${item.isActive ? "無効" : "有効"}にしました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 削除
  const handleDeleteClick = (item: MasterItem) => {
    setDeleteConfirm(item);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setLoading(true);
    try {
      const result = await deleteMasterOption(kind, deleteConfirm.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDeleteConfirm(null);
      await loadItems();
      toast.success("削除しました");
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

    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(items, oldIndex, newIndex);
    setItems(newOrder);

    try {
      await reorderMasterOptions(kind, newOrder.map((s) => s.id));
    } catch {
      toast.error("並び替えに失敗しました");
      await loadItems();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{TITLES[kind]}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.map((item) => (
                  <SortableMasterRow
                    key={item.id}
                    item={item}
                    editingId={editingId}
                    editName={editName}
                    setEditName={setEditName}
                    onStartEdit={handleStartEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={() => setEditingId(null)}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDeleteClick}
                    loading={loading}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {items.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                まだ登録がありません
              </p>
            )}

            {addingNew ? (
              <div className="flex items-center gap-2 p-2 border rounded-lg border-dashed">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="名称を入力"
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setAddingNew(false);
                      setNewName("");
                    }
                    // Enterで誤確定しないように何もしない（確定ボタン必須）
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={loading || !newName.trim()}
                  title="確定"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingNew(false);
                    setNewName("");
                  }}
                  title="キャンセル"
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
      <AlertDialog
        open={!!renameConfirm}
        onOpenChange={(open) => !open && handleRenameCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>名称の変更確認</AlertDialogTitle>
            <AlertDialogDescription>
              「{renameConfirm?.oldName}」を「{renameConfirm?.newName}
              」に変更します。このマスタを使用中のデータも全て新しい名前で表示されます。よろしいですか？
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
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除の確認</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteConfirm?.name}」を削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={loading}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              削除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
