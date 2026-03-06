"use client";

import { useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { updateFieldDefinitionProjects } from "./actions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type FieldDef = {
  id: number;
  fieldCode: string;
  fieldName: string;
  linkedProjectIds: number[];
};

type Project = {
  id: number;
  name: string;
};

type Props = {
  fieldDefinitions: FieldDef[];
  projects: Project[];
  canEdit: boolean;
};

export function FieldDefinitionsTable({
  fieldDefinitions,
  projects,
  canEdit,
}: Props) {
  // 行ごとのチェック状態: fieldDefId -> Set<projectId>
  const [checkedState, setCheckedState] = useState<Record<number, Set<number>>>(
    () => {
      const state: Record<number, Set<number>> = {};
      for (const fd of fieldDefinitions) {
        state[fd.id] = new Set(fd.linkedProjectIds);
      }
      return state;
    },
  );

  // 保存済み状態（変更検知用）
  const [savedState] = useState<Record<number, Set<number>>>(() => {
    const state: Record<number, Set<number>> = {};
    for (const fd of fieldDefinitions) {
      state[fd.id] = new Set(fd.linkedProjectIds);
    }
    return state;
  });

  // 保存中の行
  const [savingRows, setSavingRows] = useState<Set<number>>(new Set());

  const hasChanged = useCallback(
    (fieldDefId: number) => {
      const current = checkedState[fieldDefId];
      const saved = savedState[fieldDefId];
      if (!current || !saved) return false;
      if (current.size !== saved.size) return true;
      for (const id of current) {
        if (!saved.has(id)) return true;
      }
      return false;
    },
    [checkedState, savedState],
  );

  const handleToggle = (fieldDefId: number, projectId: number) => {
    setCheckedState((prev) => {
      const next = { ...prev };
      const set = new Set(next[fieldDefId]);
      if (set.has(projectId)) {
        set.delete(projectId);
      } else {
        set.add(projectId);
      }
      next[fieldDefId] = set;
      return next;
    });
  };

  const handleSave = async (fieldDefId: number) => {
    setSavingRows((prev) => new Set(prev).add(fieldDefId));
    try {
      const projectIds = Array.from(checkedState[fieldDefId] ?? []);
      await updateFieldDefinitionProjects(fieldDefId, projectIds);
      // 保存成功: savedStateを更新
      savedState[fieldDefId] = new Set(projectIds);
      toast.success("保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSavingRows((prev) => {
        const next = new Set(prev);
        next.delete(fieldDefId);
        return next;
      });
    }
  };

  return (
    <div className="border rounded-lg overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px] sticky left-0 z-20 bg-white">
              フィールド名
            </TableHead>
            {projects.map((p) => (
              <TableHead key={p.id} className="text-center min-w-[80px]">
                {p.name}
              </TableHead>
            ))}
            {canEdit && (
              <TableHead className="text-center min-w-[80px] sticky right-0 z-20 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                操作
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {fieldDefinitions.map((fd) => {
            const changed = hasChanged(fd.id);
            const saving = savingRows.has(fd.id);
            return (
              <TableRow key={fd.id} className="group/row">
                <TableCell className="font-medium sticky left-0 z-10 bg-white group-hover/row:bg-gray-50">
                  <div>
                    <div>{fd.fieldName}</div>
                    <div className="text-xs text-muted-foreground">
                      {fd.fieldCode}
                    </div>
                  </div>
                </TableCell>
                {projects.map((p) => (
                  <TableCell key={p.id} className="text-center">
                    <Checkbox
                      checked={checkedState[fd.id]?.has(p.id) ?? false}
                      onCheckedChange={() => handleToggle(fd.id, p.id)}
                      disabled={!canEdit || saving}
                    />
                  </TableCell>
                ))}
                {canEdit && (
                  <TableCell className="text-center sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    <Button
                      size="sm"
                      variant={changed ? "default" : "outline"}
                      disabled={!changed || saving}
                      onClick={() => handleSave(fd.id)}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "保存"
                      )}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
