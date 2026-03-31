"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type InlineCellType = "text" | "number" | "date" | "textarea" | "select";

export type InlineCellOption = {
  value: string;
  label: string;
};

type InlineCellProps = {
  value: string;
  onSave: (v: string) => void;
  type?: InlineCellType;
  options?: InlineCellOption[];
  children: React.ReactNode;
};

export function InlineCell({ value, onSave, type = "text", options, children }: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // InlineCell内のクリックは無視
      if (ref.current && ref.current.contains(target)) return;
      // Radix Popover/Select等のportal内クリックは無視
      const el = target as Element;
      if (
        el.closest?.("[data-radix-popper-content-wrapper]") ||
        el.closest?.("[data-radix-select-viewport]") ||
        el.closest?.("[role='listbox']") ||
        el.closest?.("[role='option']")
      ) return;
      setEditing(false);
      if (editValue !== value) onSave(editValue);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing, editValue, value, onSave]);

  if (!editing) {
    return (
      <div
        className="cursor-pointer hover:bg-blue-50 rounded px-1 -mx-1 min-h-[24px]"
        onClick={() => { setEditValue(value); setEditing(true); }}
      >
        {children}
      </div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea") { setEditing(false); onSave(editValue); }
    if (e.key === "Escape") { setEditing(false); setEditValue(value); }
  };

  return (
    <div ref={ref}>
      {type === "date" ? (
        <DatePicker value={editValue} onChange={(v) => { setEditValue(v); onSave(v); setEditing(false); }} />
      ) : type === "select" && options ? (
        <Select value={editValue || "__empty"} onValueChange={(v) => { const val = v === "__empty" ? "" : v; setEditValue(val); onSave(val); setEditing(false); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value || "__empty"} value={o.value || "__empty"}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : type === "textarea" ? (
        <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown} rows={2} autoFocus className="min-w-[120px]" />
      ) : (
        <Input type={type} value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown} autoFocus className="w-full" />
      )}
    </div>
  );
}
