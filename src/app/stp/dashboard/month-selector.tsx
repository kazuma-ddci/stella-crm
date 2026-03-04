"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MonthSelectorProps = {
  months: string[];
  currentMonth: string;
};

export function MonthSelector({ months, currentMonth }: MonthSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", value);
    router.push(`/stp/dashboard?${params.toString()}`);
  };

  /** "2026-03" → "2026年3月" */
  const formatMonth = (ym: string) => {
    const [y, m] = ym.split("-");
    return `${y}年${parseInt(m, 10)}月`;
  };

  return (
    <Select value={currentMonth} onValueChange={handleChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue>{formatMonth(currentMonth)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m} value={m}>
            {formatMonth(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
