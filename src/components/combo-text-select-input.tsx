"use client"

import * as React from "react"
import { ChevronDown, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

interface ComboTextSelectInputProps {
  value: string
  linkedId: number | null
  onChange: (value: string, linkedId: number | null) => void
  options: { id: number; label: string }[]
  placeholder?: string
  disabled?: boolean
}

export function ComboTextSelectInput({
  value,
  linkedId,
  onChange,
  options,
  placeholder,
  disabled,
}: ComboTextSelectInputProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="flex items-center gap-1">
      {linkedId != null ? (
        <div className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
          <span className="flex-1 truncate">{value}</span>
          <button
            type="button"
            disabled={disabled}
            className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
            onClick={() => onChange("", null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Input
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value, null)}
        />
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={disabled}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="end">
          <Command>
            <CommandInput placeholder="検索..." />
            <CommandList>
              <CommandEmpty>該当なし</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.label, option.id)
                      setOpen(false)
                    }}
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
