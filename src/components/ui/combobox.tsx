"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, matchesWithWordBoundary } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Option = {
  value: string;
  label: string;
};

type Props = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
};

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "選択してください",
  allowCustom = false,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue === value ? "" : selectedValue);
    setOpen(false);
    setInputValue("");
  };

  const handleInputChange = (newInputValue: string) => {
    setInputValue(newInputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (allowCustom && e.key === "Enter" && inputValue && !options.find(o => o.value === inputValue)) {
      e.preventDefault();
      onChange(inputValue);
      setOpen(false);
      setInputValue("");
    }
  };

  const filteredOptions = inputValue
    ? options.filter(option =>
        matchesWithWordBoundary(option.label, inputValue)
      )
    : options;

  const showCustomOption =
    allowCustom &&
    inputValue &&
    !options.find(o => o.value.toLowerCase() === inputValue.toLowerCase());

  // 選択されたvalueに対応するlabelを取得
  const selectedLabel = React.useMemo(() => {
    if (!value) return null;
    const option = options.find(o => o.value === value);
    return option?.label || value; // optionが見つからない場合はvalueをそのまま表示
  }, [value, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedLabel || <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={inputValue}
            onValueChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <CommandList maxHeight={300}>
            <CommandEmpty>
              {allowCustom && inputValue ? (
                <span className="text-muted-foreground">
                  Enterで「{inputValue}」を追加
                </span>
              ) : (
                "見つかりませんでした"
              )}
            </CommandEmpty>
            <CommandGroup>
              {showCustomOption && (
                <CommandItem
                  value={inputValue}
                  onSelect={() => handleSelect(inputValue)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      "opacity-0"
                    )}
                  />
                  「{inputValue}」を追加
                </CommandItem>
              )}
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
