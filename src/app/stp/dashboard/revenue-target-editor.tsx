"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAnnualRevenueTarget } from "./actions";

export function RevenueTargetEditor({
  currentTarget,
}: {
  currentTarget: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentTarget));
  const [isPending, startTransition] = useTransition();

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("ja-JP").format(v);

  const handleSave = () => {
    const numValue = parseInt(value.replace(/,/g, ""), 10);
    if (isNaN(numValue) || numValue <= 0) return;
    startTransition(async () => {
      await updateAnnualRevenueTarget(numValue);
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1">
        ¥{formatCurrency(currentTarget)}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => {
            setValue(String(currentTarget));
            setEditing(true);
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      ¥
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-6 w-28 text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
        disabled={isPending}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-green-600"
        onClick={handleSave}
        disabled={isPending}
      >
        <Check className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-red-500"
        onClick={() => setEditing(false)}
        disabled={isPending}
      >
        <X className="h-3 w-3" />
      </Button>
    </span>
  );
}
