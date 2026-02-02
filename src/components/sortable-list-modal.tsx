"use client";

import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";

type SortableItemProps = {
  id: number;
  label: string;
  subLabel?: string;
};

function SortableItem({ id, label, subLabel }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white border rounded-md ${
        isDragging ? "shadow-lg opacity-90 z-10" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        {subLabel && <div className="text-sm text-muted-foreground">{subLabel}</div>}
      </div>
    </div>
  );
}

type GroupedSortableListProps = {
  items: { id: number; label: string; groupKey: string; groupLabel: string }[];
  onDragEnd: (activeId: number, overId: number, groupKey: string) => void;
};

function GroupedSortableList({ items, onDragEnd }: GroupedSortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // グループごとにアイテムを分類
  const groups = items.reduce((acc, item) => {
    if (!acc[item.groupKey]) {
      acc[item.groupKey] = { label: item.groupLabel, items: [] };
    }
    acc[item.groupKey].items.push(item);
    return acc;
  }, {} as Record<string, { label: string; items: typeof items }>);

  const handleDragEnd = (event: DragEndEvent, groupKey: string) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onDragEnd(active.id as number, over.id as number, groupKey);
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([groupKey, group]) => (
        <div key={groupKey}>
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">{group.label}</h3>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleDragEnd(event, groupKey)}
          >
            <SortableContext
              items={group.items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {group.items.map((item) => (
                  <SortableItem key={item.id} id={item.id} label={item.label} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ))}
    </div>
  );
}

export type SortableItem = {
  id: number;
  label: string;
  subLabel?: string;
  groupKey?: string;
  groupLabel?: string;
};

type SortableListModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: SortableItem[];
  onReorder: (orderedIds: number[]) => Promise<void>;
  grouped?: boolean;
};

export function SortableListModal({
  open,
  onOpenChange,
  title,
  items: initialItems,
  onReorder,
  grouped = false,
}: SortableListModalProps) {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // モーダルが開かれたときにitemsをリセット
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setItems(initialItems);
    }
    onOpenChange(newOpen);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // グループ内でのドラッグ終了ハンドラ
  const handleGroupedDragEnd = (activeId: number, overId: number, groupKey: string) => {
    setItems((items) => {
      // 同じグループ内のアイテムのみを対象に並び替え
      const groupItems = items.filter((item) => item.groupKey === groupKey);
      const otherItems = items.filter((item) => item.groupKey !== groupKey);

      const oldIndex = groupItems.findIndex((item) => item.id === activeId);
      const newIndex = groupItems.findIndex((item) => item.id === overId);
      const reorderedGroupItems = arrayMove(groupItems, oldIndex, newIndex);

      // グループの順序を維持しつつ再構築
      const groupOrder = [...new Set(initialItems.map((item) => item.groupKey))];
      const result: SortableItem[] = [];

      for (const gk of groupOrder) {
        if (gk === groupKey) {
          result.push(...reorderedGroupItems);
        } else {
          result.push(...items.filter((item) => item.groupKey === gk));
        }
      }

      return result;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await onReorder(items.map((item) => item.id));
      toast.success("並び順を更新しました");
      onOpenChange(false);
    } catch {
      toast.error("並び順の更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}の並び替え</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            ドラッグ&ドロップで順序を変更してください
          </p>
          {grouped ? (
            <GroupedSortableList
              items={items.map((item) => ({
                id: item.id,
                label: item.label,
                groupKey: item.groupKey || "default",
                groupLabel: item.groupLabel || "",
              }))}
              onDragEnd={handleGroupedDragEnd}
            />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {items.map((item) => (
                    <SortableItem
                      key={item.id}
                      id={item.id}
                      label={item.label}
                      subLabel={item.subLabel}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
