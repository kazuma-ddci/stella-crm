"use client";

import { useState, useEffect, useRef } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type CategoryEditCellProps = {
  currentCategory: string;
  currentMinimumCases: number | null;
  currentMonthlyFee: number | null;
  onSave: (data: {
    category1: string;
    minimumCases: number | null;
    monthlyFee: number | null;
  }) => void;
  onCancel: () => void;
};

const category1Options = [
  { value: "代理店", label: "代理店" },
  { value: "顧問", label: "顧問" },
];

export function CategoryEditCell({
  currentCategory,
  currentMinimumCases,
  currentMonthlyFee,
  onSave,
  onCancel,
}: CategoryEditCellProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [selectedCategory, setSelectedCategory] = useState(currentCategory || "代理店");
  const [minimumCases, setMinimumCases] = useState<string>(
    currentMinimumCases !== null ? String(currentMinimumCases) : ""
  );
  const [monthlyFee, setMonthlyFee] = useState<string>(
    currentMonthlyFee !== null ? String(currentMonthlyFee) : ""
  );

  // マウント時にPopoverを開く
  useEffect(() => {
    // 少し遅延させてトリガーがマウントされた後に開く
    const timer = setTimeout(() => {
      setPopoverOpen(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setPopoverOpen(false);
    };
  }, []);

  const handleConfirm = () => {
    // 変更があるかチェック
    const newMinimumCases = minimumCases ? Number(minimumCases) : null;
    const newMonthlyFee = monthlyFee ? Number(monthlyFee) : null;

    const hasChanges =
      selectedCategory !== currentCategory ||
      newMinimumCases !== currentMinimumCases ||
      newMonthlyFee !== currentMonthlyFee;

    if (!hasChanges) {
      onCancel();
      return;
    }

    // 顧問から代理店に変更する場合、最低件数・月額費用はnullにする
    if (selectedCategory === "代理店") {
      onSave({
        category1: selectedCategory,
        minimumCases: null,
        monthlyFee: null,
      });
    } else {
      onSave({
        category1: selectedCategory,
        minimumCases: newMinimumCases,
        monthlyFee: newMonthlyFee,
      });
    }
    setPopoverOpen(false);
  };

  const handleCancel = () => {
    setPopoverOpen(false);
    onCancel();
  };

  const handleOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (!open) {
      onCancel();
    }
  };

  return (
    <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          className="w-full h-8 text-left px-1 focus:outline-none"
          aria-label="区分を編集"
        >
          {currentCategory || "代理店"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-4" align="start">
        <div className="space-y-4">
          <RadioGroup
            value={selectedCategory}
            onValueChange={setSelectedCategory}
            className="space-y-2"
          >
            {category1Options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value} className="cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {selectedCategory === "顧問" && (
            <>
              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="minimumCases" className="text-sm">
                    最低件数
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="minimumCases"
                      type="number"
                      value={minimumCases}
                      onChange={(e) => setMinimumCases(e.target.value)}
                      placeholder="0"
                      className="h-8 w-24"
                    />
                    <span className="text-sm text-muted-foreground">件</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="monthlyFee" className="text-sm">
                    月額費用
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="monthlyFee"
                      type="number"
                      value={monthlyFee}
                      onChange={(e) => setMonthlyFee(e.target.value)}
                      placeholder="0"
                      className="h-8 w-28"
                    />
                    <span className="text-sm text-muted-foreground">円</span>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button size="sm" variant="outline" onClick={handleCancel}>
              キャンセル
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              確定
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
