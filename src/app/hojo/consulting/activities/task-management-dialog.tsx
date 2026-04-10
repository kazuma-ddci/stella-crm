"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Check, X as XIcon } from "lucide-react";
import {
  addActivityTask,
  updateActivityTask,
  deleteActivityTask,
} from "./actions";

export type TaskRecord = {
  id: number;
  taskType: "vendor" | "consulting_team";
  content: string;
  deadline: string; // YYYY-MM-DD or ""
  priority: string;
  completed: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: number;
  activityLabel?: string; // e.g. "2026/04/05 - ベンダーX"
  tasks: TaskRecord[];
  showConsultingTeam?: boolean; // コンサルチームタスクを表示するか (ベンダー側ではfalse)
  vendorTasksEditable?: boolean;
  consultingTeamTasksEditable?: boolean;
  vendorIdForPermCheck?: number; // ベンダー側から呼ぶとき
};

const priorityOptions = ["高", "中", "低"];

export function TaskManagementDialog({
  open,
  onOpenChange,
  activityId,
  activityLabel,
  tasks,
  showConsultingTeam = true,
  vendorTasksEditable = true,
  consultingTeamTasksEditable = true,
  vendorIdForPermCheck,
}: Props) {
  const router = useRouter();

  const vendorTasks = tasks.filter((t) => t.taskType === "vendor");
  const consultingTasks = tasks.filter((t) => t.taskType === "consulting_team");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>タスク管理</DialogTitle>
          {activityLabel && (
            <p className="text-sm text-muted-foreground">{activityLabel}</p>
          )}
        </DialogHeader>

        <div className="space-y-6 py-2">
          <TaskGroup
            title="ベンダー様タスク"
            taskType="vendor"
            activityId={activityId}
            tasks={vendorTasks}
            editable={vendorTasksEditable}
            vendorIdForPermCheck={vendorIdForPermCheck}
            onRefresh={() => router.refresh()}
          />

          {showConsultingTeam && (
            <TaskGroup
              title="コンサルチームタスク"
              taskType="consulting_team"
              activityId={activityId}
              tasks={consultingTasks}
              editable={consultingTeamTasksEditable}
              vendorIdForPermCheck={vendorIdForPermCheck}
              onRefresh={() => router.refresh()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskGroup({
  title,
  taskType,
  activityId,
  tasks,
  editable,
  vendorIdForPermCheck,
  onRefresh,
}: {
  title: string;
  taskType: "vendor" | "consulting_team";
  activityId: number;
  tasks: TaskRecord[];
  editable: boolean;
  vendorIdForPermCheck?: number;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState({ content: "", deadline: "", priority: "", completed: false });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newTask.content.trim()) {
      alert("内容を入力してください");
      return;
    }
    setSaving(true);
    try {
      const result = await addActivityTask(activityId, taskType, newTask, vendorIdForPermCheck);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setNewTask({ content: "", deadline: "", priority: "", completed: false });
      setAdding(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="font-semibold text-base">{title}</h3>
        {editable && !adding && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            className="gap-1"
          >
            <Plus className="h-3 w-3" />
            追加
          </Button>
        )}
      </div>

      {tasks.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground text-center py-3">
          タスクがありません
        </p>
      )}

      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            editable={editable}
            vendorIdForPermCheck={vendorIdForPermCheck}
            onRefresh={onRefresh}
          />
        ))}
      </div>

      {adding && (
        <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
          <div className="space-y-1">
            <Label className="text-xs">内容</Label>
            <Textarea
              value={newTask.content}
              onChange={(e) => setNewTask({ ...newTask, content: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">期限</Label>
              <Input
                type="date"
                value={newTask.deadline}
                onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">優先度</Label>
              <Select
                value={newTask.priority || "none"}
                onValueChange={(v) => setNewTask({ ...newTask, priority: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {priorityOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">完了</Label>
              <Select
                value={newTask.completed ? "true" : "false"}
                onValueChange={(v) => setNewTask({ ...newTask, completed: v === "true" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">未完了</SelectItem>
                  <SelectItem value="true">完了</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setAdding(false); setNewTask({ content: "", deadline: "", priority: "", completed: false }); }}>
              キャンセル
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? "追加中..." : "追加"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  editable,
  vendorIdForPermCheck,
  onRefresh,
}: {
  task: TaskRecord;
  editable: boolean;
  vendorIdForPermCheck?: number;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    content: task.content,
    deadline: task.deadline,
    priority: task.priority,
    completed: task.completed,
  });
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEditData({
      content: task.content,
      deadline: task.deadline,
      priority: task.priority,
      completed: task.completed,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateActivityTask(task.id, editData, vendorIdForPermCheck);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setEditing(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("このタスクを削除しますか？")) return;
    const result = await deleteActivityTask(task.id, vendorIdForPermCheck);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    onRefresh();
  };

  const priorityColor = task.priority === "高" ? "bg-red-50 text-red-700" : task.priority === "中" ? "bg-amber-50 text-amber-700" : task.priority === "低" ? "bg-gray-100 text-gray-600" : "";

  if (editing) {
    return (
      <div className="border rounded-lg p-3 space-y-2 bg-blue-50/30">
        <Textarea
          value={editData.content}
          onChange={(e) => setEditData({ ...editData, content: e.target.value })}
          rows={2}
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="date"
            value={editData.deadline}
            onChange={(e) => setEditData({ ...editData, deadline: e.target.value })}
          />
          <Select
            value={editData.priority || "none"}
            onValueChange={(v) => setEditData({ ...editData, priority: v === "none" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="優先度" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-</SelectItem>
              {priorityOptions.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={editData.completed ? "true" : "false"}
            onValueChange={(v) => setEditData({ ...editData, completed: v === "true" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">未完了</SelectItem>
              <SelectItem value="true">完了</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
            <XIcon className="h-3 w-3" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Check className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 ${task.completed ? "bg-gray-50 opacity-70" : "bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm whitespace-pre-wrap ${task.completed ? "line-through text-gray-500" : ""}`}>
            {task.content || "（内容なし）"}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
            {task.deadline && (
              <span className="text-gray-500">期限: {task.deadline.replace(/-/g, "/")}</span>
            )}
            {task.priority && (
              <span className={`px-1.5 py-0.5 rounded font-medium ${priorityColor}`}>
                {task.priority}
              </span>
            )}
            {task.completed ? (
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">完了</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">未完了</span>
            )}
          </div>
        </div>
        {editable && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={startEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={handleDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
