"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNSET = "__unset__";

export type MasterOption = {
  id: number;
  name: string;
};

type Props = {
  options: MasterOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
};

/**
 * 業種・流入経路・ステータス① / ② などのマスタ用プルダウン。
 * 新規追加・編集・削除はマスタ管理モーダル（MasterManagementModal）から行う。
 * 当コンポーネントは選択のみを担う。
 */
export function MasterSelect({ options, value, onChange, placeholder }: Props) {
  return (
    <Select
      value={value !== null ? value.toString() : UNSET}
      onValueChange={(v) => {
        if (v === UNSET) {
          onChange(null);
          return;
        }
        const id = parseInt(v, 10);
        onChange(isNaN(id) ? null : id);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "選択してください"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>未設定</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id.toString()}>
            {opt.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
