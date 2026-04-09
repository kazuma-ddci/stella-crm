"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addMapping, updateMapping, deleteMapping } from "./actions";

type MappingRow = {
  id: number;
  briefingStaffName: string;
  lineFriendId: number | null;
  lineFriendLabel: string | null;
  staffId: number | null;
  staffName: string | null;
};

type Props = {
  data: MappingRow[];
  lineFriendOptions: { id: number; label: string }[];
  staffOptions: { id: number; name: string }[];
};

const UNSET = "__unset__";

export function BriefingStaffTable({ data, lineFriendOptions, staffOptions }: Props) {
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MappingRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formLineFriendId, setFormLineFriendId] = useState(UNSET);
  const [formStaffId, setFormStaffId] = useState(UNSET);
  const [pending, setPending] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormLineFriendId(UNSET);
    setFormStaffId(UNSET);
    setDialogOpen(true);
  };

  const openEdit = (row: MappingRow) => {
    setEditing(row);
    setFormName(row.briefingStaffName);
    setFormLineFriendId(row.lineFriendId?.toString() ?? UNSET);
    setFormStaffId(row.staffId?.toString() ?? UNSET);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("概要案内担当者名は必須です");
      return;
    }
    setPending(true);
    try {
      const payload = {
        briefingStaffName: formName,
        lineFriendId: formLineFriendId !== UNSET ? parseInt(formLineFriendId) : null,
        staffId: formStaffId !== UNSET ? parseInt(formStaffId) : null,
      };
      if (editing) {
        await updateMapping(editing.id, payload);
        toast.success("更新しました");
      } else {
        await addMapping(payload);
        toast.success("追加しました");
      }
      setDialogOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    try {
      await deleteMapping(id);
      toast.success("削除しました");
      router.refresh();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          追加
        </Button>
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>概要案内担当者名</TableHead>
              <TableHead>LINE名</TableHead>
              <TableHead>スタッフ</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  マッピングが登録されていません
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.briefingStaffName}</TableCell>
                  <TableCell>
                    {row.lineFriendLabel ?? <span className="text-muted-foreground">未設定</span>}
                  </TableCell>
                  <TableCell>
                    {row.staffName ?? <span className="text-muted-foreground">未設定</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "マッピングを編集" : "マッピングを追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>概要案内担当者名 *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="プロラインから送られてくる名前"
              />
            </div>
            <div>
              <Label>LINE名</Label>
              <Select value={formLineFriendId} onValueChange={setFormLineFriendId}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未選択</SelectItem>
                  {lineFriendOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>スタッフ</Label>
              <Select value={formStaffId} onValueChange={setFormStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>未選択</SelectItem>
                  {staffOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id.toString()}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                公的(SLP)に閲覧以上の権限を持つスタッフのみ表示されます
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={pending}>
              {pending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
