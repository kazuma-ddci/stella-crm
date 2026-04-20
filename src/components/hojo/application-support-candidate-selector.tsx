"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle } from "lucide-react";

export type AppSupportCandidate = {
  id: number;
  applicantName: string | null;
  statusName: string | null;
  vendorName: string | null;
  createdAt: string;
};

type Props = {
  candidates: AppSupportCandidate[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  warning?: string | null;
};

export function ApplicationSupportCandidateSelector({
  candidates,
  value,
  onChange,
  disabled,
  warning,
}: Props) {
  return (
    <div className="space-y-2">
      {warning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{warning}</p>
        </div>
      )}
      <RadioGroup value={value} onValueChange={onChange} className="space-y-1.5" disabled={disabled}>
        {candidates.map((c) => (
          <label
            key={c.id}
            className={`flex items-start gap-2 p-2 rounded border cursor-pointer hover:bg-gray-50 ${
              String(c.id) === value ? "border-blue-400 bg-blue-50" : "border-gray-200"
            }`}
          >
            <RadioGroupItem value={String(c.id)} className="mt-0.5" />
            <div className="text-xs flex-1">
              <div className="font-medium text-gray-900">{c.applicantName ?? "(申請者名未設定)"}</div>
              <div className="text-[11px] text-gray-500 mt-0.5 space-x-2">
                {c.vendorName && <span>ベンダー: {c.vendorName}</span>}
                {c.statusName && <span>ステータス: {c.statusName}</span>}
                <span>作成: {new Date(c.createdAt).toLocaleDateString("ja-JP")}</span>
              </div>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
