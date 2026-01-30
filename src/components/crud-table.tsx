"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type ColumnDef = {
  key: string;
  header: string;
  type?: "text" | "number" | "date" | "datetime" | "boolean" | "textarea" | "select";
  editable?: boolean;
  options?: { value: string; label: string }[];
  required?: boolean;
};

type CrudTableProps = {
  data: Record<string, unknown>[];
  columns: ColumnDef[];
  emptyMessage?: string;
  onAdd?: (data: Record<string, unknown>) => Promise<void>;
  onUpdate?: (id: number, data: Record<string, unknown>) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  title?: string;
};

function formatValue(value: unknown, type?: string): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "有効" : "無効";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      if (value.includes("T") && type !== "date") {
        return date.toLocaleString("ja-JP");
      }
      return date.toLocaleDateString("ja-JP");
    }
  }
  return String(value);
}

function formatForInput(value: unknown, type?: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      if (type === "datetime") {
        return date.toISOString().slice(0, 16);
      }
      if (type === "date") {
        return date.toISOString().slice(0, 10);
      }
    }
  }
  return String(value);
}

export function CrudTable({
  data,
  columns,
  emptyMessage = "データがありません",
  onAdd,
  onUpdate,
  onDelete,
  title,
}: CrudTableProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [deleteItem, setDeleteItem] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);

  const editableColumns = columns.filter((col) => col.editable !== false && col.key !== "id");

  const handleAdd = async () => {
    if (!onAdd) return;
    setLoading(true);
    try {
      await onAdd(formData);
      toast.success("追加しました");
      setIsAddOpen(false);
      setFormData({});
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!onUpdate || !editItem) return;
    setLoading(true);
    try {
      await onUpdate(editItem.id as number, formData);
      toast.success("更新しました");
      setEditItem(null);
      setFormData({});
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !deleteItem) return;
    setLoading(true);
    try {
      await onDelete(deleteItem.id as number);
      toast.success("削除しました");
      setDeleteItem(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (item: Record<string, unknown>) => {
    setEditItem(item);
    const initialData: Record<string, unknown> = {};
    editableColumns.forEach((col) => {
      initialData[col.key] = item[col.key];
    });
    setFormData(initialData);
  };

  const openAddDialog = () => {
    setFormData({});
    setIsAddOpen(true);
  };

  const renderFormField = (col: ColumnDef) => {
    const value = formData[col.key];

    if (col.type === "select" && col.options) {
      return (
        <Select
          value={value != null ? String(value) : "__empty__"}
          onValueChange={(v) => setFormData({ ...formData, [col.key]: v === "__empty__" ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__">-</SelectItem>
            {col.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (col.type === "boolean") {
      return (
        <Select
          value={value === true ? "true" : value === false ? "false" : ""}
          onValueChange={(v) => setFormData({ ...formData, [col.key]: v === "true" })}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">有効</SelectItem>
            <SelectItem value="false">無効</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (col.type === "textarea") {
      return (
        <Textarea
          value={String(value ?? "")}
          onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value || null })}
          rows={3}
        />
      );
    }

    return (
      <Input
        type={col.type === "number" ? "number" : col.type === "date" ? "date" : col.type === "datetime" ? "datetime-local" : "text"}
        value={formatForInput(value, col.type)}
        onChange={(e) => {
          let newValue: unknown = e.target.value || null;
          if (col.type === "number" && e.target.value) {
            newValue = Number(e.target.value);
          }
          setFormData({ ...formData, [col.key]: newValue });
        }}
        required={col.required}
      />
    );
  };

  return (
    <div className="space-y-4">
      {onAdd && (
        <div className="flex justify-end">
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            新規追加
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className="whitespace-nowrap">
                  {col.header}
                </TableHead>
              ))}
              {(onUpdate || onDelete) && (
                <TableHead className="w-[100px]">操作</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (onUpdate || onDelete ? 1 : 0)}
                  className="text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow key={(item.id as number) || index}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className="whitespace-nowrap max-w-xs truncate">
                      {formatValue(item[col.key], col.type)}
                    </TableCell>
                  ))}
                  {(onUpdate || onDelete) && (
                    <TableCell>
                      <div className="flex gap-1">
                        {onUpdate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteItem(item)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title ? `${title}を追加` : "新規追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editableColumns.map((col) => (
              <div key={col.key} className="space-y-2">
                <Label>
                  {col.header}
                  {col.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {renderFormField(col)}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAdd} disabled={loading}>
              {loading ? "追加中..." : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title ? `${title}を編集` : "編集"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editableColumns.map((col) => (
              <div key={col.key} className="space-y-2">
                <Label>
                  {col.header}
                  {col.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {renderFormField(col)}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              キャンセル
            </Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>削除確認</DialogTitle>
          </DialogHeader>
          <p>このデータを削除しますか？この操作は取り消せません。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "削除中..." : "削除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
