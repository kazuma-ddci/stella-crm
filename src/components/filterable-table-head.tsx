"use client";

import { TableHead } from "@/components/ui/table";
import { ColumnFilterPopover } from "@/components/column-filter-popover";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  filterKey: string;
  allValues: string[];
  selectedValues: Set<string> | undefined;
  onFilterChange: (key: string, values: Set<string>) => void;
  className?: string;
};

export function FilterableTableHead({
  label,
  filterKey,
  allValues,
  selectedValues,
  onFilterChange,
  className,
}: Props) {
  return (
    <TableHead className={cn("whitespace-nowrap", className)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ColumnFilterPopover
          allValues={allValues}
          selectedValues={selectedValues}
          onFilterChange={(values) => onFilterChange(filterKey, values)}
        />
      </span>
    </TableHead>
  );
}
