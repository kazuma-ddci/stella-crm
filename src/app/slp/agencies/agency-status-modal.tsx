"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, GripVertical, Trash2, Pencil, Check, X } from "lucide-react";
import {
  getAllAgencyContractStatuses,
  addAgencyContractStatus,
  updateAgencyContractStatus,
  deleteAgencyContractStatus,
  reorderAgencyContractStatuses,
} from "./actions";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

type StatusItem = {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

function SortableStatusRow({
  item,
  onToggle,
  onRename,
  onDelete,
}: {
  item: StatusItem;
  onToggle: (id: number, isActive: boolean) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRename, setConfirmRename] = useState(false);

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

  const handleSaveRename = () => {
    if (editName.trim() && editName.trim() !== item.name) {
      setConfirmRename(true);
    } else {
      setEditing(false);
      setEditName(item.name);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-2 py-2 px-2 border rounded-md bg-white"
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {editing ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
                if (e.key === "Escape") {
                  setEditing(false);
                  setEditName(item.name);
                }
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleSaveRename}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setEditing(false);
                setEditName(item.name);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <span
              className={`flex-1 text-sm ${!item.isActive ? "text-gray-400 line-through" : ""}`}
            >
              {item.name}
            </span>
            <Switch
              checked={item.isActive}
              onCheckedChange={(v) => onToggle(item.id, v)}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setEditing(true);
                setEditName(item.name);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-red-500 hover:text-red-700"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ステータスを削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{item.name}」を削除してよろしいですか？使用中の代理店がある場合は削除できません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(item.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRename} onOpenChange={setConfirmRename}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>名前を変更</AlertDialogTitle>
            <AlertDialogDescription>
              「{item.name}」→「{editName.trim()}」に変更してよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setEditing(false);
                setEditName(item.name);
              }}
            >
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRename(item.id, editName.trim());
                setEditing(false);
              }}
            >
              変更
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function AgencyStatusModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<StatusItem[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const loadStatuses = async () => {
    const data = await getAllAgencyContractStatuses();
    setItems(data);
  };

  useEffect(() => {
    if (open) {
      loadStatuses();
      setError(null);
    }
  }, [open]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await addAgencyContractStatus({ name: newName.trim() });
      setNewName("");
      await loadStatuses();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    await updateAgencyContractStatus(id, { isActive });
    await loadStatuses();
    router.refresh();
  };

  const handleRename = async (id: number, name: string) => {
    await updateAgencyContractStatus(id, { name });
    await loadStatuses();
    router.refresh();
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      const result = await deleteAgencyContractStatus(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await loadStatuses();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    await reorderAgencyContractStatuses(newItems.map((i) => i.id));
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>契約ステータス管理</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            placeholder="新しいステータス名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="text-sm"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={loading || !newName.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            追加
          </Button>
        </div>

        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <SortableStatusRow
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              ステータスが登録されていません
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
