"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { X, Plus, Save, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AssignableFieldCode } from "@/lib/staff/assignable-fields";
import { saveFieldRestrictions } from "./actions";

type Props = {
  fields: { code: string; label: string }[];
  fieldData: Record<string, { sourceProjectIds: number[]; roleTypeIds: number[] }>;
  projectOptions: { value: number; label: string }[];
  roleTypeOptions: { value: number; label: string }[];
  canEdit: boolean;
  managingProjectId: number;
  fieldProjectMap: Record<string, number[]>;
};

export function FieldRestrictionsEditor({
  fields,
  fieldData,
  projectOptions,
  roleTypeOptions,
  canEdit,
  managingProjectId,
  fieldProjectMap,
}: Props) {
  const [editData, setEditData] = useState<
    Record<string, { sourceProjectIds: number[]; roleTypeIds: number[] }>
  >(JSON.parse(JSON.stringify(fieldData)));
  const [savingField, setSavingField] = useState<string | null>(null);

  // このPJに出現するフィールドのみ表示（出現設定がない場合は全フィールド表示）
  const visibleFields = fields.filter((f) => {
    const assignedProjects = fieldProjectMap[f.code];
    if (!assignedProjects || assignedProjects.length === 0) return true;
    return assignedProjects.includes(managingProjectId);
  });

  function hasChanged(code: string) {
    return JSON.stringify(editData[code]) !== JSON.stringify(fieldData[code]);
  }

  function addSourceProject(code: string, projectId: number) {
    setEditData((prev) => {
      const field = prev[code];
      if (field.sourceProjectIds.includes(projectId)) return prev;
      return {
        ...prev,
        [code]: { ...field, sourceProjectIds: [...field.sourceProjectIds, projectId] },
      };
    });
  }

  function removeSourceProject(code: string, projectId: number) {
    setEditData((prev) => {
      const field = prev[code];
      return {
        ...prev,
        [code]: {
          ...field,
          sourceProjectIds: field.sourceProjectIds.filter((id) => id !== projectId),
        },
      };
    });
  }

  function addRoleType(code: string, roleTypeId: number) {
    setEditData((prev) => {
      const field = prev[code];
      if (field.roleTypeIds.includes(roleTypeId)) return prev;
      return {
        ...prev,
        [code]: { ...field, roleTypeIds: [...field.roleTypeIds, roleTypeId] },
      };
    });
  }

  function removeRoleType(code: string, roleTypeId: number) {
    setEditData((prev) => {
      const field = prev[code];
      return {
        ...prev,
        [code]: {
          ...field,
          roleTypeIds: field.roleTypeIds.filter((id) => id !== roleTypeId),
        },
      };
    });
  }

  async function handleSave(code: string) {
    setSavingField(code);
    try {
      const fieldLabel = fields.find((f) => f.code === code)?.label ?? code;
      await saveFieldRestrictions(
        code as AssignableFieldCode,
        managingProjectId,
        editData[code].sourceProjectIds,
        editData[code].roleTypeIds,
      );
      toast.success(`${fieldLabel} の制約を保存しました`);
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSavingField(null);
    }
  }

  if (visibleFields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        このプロジェクトに割り当てられたフィールドはありません。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {visibleFields.map(({ code, label }) => {
        const field = editData[code];
        if (!field) return null;
        const changed = hasChanged(code);
        const isSaving = savingField === code;

        return (
          <div key={code} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{label}</h3>
              {canEdit && (
                <Button
                  size="sm"
                  disabled={!changed || isSaving}
                  onClick={() => handleSave(code)}
                >
                  {isSaving ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-4 w-4" />
                  )}
                  保存
                </Button>
              )}
            </div>

            {/* ソースプロジェクト制約（OR条件） */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">プロジェクトで絞り込み</p>
              <div className="flex flex-wrap items-center gap-1">
                {field.sourceProjectIds.map((id) => {
                  const opt = projectOptions.find((o) => o.value === id);
                  return (
                    <span
                      key={id}
                      className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-sm inline-flex items-center gap-1"
                    >
                      {opt?.label ?? id}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeSourceProject(code, id)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
                {canEdit && (
                  <MultiSelectPopover
                    options={projectOptions}
                    selectedIds={field.sourceProjectIds}
                    onSelect={(id) => addSourceProject(code, id)}
                    placeholder="プロジェクトを検索..."
                  />
                )}
                {field.sourceProjectIds.length === 0 && !canEdit && (
                  <span className="text-xs text-muted-foreground">制約なし</span>
                )}
              </div>
            </div>

            {/* 役割制約（OR条件） */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">役割で絞り込み</p>
              <div className="flex flex-wrap items-center gap-1">
                {field.roleTypeIds.map((id) => {
                  const opt = roleTypeOptions.find((o) => o.value === id);
                  return (
                    <span
                      key={id}
                      className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-sm inline-flex items-center gap-1"
                    >
                      {opt?.label ?? id}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeRoleType(code, id)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
                {canEdit && (
                  <MultiSelectPopover
                    options={roleTypeOptions}
                    selectedIds={field.roleTypeIds}
                    onSelect={(id) => addRoleType(code, id)}
                    placeholder="役割を検索..."
                  />
                )}
                {field.roleTypeIds.length === 0 && !canEdit && (
                  <span className="text-xs text-muted-foreground">制約なし</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MultiSelectPopover({
  options,
  selectedIds,
  onSelect,
  placeholder,
}: {
  options: { value: number; label: string }[];
  selectedIds: number[];
  onSelect: (id: number) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2">
          <Plus className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>該当なし</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selectedIds.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => {
                      if (!isSelected) {
                        onSelect(opt.value);
                      }
                      setOpen(false);
                    }}
                  >
                    {isSelected && <Check className="mr-2 h-4 w-4" />}
                    <span className={isSelected ? "text-muted-foreground" : ""}>
                      {opt.label}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
