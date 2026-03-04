"use client";

import { useState, useMemo, useCallback } from "react";

type Filters = Record<string, Set<string>>;

function naturalCompare(a: string, b: string): number {
  const re = /(\d+|\D+)/g;
  const aParts = a.match(re) || [];
  const bParts = b.match(re) || [];
  const len = Math.min(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aNum = Number(aParts[i]);
    const bNum = Number(bParts[i]);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      if (aParts[i] < bParts[i]) return -1;
      if (aParts[i] > bParts[i]) return 1;
    }
  }
  return aParts.length - bParts.length;
}

export function useColumnFilters<T extends Record<string, unknown>>(
  data: T[],
  filterKeys: string[],
  valueExtractors?: Record<string, (item: T) => string>
) {
  const [filters, setFilters] = useState<Filters>({});

  const getDisplayValue = useCallback(
    (item: T, key: string): string => {
      if (valueExtractors?.[key]) {
        return valueExtractors[key](item);
      }
      const val = item[key];
      if (val == null || val === "") return "";
      return String(val);
    },
    [valueExtractors]
  );

  const getUniqueValues = useCallback(
    (key: string): string[] => {
      const values = new Set<string>();
      for (const item of data) {
        values.add(getDisplayValue(item, key));
      }
      return Array.from(values).sort((a, b) => {
        if (a === "") return 1;
        if (b === "") return -1;
        return naturalCompare(a, b);
      });
    },
    [data, getDisplayValue]
  );

  const filteredData = useMemo(() => {
    const activeFilters = Object.entries(filters).filter(
      ([, selected]) => selected.size > 0
    );
    if (activeFilters.length === 0) return data;

    return data.filter((item) =>
      activeFilters.every(([key, selected]) => {
        const val = getDisplayValue(item, key);
        return selected.has(val);
      })
    );
  }, [data, filters, getDisplayValue]);

  const setFilter = useCallback((key: string, values: Set<string>) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (values.size === 0) {
        delete next[key];
      } else {
        next[key] = values;
      }
      return next;
    });
  }, []);

  const clearFilter = useCallback((key: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({});
  }, []);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((s) => s.size > 0).length,
    [filters]
  );

  return {
    filters,
    filteredData,
    getUniqueValues,
    setFilter,
    clearFilter,
    clearAllFilters,
    activeFilterCount,
  };
}
