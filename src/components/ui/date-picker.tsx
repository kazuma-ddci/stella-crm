"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { ja } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import type { DayPickerProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DatePickerProps {
  /** YYYY-MM-DD 形式の日付文字列 */
  value: string
  /** YYYY-MM-DD 形式で返す */
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  captionLayout?: DayPickerProps["captionLayout"]
  startMonth?: Date
  endMonth?: Date
}

function parseDateValue(value: string) {
  const normalized = value.replace(/\//g, "-").slice(0, 10)
  const parsed = parse(normalized, "yyyy-MM-dd", new Date())
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index),
  label: `${index + 1}月`,
}))

function DatePicker({
  value,
  onChange,
  placeholder = "日付を選択",
  disabled = false,
  className,
  id,
  captionLayout,
  startMonth,
  endMonth,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined
    return parseDateValue(value)
  }, [value])

  const useMonthYearSelect =
    captionLayout === "dropdown" ||
    captionLayout === "dropdown-months" ||
    captionLayout === "dropdown-years"

  const [displayMonth, setDisplayMonth] = React.useState<Date>(
    selectedDate ?? new Date()
  )

  const yearOptions = React.useMemo(() => {
    const startYear = startMonth?.getFullYear() ?? new Date().getFullYear() - 100
    const endYear = endMonth?.getFullYear() ?? new Date().getFullYear() + 5

    return Array.from(
      { length: Math.max(endYear - startYear + 1, 1) },
      (_, index) => startYear + index
    )
  }, [endMonth, startMonth])

  React.useEffect(() => {
    if (!open) return
    setDisplayMonth(selectedDate ?? new Date())
  }, [open, selectedDate])

  const handleMonthChange = (monthValue: string) => {
    setDisplayMonth(
      new Date(displayMonth.getFullYear(), Number(monthValue), 1)
    )
  }

  const handleYearChange = (yearValue: string) => {
    setDisplayMonth(
      new Date(Number(yearValue), displayMonth.getMonth(), 1)
    )
  }

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"))
    } else {
      onChange("")
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-9",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-1.5 size-3.5 shrink-0" />
          <span className="truncate text-sm">
            {selectedDate
              ? format(selectedDate, "yyyy/MM/dd", { locale: ja })
              : placeholder
            }
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {useMonthYearSelect && (
          <div className="flex items-center gap-2 border-b px-3 py-2">
            {(captionLayout === "dropdown" ||
              captionLayout === "dropdown-years") && (
              <Select
                value={String(displayMonth.getFullYear())}
                onValueChange={handleYearChange}
              >
                <SelectTrigger size="sm" className="w-[104px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(captionLayout === "dropdown" ||
              captionLayout === "dropdown-months") && (
              <Select
                value={String(displayMonth.getMonth())}
                onValueChange={handleMonthChange}
              >
                <SelectTrigger size="sm" className="w-[88px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={useMonthYearSelect ? undefined : selectedDate}
          month={useMonthYearSelect ? displayMonth : undefined}
          onMonthChange={useMonthYearSelect ? setDisplayMonth : undefined}
          captionLayout={useMonthYearSelect ? undefined : captionLayout}
          startMonth={startMonth}
          endMonth={endMonth}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
export type { DatePickerProps }
