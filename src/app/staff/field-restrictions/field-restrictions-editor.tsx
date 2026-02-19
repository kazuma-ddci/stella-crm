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
import { ASSIGNABLE_FIELDS, type AssignableFieldCode } from "@/lib/staff/assignable-fields";
import { saveFieldRestrictions } from "./actions";

type Props = {
  fieldData: Record<string, { projectIds: number[]; roleTypeIds: number[] }>;
  projectOptions: { value: number; label: string }[];
  roleTypeOptions: { value: number; label: string }[];
  canEdit: boolean;
};

export function FieldRestrictionsEditor({
  fieldData,
  projectOptions,
  roleTypeOptions,
  canEdit,
}: Props) {
  const [editData, setEditData] = useState<
    Record<string, { projectIds: number[]; roleTypeIds: number[] }>
  >(JSON.parse(JSON.stringify(fieldData)));
  const [savingField, setSavingField] = useState<string | null>(null);

  const fieldCodes = Object.keys(ASSIGNABLE_FIELDS) as AssignableFieldCode[];

  function hasChanged(code: string) {
    return JSON.stringify(editData[code]) !== JSON.stringify(fieldData[code]);
  }

  function addProject(code: string, projectId: number) {
    setEditData((prev) => {
      const field = prev[code];
      if (field.projectIds.includes(projectId)) return prev;
      return {
        ...prev,
        [code]: { ...field, projectIds: [...field.projectIds, projectId] },
      };
    });
  }

  function removeProject(code: string, projectId: number) {
    setEditData((prev) => {
      const field = prev[code];
      return {
        ...prev,
        [code]: {
          ...field,
          projectIds: field.projectIds.filter((id) => id !== projectId),
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

  async function handleSave(code: AssignableFieldCode) {
    setSavingField(code);
    try {
      await saveFieldRestrictions(
        code,
        editData[code].projectIds,
        editData[code].roleTypeIds,
      );
      toast.success(`${ASSIGNABLE_FIELDS[code].label} の制約を保存しました`);
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSavingField(null);
    }
  }

  return (
    <div className="space-y-4">
      {fieldCodes.map((code) => {
        const field = editData[code];
        const label = ASSIGNABLE_FIELDS[code].label;
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

            {/* プロジェクト制約 */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">プロジェクト制約</p>
              <div className="flex flex-wrap items-center gap-1">
                {field.projectIds.map((id) => {
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
                          onClick={() => removeProject(code, id)}
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
                    selectedIds={field.projectIds}
                    onSelect={(id) => addProject(code, id)}
                    placeholder="プロジェクトを検索..."
                  />
                )}
                {field.projectIds.length === 0 && !canEdit && (
                  <span className="text-xs text-muted-foreground">制約なし</span>
                )}
              </div>
            </div>

            {/* 役割制約 */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">役割制約</p>
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
