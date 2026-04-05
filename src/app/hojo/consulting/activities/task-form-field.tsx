"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Check, X as XIcon } from "lucide-react";

export type TaskFormValue = {
  id?: number; // DB上のID（編集の場合）、新規追加分はundefined or 負の値
  taskType: "vendor" | "consulting_team";
  content: string;
  deadline: string;
  priority: string;
  completed: boolean;
};

type Props = {
  value: TaskFormValue[];
  onChange: (tasks: TaskFormValue[]) => void;
};

const priorityOptions = ["高", "中", "低"];

export function TaskFormField({ value, onChange }: Props) {
  const tasks = Array.isArray(value) ? value : [];
  const vendorTasks = tasks.filter((t) => t.taskType === "vendor");
  const teamTasks = tasks.filter((t) => t.taskType === "consulting_team");

  const updateTask = (updated: TaskFormValue, originalIdx: number) => {
    const next = [...tasks];
    // 実際のインデックスを見つける
    let counter = -1;
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].taskType === updated.taskType) {
        counter++;
        if (counter === originalIdx) {
          next[i] = updated;
          break;
        }
      }
    }
    onChange(next);
  };

  const removeTask = (taskType: "vendor" | "consulting_team", idx: number) => {
    let counter = -1;
    const next = tasks.filter((t) => {
      if (t.taskType === taskType) {
        counter++;
        return counter !== idx;
      }
      return true;
    });
    onChange(next);
  };

  const addTask = (taskType: "vendor" | "consulting_team", task: Omit<TaskFormValue, "taskType">) => {
    onChange([...tasks, { ...task, taskType }]);
  };

  return (
    <div className="space-y-4 border rounded-lg p-3 bg-gray-50/50">
      <TaskGroup
        title="ベンダー様タスク"
        tasks={vendorTasks}
        onAdd={(t) => addTask("vendor", t)}
        onUpdate={(t, idx) => updateTask(t, idx)}
        onRemove={(idx) => removeTask("vendor", idx)}
      />
      <div className="border-t" />
      <TaskGroup
        title="コンサルチームタスク"
        tasks={teamTasks}
        onAdd={(t) => addTask("consulting_team", t)}
        onUpdate={(t, idx) => updateTask(t, idx)}
        onRemove={(idx) => removeTask("consulting_team", idx)}
      />
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  tasks: TaskFormValue[];
  onAdd: (task: Omit<TaskFormValue, "taskType">) => void;
  onUpdate: (task: TaskFormValue, idx: number) => void;
  onRemove: (idx: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState({ content: "", deadline: "", priority: "", completed: false });

  const handleAdd = () => {
    if (!newTask.content.trim()) {
      alert("内容を入力してください");
      return;
    }
    onAdd(newTask);
    setNewTask({ content: "", deadline: "", priority: "", completed: false });
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">{title}</h4>
        {!adding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            className="gap-1 h-7"
          >
            <Plus className="h-3 w-3" />
            追加
          </Button>
        )}
      </div>

      {tasks.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-2">タスクがありません</p>
      )}

      <div className="space-y-1.5">
        {tasks.map((task, idx) => (
          <TaskRow
            key={idx}
            task={task}
            onUpdate={(t) => onUpdate(t, idx)}
            onRemove={() => onRemove(idx)}
          />
        ))}
      </div>

      {adding && (
        <div className="border rounded-md p-2 space-y-2 bg-white">
          <div className="space-y-1">
            <Label className="text-xs">内容</Label>
            <Textarea
              value={newTask.content}
              onChange={(e) => setNewTask({ ...newTask, content: e.target.value })}
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">期限</Label>
              <Input
                type="date"
                value={newTask.deadline}
                onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">優先度</Label>
              <Select
                value={newTask.priority || "none"}
                onValueChange={(v) => setNewTask({ ...newTask, priority: v === "none" ? "" : v })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {priorityOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">完了</Label>
              <Select
                value={newTask.completed ? "true" : "false"}
                onValueChange={(v) => setNewTask({ ...newTask, completed: v === "true" })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">未完了</SelectItem>
                  <SelectItem value="true">完了</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setNewTask({ content: "", deadline: "", priority: "", completed: false }); }}>
              キャンセル
            </Button>
            <Button type="button" size="sm" onClick={handleAdd}>
              追加
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onUpdate,
  onRemove,
}: {
  task: TaskFormValue;
  onUpdate: (task: TaskFormValue) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(task);

  const priorityColor = task.priority === "高" ? "bg-red-50 text-red-700" : task.priority === "中" ? "bg-amber-50 text-amber-700" : task.priority === "低" ? "bg-gray-100 text-gray-600" : "";

  if (editing) {
    return (
      <div className="border rounded-md p-2 space-y-2 bg-blue-50/30">
        <Textarea
          value={editData.content}
          onChange={(e) => setEditData({ ...editData, content: e.target.value })}
          rows={2}
          className="text-sm"
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="date"
            value={editData.deadline}
            onChange={(e) => setEditData({ ...editData, deadline: e.target.value })}
            className="h-8 text-sm"
          />
          <Select
            value={editData.priority || "none"}
            onValueChange={(v) => setEditData({ ...editData, priority: v === "none" ? "" : v })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="-" />
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
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">未完了</SelectItem>
              <SelectItem value="true">完了</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditing(false); setEditData(task); }}>
            <XIcon className="h-3 w-3" />
          </Button>
          <Button type="button" size="sm" className="h-7 w-7 p-0" onClick={() => { onUpdate(editData); setEditing(false); }}>
            <Check className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-md p-2 flex items-start justify-between gap-2 ${task.completed ? "bg-gray-50 opacity-70" : "bg-white"}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm whitespace-pre-wrap ${task.completed ? "line-through text-gray-500" : ""}`}>
          {task.content || "（内容なし）"}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
          {task.deadline && <span className="text-gray-500">期限: {task.deadline.replace(/-/g, "/")}</span>}
          {task.priority && <span className={`px-1.5 py-0.5 rounded font-medium ${priorityColor}`}>{task.priority}</span>}
          {task.completed && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">完了</span>}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditData(task); setEditing(true); }}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={onRemove}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
