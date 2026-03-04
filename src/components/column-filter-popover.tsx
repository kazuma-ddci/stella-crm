"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  allValues: string[];
  selectedValues: Set<string> | undefined;
  onFilterChange: (values: Set<string>) => void;
};

const EMPTY_LABEL = "（空白）";

function displayLabel(val: string) {
  return val === "" ? EMPTY_LABEL : val;
}

export function ColumnFilterPopover({ allValues, selectedValues, onFilterChange }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const isActive = selectedValues != null && selectedValues.size > 0;

  const filteredValues = search
    ? allValues.filter((v) =>
        displayLabel(v).toLowerCase().includes(search.toLowerCase())
      )
    : allValues;

  const toggleValue = (val: string) => {
    const next = new Set(selectedValues ?? []);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    onFilterChange(next);
  };

  const selectAll = () => {
    onFilterChange(new Set(allValues));
  };

  const clearAll = () => {
    onFilterChange(new Set());
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 hover:text-blue-600 transition-colors",
            isActive && "text-blue-600"
          )}
        >
          <ListFilter className={cn("h-3.5 w-3.5", isActive ? "fill-blue-600/20" : "")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="flex flex-col max-h-[350px]">
          <div className="p-3 pb-2 space-y-2 shrink-0">
            <Input
              placeholder="検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={selectAll}>
                全選択
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={clearAll}>
                クリア
              </Button>
            </div>
          </div>
          <div className="overflow-y-auto px-3 pb-3 space-y-1">
            {filteredValues.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">該当なし</p>
            ) : (
              filteredValues.map((val) => {
                const checked = selectedValues?.has(val) ?? false;
                return (
                  <label
                    key={val === "" ? "__empty__" : val}
                    className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleValue(val)}
                    />
                    <span className={cn("truncate", val === "" && "text-muted-foreground italic")}>
                      {displayLabel(val)}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
