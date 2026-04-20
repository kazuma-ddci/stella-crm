"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Video } from "lucide-react";
import { toast } from "sonner";
import { listZoomLinkedStaffsForHojo } from "./zoom-actions";

export type ZoomAddEntry = {
  zoomUrl: string;
  hostStaffId: string;
  mode: "fetch_now" | "scheduled";
  label: string;
};

function emptyEntry(): ZoomAddEntry {
  return { zoomUrl: "", hostStaffId: "", mode: "fetch_now", label: "" };
}

export function ZoomEntriesForAdd({
  entries,
  onChange,
}: {
  entries: ZoomAddEntry[];
  onChange: (entries: ZoomAddEntry[]) => void;
}) {
  const [staffOptions, setStaffOptions] = useState<
    { id: number; name: string }[]
  >([]);
  const [staffsLoaded, setStaffsLoaded] = useState(false);

  useEffect(() => {
    if (entries.length === 0) return;
    if (staffsLoaded) return;
    let cancelled = false;
    listZoomLinkedStaffsForHojo().then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setStaffOptions(r.data);
      } else {
        toast.error(r.error);
      }
      setStaffsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [entries.length, staffsLoaded]);

  const updateEntry = (index: number, patch: Partial<ZoomAddEntry>) => {
    const next = entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
    onChange(next);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const addEntry = () => {
    onChange([...entries, emptyEntry()]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-blue-500" />
        <Label className="mb-0">Zoom議事録連携（任意）</Label>
      </div>

      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">
          必要な場合のみ Zoom URL を登録できます。複数追加可。
        </p>
      )}

      {entries.map((entry, i) => (
        <div
          key={i}
          className="rounded-lg border p-3 bg-muted/30 space-y-2 relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Zoom #{i + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
              onClick={() => removeEntry(i)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Zoom URL</Label>
            <Input
              type="url"
              value={entry.zoomUrl}
              onChange={(e) => updateEntry(i, { zoomUrl: e.target.value })}
              placeholder="https://zoom.us/j/..."
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">ホストスタッフ</Label>
              <Select
                value={entry.hostStaffId}
                onValueChange={(v) => updateEntry(i, { hostStaffId: v })}
                disabled={!staffsLoaded || staffOptions.length === 0}
              >
                <SelectTrigger className="text-sm h-9">
                  <SelectValue
                    placeholder={
                      !staffsLoaded
                        ? "読み込み中..."
                        : staffOptions.length === 0
                        ? "Zoom連携済みスタッフなし"
                        : "選択"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">ラベル（任意）</Label>
              <Input
                value={entry.label}
                onChange={(e) => updateEntry(i, { label: e.target.value })}
                placeholder="例: 延長分"
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">このZoomは</Label>
            <div className="flex gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name={`mode-${i}`}
                  value="fetch_now"
                  checked={entry.mode === "fetch_now"}
                  onChange={() => updateEntry(i, { mode: "fetch_now" })}
                />
                <span>実施済み（今すぐ取得）</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name={`mode-${i}`}
                  value="scheduled"
                  checked={entry.mode === "scheduled"}
                  onChange={() => updateEntry(i, { mode: "scheduled" })}
                />
                <span>未実施（予定）</span>
              </label>
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addEntry}
        className="text-xs h-8"
      >
        <Plus className="h-3 w-3 mr-1" />
        Zoom議事録連携を追加
      </Button>
    </div>
  );
}
