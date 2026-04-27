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
import { Plus, GripVertical, Loader2, Check, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getAllTools,
  addTool,
  updateTool,
  deleteTool,
  reorderTools,
  getToolStatuses,
  addToolStatus,
  updateToolStatus,
  deleteToolStatus,
  reorderToolStatuses,
} from "./vendor-tools-actions";
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

type ToolItem = {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

type ToolStatusItem = {
  id: number;
  toolId: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
  isCompleted: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function SortableRow({
  id,
  selected,
  onClick,
  children,
}: {
  id: number;
  selected?: boolean;
  onClick?: () => void;
  children: (handleProps: { listeners: ReturnType<typeof useSortable>["listeners"]; attributes: ReturnType<typeof useSortable>["attributes"] }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`flex items-center gap-2 p-2 border rounded-lg bg-white ${selected ? "ring-2 ring-blue-400" : ""} ${onClick ? "cursor-pointer hover:bg-gray-50" : ""}`}
    >
      {children({ listeners, attributes })}
    </div>
  );
}

export function VendorToolsManagementModal({ open, onOpenChange }: Props) {
  const router = useRouter();

  const [tools, setTools] = useState<ToolItem[]>([]);
  const [statuses, setStatuses] = useState<ToolStatusItem[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // ツール追加
  const [addingTool, setAddingTool] = useState(false);
  const [newToolName, setNewToolName] = useState("");

  // ツール編集
  const [editingToolId, setEditingToolId] = useState<number | null>(null);
  const [editToolName, setEditToolName] = useState("");

  // ステータス追加
  const [addingStatus, setAddingStatus] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusCompleted, setNewStatusCompleted] = useState(false);

  // ステータス編集
  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const [editStatusName, setEditStatusName] = useState("");

  // 削除確認
  const [deleteToolConfirm, setDeleteToolConfirm] = useState<ToolItem | null>(null);
  const [deleteStatusConfirm, setDeleteStatusConfirm] = useState<ToolStatusItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadTools = useCallback(async () => {
    const data = await getAllTools();
    setTools(data);
    if (data.length > 0 && selectedToolId === null) {
      setSelectedToolId(data[0].id);
    }
    if (selectedToolId !== null && !data.find((t) => t.id === selectedToolId)) {
      setSelectedToolId(data[0]?.id ?? null);
    }
  }, [selectedToolId]);

  const loadStatuses = useCallback(async (toolId: number | null) => {
    if (toolId === null) {
      setStatuses([]);
      return;
    }
    const data = await getToolStatuses(toolId);
    setStatuses(data);
  }, []);

  useEffect(() => {
    if (open) {
      loadTools();
    } else {
      setSelectedToolId(null);
      setStatuses([]);
      setAddingTool(false);
      setAddingStatus(false);
      setEditingToolId(null);
      setEditingStatusId(null);
    }
  }, [open, loadTools]);

  useEffect(() => {
    loadStatuses(selectedToolId);
  }, [selectedToolId, loadStatuses]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      router.refresh();
    }
    onOpenChange(isOpen);
  };

  // ============================================
  // ツール操作
  // ============================================

  const handleAddTool = async () => {
    if (!newToolName.trim()) return;
    setLoading(true);
    try {
      const r = await addTool({ name: newToolName.trim() });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setNewToolName("");
      setAddingTool(false);
      await loadTools();
      toast.success("ツールを追加しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToolEdit = async () => {
    if (editingToolId === null) return;
    const trimmed = editToolName.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const r = await updateTool(editingToolId, { name: trimmed });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setEditingToolId(null);
      await loadTools();
      toast.success("ツール名を変更しました");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleToolActive = async (tool: ToolItem) => {
    setLoading(true);
    try {
      const r = await updateTool(tool.id, { isActive: !tool.isActive });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      await loadTools();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteTool = async () => {
    if (!deleteToolConfirm) return;
    setLoading(true);
    try {
      const r = await deleteTool(deleteToolConfirm.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDeleteToolConfirm(null);
      await loadTools();
      toast.success("ツールを削除しました");
    } finally {
      setLoading(false);
    }
  };

  const handleToolDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tools.findIndex((t) => t.id === active.id);
    const newIndex = tools.findIndex((t) => t.id === over.id);
    const newOrder = arrayMove(tools, oldIndex, newIndex);
    setTools(newOrder);
    const r = await reorderTools(newOrder.map((t) => t.id));
    if (!r.ok) {
      toast.error("並び替えに失敗しました");
      await loadTools();
    }
  };

  // ============================================
  // ステータス操作
  // ============================================

  const handleAddStatus = async () => {
    if (selectedToolId === null) return;
    if (!newStatusName.trim()) return;
    setLoading(true);
    try {
      const r = await addToolStatus(selectedToolId, {
        name: newStatusName.trim(),
        isCompleted: newStatusCompleted,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setNewStatusName("");
      setNewStatusCompleted(false);
      setAddingStatus(false);
      await loadStatuses(selectedToolId);
      toast.success("ステータスを追加しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStatusEdit = async () => {
    if (editingStatusId === null) return;
    const trimmed = editStatusName.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const r = await updateToolStatus(editingStatusId, { name: trimmed });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setEditingStatusId(null);
      await loadStatuses(selectedToolId);
      toast.success("ステータス名を変更しました");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatusActive = async (status: ToolStatusItem) => {
    setLoading(true);
    try {
      const r = await updateToolStatus(status.id, { isActive: !status.isActive });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      await loadStatuses(selectedToolId);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatusCompleted = async (status: ToolStatusItem) => {
    setLoading(true);
    try {
      const r = await updateToolStatus(status.id, { isCompleted: !status.isCompleted });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      await loadStatuses(selectedToolId);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteStatus = async () => {
    if (!deleteStatusConfirm) return;
    setLoading(true);
    try {
      const r = await deleteToolStatus(deleteStatusConfirm.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDeleteStatusConfirm(null);
      await loadStatuses(selectedToolId);
      toast.success("ステータスを削除しました");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusDragEnd = async (event: DragEndEvent) => {
    if (selectedToolId === null) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = statuses.findIndex((s) => s.id === active.id);
    const newIndex = statuses.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(statuses, oldIndex, newIndex);
    setStatuses(newOrder);
    const r = await reorderToolStatuses(selectedToolId, newOrder.map((s) => s.id));
    if (!r.ok) {
      toast.error("並び替えに失敗しました");
      await loadStatuses(selectedToolId);
    }
  };

  const selectedTool = tools.find((t) => t.id === selectedToolId) ?? null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="!max-w-[1100px] w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ツール登録 設定</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 左ペイン: ツール一覧 */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium border-b pb-1">ツール一覧</h3>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleToolDragEnd}
              >
                <SortableContext items={tools.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {tools.map((tool) => {
                    const isEditing = editingToolId === tool.id;
                    return (
                      <SortableRow
                        key={tool.id}
                        id={tool.id}
                        selected={selectedToolId === tool.id}
                        onClick={isEditing ? undefined : () => setSelectedToolId(tool.id)}
                      >
                        {({ listeners, attributes }) => (
                          <>
                            <button
                              type="button"
                              className="cursor-grab touch-none text-gray-400 hover:text-gray-600"
                              onClick={(e) => e.stopPropagation()}
                              {...attributes}
                              {...listeners}
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>
                            {isEditing ? (
                              <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  value={editToolName}
                                  onChange={(e) => setEditToolName(e.target.value)}
                                  className="h-8"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") setEditingToolId(null);
                                    if (e.key === "Enter") handleSaveToolEdit();
                                  }}
                                />
                                <Button size="sm" variant="ghost" onClick={handleSaveToolEdit} disabled={loading}>
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingToolId(null)} disabled={loading}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span className={`flex-1 min-w-0 text-sm truncate ${!tool.isActive ? "text-gray-400 line-through" : ""}`}>
                                  {tool.name}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <Label className="text-xs text-gray-500">有効</Label>
                                  <Switch
                                    checked={tool.isActive}
                                    onCheckedChange={() => handleToggleToolActive(tool)}
                                    disabled={loading}
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => {
                                      setEditingToolId(tool.id);
                                      setEditToolName(tool.name);
                                    }}
                                    disabled={loading}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setDeleteToolConfirm(tool)}
                                    disabled={loading}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </SortableRow>
                    );
                  })}
                </SortableContext>
              </DndContext>

              {tools.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">ツールが登録されていません</p>
              )}

              {addingTool ? (
                <div className="flex items-center gap-2 p-2 border rounded-lg border-dashed">
                  <Input
                    value={newToolName}
                    onChange={(e) => setNewToolName(e.target.value)}
                    placeholder="ツール名"
                    className="h-8 flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setAddingTool(false);
                        setNewToolName("");
                      }
                      if (e.key === "Enter") handleAddTool();
                    }}
                  />
                  <Button size="sm" onClick={handleAddTool} disabled={loading || !newToolName.trim()}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAddingTool(false);
                      setNewToolName("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setAddingTool(true)} disabled={loading}>
                  <Plus className="h-4 w-4 mr-1" />
                  ツールを追加
                </Button>
              )}
            </div>

            {/* 右ペイン: 選択中ツールのステータス一覧 */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium border-b pb-1">
                {selectedTool ? `「${selectedTool.name}」のステータス` : "ステータス"}
              </h3>

              {selectedTool ? (
                <>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleStatusDragEnd}
                  >
                    <SortableContext items={statuses.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                      {statuses.map((status) => {
                        const isEditing = editingStatusId === status.id;
                        return (
                          <SortableRow key={status.id} id={status.id}>
                            {({ listeners, attributes }) => (
                              <>
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
                                      value={editStatusName}
                                      onChange={(e) => setEditStatusName(e.target.value)}
                                      className="h-8"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") setEditingStatusId(null);
                                        if (e.key === "Enter") handleSaveStatusEdit();
                                      }}
                                    />
                                    <Button size="sm" variant="ghost" onClick={handleSaveStatusEdit} disabled={loading}>
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingStatusId(null)} disabled={loading}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <span className={`flex-1 min-w-0 text-sm truncate ${!status.isActive ? "text-gray-400 line-through" : ""}`}>
                                      {status.name}
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Label className="text-xs text-gray-500">完了</Label>
                                      <Switch
                                        checked={status.isCompleted}
                                        onCheckedChange={() => handleToggleStatusCompleted(status)}
                                        disabled={loading}
                                      />
                                      <Label className="text-xs text-gray-500">有効</Label>
                                      <Switch
                                        checked={status.isActive}
                                        onCheckedChange={() => handleToggleStatusActive(status)}
                                        disabled={loading}
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0"
                                        onClick={() => {
                                          setEditingStatusId(status.id);
                                          setEditStatusName(status.name);
                                        }}
                                        disabled={loading}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0"
                                        onClick={() => setDeleteStatusConfirm(status)}
                                        disabled={loading}
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                          </SortableRow>
                        );
                      })}
                    </SortableContext>
                  </DndContext>

                  {statuses.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">ステータスが登録されていません</p>
                  )}

                  {addingStatus ? (
                    <div className="flex flex-wrap items-center gap-2 p-2 border rounded-lg border-dashed">
                      <Input
                        value={newStatusName}
                        onChange={(e) => setNewStatusName(e.target.value)}
                        placeholder="ステータス名"
                        className="h-8 flex-1 min-w-[120px]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setAddingStatus(false);
                            setNewStatusName("");
                            setNewStatusCompleted(false);
                          }
                          if (e.key === "Enter") handleAddStatus();
                        }}
                      />
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-gray-500">完了</Label>
                        <Switch checked={newStatusCompleted} onCheckedChange={setNewStatusCompleted} />
                      </div>
                      <Button size="sm" onClick={handleAddStatus} disabled={loading || !newStatusName.trim()}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAddingStatus(false);
                          setNewStatusName("");
                          setNewStatusCompleted(false);
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
                      onClick={() => setAddingStatus(true)}
                      disabled={loading}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      ステータスを追加
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">左側でツールを選択してください</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ツール削除確認 */}
      <AlertDialog open={!!deleteToolConfirm} onOpenChange={(o) => !o && setDeleteToolConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ツールを削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteToolConfirm?.name}」とそのステータス、各ベンダーのこのツールに対する登録もすべて削除されます。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteToolConfirm(null)} disabled={loading}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteTool} disabled={loading}>
              削除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ステータス削除確認 */}
      <AlertDialog open={!!deleteStatusConfirm} onOpenChange={(o) => !o && setDeleteStatusConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ステータスを削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteStatusConfirm?.name}」を削除します。使用中のベンダーがある場合は削除できません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteStatusConfirm(null)} disabled={loading}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteStatus} disabled={loading}>
              削除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
