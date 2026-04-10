"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { InlineCell } from "@/components/inline-cell";
import {
  addLoanProgressStatus,
  updateLoanProgressStatus,
  deleteLoanProgressStatus,
} from "./actions";

type Status = {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

type Props = {
  statuses: Status[];
};

export function StatusManagement({ statuses }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Status | null>(null);

  const handleAdd = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await addLoanProgressStatus(newName.trim());
      if (!result.ok) { alert(result.error); return; }
      setNewName("");
      setAddOpen(false);
      router.refresh();
    });
  };

  const handleUpdateName = (id: number, name: string) => {
    startTransition(async () => {
      const result = await updateLoanProgressStatus(id, { name });
      if (!result.ok) { alert(result.error); return; }
      router.refresh();
    });
  };

  const handleToggleActive = (id: number, isActive: boolean) => {
    startTransition(async () => {
      const result = await updateLoanProgressStatus(id, { isActive });
      if (!result.ok) { alert(result.error); return; }
      router.refresh();
    });
  };

  const handleDelete = (status: Status) => {
    setDeleteTarget(status);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteLoanProgressStatus(deleteTarget.id);
      if (!result.ok) {
        alert(result.error);
        setDeleteTarget(null);
        return;
      }
      router.refresh();
      setDeleteTarget(null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/hojo/loan-progress"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          顧客進捗状況に戻る
        </Link>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          新規追加
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">表示順</TableHead>
              <TableHead>名前</TableHead>
              <TableHead className="w-20">有効</TableHead>
              <TableHead className="w-20">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  ステータスが登録されていません
                </TableCell>
              </TableRow>
            ) : (
              statuses.map((status) => (
                <TableRow key={status.id} className="group/row">
                  <TableCell className="text-muted-foreground">
                    {status.displayOrder}
                  </TableCell>
                  <TableCell>
                    <InlineCell
                      value={status.name}
                      onSave={(v) => handleUpdateName(status.id, v)}
                    >
                      {status.name}
                    </InlineCell>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={status.isActive}
                      onCheckedChange={(checked) =>
                        handleToggleActive(status.id, checked)
                      }
                      disabled={isPending}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(status)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 新規追加ダイアログ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ステータスを追加</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="ステータス名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || isPending}>
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ステータスを削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除しますか？使用中のステータスは削除できません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
