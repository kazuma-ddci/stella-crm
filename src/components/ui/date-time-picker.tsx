"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { ja } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import type { DayPickerProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateTimePickerProps {
  /** ISO形式の日時文字列（YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss） */
  value: string
  /** YYYY-MM-DDTHH:mm 形式で返す */
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  captionLayout?: DayPickerProps["captionLayout"]
  startMonth?: Date
  endMonth?: Date
}

function parseDateTimeValue(value: string) {
  const normalized = value.trim().replace(/\//g, "-").replace(" ", "T")
  const datePart = normalized.slice(0, 10)
  const timePart = normalized.slice(11, 16) || "09:00"
  const parsed = parse(datePart, "yyyy-MM-dd", new Date())
  if (Number.isNaN(parsed.getTime())) {
    return { selectedDate: undefined, timeStr: "09:00" }
  }
  return { selectedDate: parsed, timeStr: timePart }
}

function DateTimePicker({
  value,
  onChange,
  placeholder = "日時を選択",
  disabled = false,
  className,
  id,
  captionLayout,
  startMonth,
  endMonth,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)

  const { selectedDate, timeStr } = React.useMemo(() => {
    if (!value) return { selectedDate: undefined, timeStr: "09:00" }
    return parseDateTimeValue(value)
  }, [value])

  const buildValue = (date: Date | undefined, time: string): string => {
    if (!date) return ""
    return `${format(date, "yyyy-MM-dd")}T${time}`
  }

  const handleSelectDate = (date: Date | undefined) => {
    onChange(buildValue(date, timeStr))
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value || "09:00"
    if (selectedDate) {
      onChange(buildValue(selectedDate, newTime))
    } else {
      // 日付が未選択の場合は今日の日付で初期化
      onChange(buildValue(new Date(), newTime))
    }
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
              ? `${format(selectedDate, "yyyy/MM/dd", { locale: ja })} ${timeStr}`
              : placeholder
            }
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelectDate}
          defaultMonth={selectedDate}
          captionLayout={captionLayout}
          startMonth={startMonth}
          endMonth={endMonth}
          autoFocus
        />
        <div className="p-3 border-t flex items-center gap-2">
          <span className="text-sm text-muted-foreground">時刻:</span>
          <Input
            type="time"
            value={timeStr}
            onChange={handleTimeChange}
            className="h-8 w-32"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DateTimePicker }
export type { DateTimePickerProps }
