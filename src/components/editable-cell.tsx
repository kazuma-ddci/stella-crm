"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

// 日本語ロケールを登録
registerLocale("ja", ja);

export type EditableCellType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "select"
  | "multiselect"
  | "textarea";

export type EditableCellOption = {
  value: string;
  label: string;
};

type EditableCellProps = {
  value: unknown;
  type: EditableCellType;
  options?: EditableCellOption[];
  searchable?: boolean;
  onSave: (newValue: unknown) => void;
  onCancel: () => void;
  disabled?: boolean;
};

export function EditableCell({
  value,
  type,
  options = [],
  searchable = false,
  onSave,
  onCancel,
  disabled = false,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState<unknown>(value);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus input on mount
  useEffect(() => {
    if (type === "text" || type === "number") {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (type === "textarea") {
      textareaRef.current?.focus();
    } else if (type === "select" || type === "multiselect") {
      setPopoverOpen(true);
    }
  }, [type]);

  // Cleanup: close popover on unmount to prevent orphaned popovers
  useEffect(() => {
    return () => {
      setPopoverOpen(false);
    };
  }, []);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Save on blur for text inputs
  const handleBlur = () => {
    if (type === "text" || type === "number" || type === "textarea") {
      // Check if value changed
      if (editValue !== value) {
        onSave(editValue);
      } else {
        onCancel();
      }
    }
  };

  // Handle enter key for text inputs
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea") {
      e.preventDefault();
      if (editValue !== value) {
        onSave(editValue);
      } else {
        onCancel();
      }
    }
  };

  if (disabled) {
    return null;
  }

  // Text input
  if (type === "text") {
    return (
      <Input
        ref={inputRef}
        type="text"
        value={String(editValue ?? "")}
        onChange={(e) => setEditValue(e.target.value || null)}
        onBlur={handleBlur}
        onKeyDown={handleInputKeyDown}
        className="h-8 min-w-[100px]"
      />
    );
  }

  // Number input
  if (type === "number") {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={editValue !== null && editValue !== undefined ? String(editValue) : ""}
        onChange={(e) => {
          const val = e.target.value;
          setEditValue(val ? Number(val) : null);
        }}
        onBlur={handleBlur}
        onKeyDown={handleInputKeyDown}
        className="h-8 min-w-[80px]"
      />
    );
  }

  // Textarea (popover)
  if (type === "textarea") {
    return (
      <Popover open={true} onOpenChange={(open) => !open && onCancel()}>
        <PopoverTrigger asChild>
          <div className="w-full h-8" />
        </PopoverTrigger>
        <PopoverContent className="w-[90vw] sm:w-[400px] max-w-[400px] p-2" align="start">
          <Textarea
            ref={textareaRef}
            value={String(editValue ?? "")}
            onChange={(e) => setEditValue(e.target.value || null)}
            rows={8}
            className="resize-none min-h-[180px] max-h-[300px] overflow-y-auto"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={onCancel}>
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (editValue !== value) {
                  onSave(editValue);
                } else {
                  onCancel();
                }
              }}
            >
              確定
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Date picker
  if (type === "date" || type === "datetime") {
    const dateValue = editValue ? new Date(editValue as string) : null;
    return (
      <Popover open={true} onOpenChange={(open) => !open && onCancel()}>
        <PopoverTrigger asChild>
          <div className="w-full h-8" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <DatePicker
            selected={dateValue}
            onChange={(date: Date | null) => {
              const newValue = date ? date.toISOString() : null;
              setEditValue(newValue);
            }}
            showTimeSelect={type === "datetime"}
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat={type === "datetime" ? "yyyy/MM/dd HH:mm" : "yyyy/MM/dd"}
            locale="ja"
            placeholderText={type === "date" ? "日付を選択" : "日時を選択"}
            isClearable
            inline
            className="w-full"
          />
          <div className="flex justify-end gap-2 mt-2 border-t pt-2">
            <Button size="sm" variant="outline" onClick={onCancel}>
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (editValue !== value) {
                  onSave(editValue);
                } else {
                  onCancel();
                }
              }}
            >
              確定
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Select (searchable or regular)
  if (type === "select") {
    if (searchable) {
      const selectedOption = options.find((opt) => opt.value === String(editValue));
      return (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="h-8 min-w-[150px] justify-between"
            >
              {selectedOption ? selectedOption.label : "選択..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <Command>
              <CommandInput placeholder="検索..." />
              <CommandList maxHeight={200}>
                <CommandEmpty>見つかりませんでした</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__empty__"
                    onSelect={() => {
                      if (value !== null) {
                        onSave(null);
                      } else {
                        onCancel();
                      }
                      setPopoverOpen(false);
                    }}
                  >
                    -
                  </CommandItem>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => {
                        if (opt.value !== String(value)) {
                          onSave(opt.value);
                        } else {
                          onCancel();
                        }
                        setPopoverOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          String(editValue) === opt.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      );
    }

    // Regular select
    return (
      <Select
        value={editValue != null ? String(editValue) : "__empty__"}
        onValueChange={(v) => {
          const newValue = v === "__empty__" ? null : v;
          if (newValue !== value) {
            onSave(newValue);
          } else {
            onCancel();
          }
        }}
        open={true}
        onOpenChange={(open) => !open && onCancel()}
      >
        <SelectTrigger className="h-8 min-w-[120px]">
          <SelectValue placeholder="選択..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">-</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Multiselect
  if (type === "multiselect") {
    // Parse current value to array
    let selectedValues: string[] = [];
    if (Array.isArray(editValue)) {
      selectedValues = editValue as string[];
    } else if (typeof editValue === "string" && editValue) {
      selectedValues = editValue.split(",").map((v) => v.trim()).filter((v) => v);
    }

    const toggleValue = (optValue: string) => {
      const newValues = selectedValues.includes(optValue)
        ? selectedValues.filter((v) => v !== optValue)
        : [...selectedValues, optValue];
      setEditValue(newValues);
    };

    const handleConfirm = () => {
      // Compare arrays
      const originalValues = Array.isArray(value)
        ? (value as string[])
        : typeof value === "string" && value
          ? value.split(",").map((v) => v.trim()).filter((v) => v)
          : [];

      const changed =
        selectedValues.length !== originalValues.length ||
        selectedValues.some((v) => !originalValues.includes(v));

      if (changed) {
        onSave(selectedValues);
      } else {
        onCancel();
      }
    };

    // 選択された値のラベルを取得
    const getSelectedLabels = () => {
      if (selectedValues.length === 0) return "選択...";
      return selectedValues
        .map((v) => options.find((o) => o.value === v)?.label || v)
        .join(", ");
    };

    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="h-8 min-w-[150px] justify-between"
          >
            <span className="truncate max-w-[200px]">
              {getSelectedLabels()}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="検索..." />
            <CommandList maxHeight={200}>
              <CommandEmpty>見つかりませんでした</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => {
                  const isSelected = selectedValues.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => toggleValue(opt.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="flex justify-between items-center p-2 border-t">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditValue([])}
            >
              <X className="h-4 w-4 mr-1" />
              クリア
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onCancel}>
                キャンセル
              </Button>
              <Button size="sm" onClick={handleConfirm}>
                確定
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return null;
}

// Helper to format value for display
export function formatDisplayValue(
  value: unknown,
  type: EditableCellType,
  options?: EditableCellOption[]
): string {
  if (value === null || value === undefined) return "-";

  if (type === "select" && options) {
    const opt = options.find((o) => o.value === String(value));
    return opt?.label || String(value);
  }

  if (type === "multiselect" && options) {
    let values: string[] = [];
    if (Array.isArray(value)) {
      values = value as string[];
    } else if (typeof value === "string" && value) {
      values = value.split(",").map((v) => v.trim()).filter((v) => v);
    }
    if (values.length === 0) return "-";
    return values
      .map((v) => {
        const opt = options.find((o) => o.value === v);
        return opt?.label || v;
      })
      .join(", ");
  }

  if (type === "date" && typeof value === "string") {
    try {
      return new Date(value).toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
      });
    } catch {
      return String(value);
    }
  }

  if (type === "datetime" && typeof value === "string") {
    try {
      return new Date(value).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      });
    } catch {
      return String(value);
    }
  }

  return String(value);
}
