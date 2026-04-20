"use client";

import { memo, useCallback, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, RotateCcw, AlertCircle } from "lucide-react";
import { BUSINESS_PLAN_SECTIONS, type BusinessPlanSectionKey } from "@/lib/hojo/business-plan-sections";

type Props = {
  initialSections: Record<BusinessPlanSectionKey, string>;
  onSave: (
    editedSections: Record<BusinessPlanSectionKey, string>,
  ) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
};

type SectionRowProps = {
  def: (typeof BUSINESS_PLAN_SECTIONS)[number];
  value: string;
  onChange: (key: BusinessPlanSectionKey, value: string) => void;
};

// 1セクション分の行を memo 化して、他セクションの入力による再レンダーを防ぐ
const SectionRow = memo(function SectionRow({ def, value, onChange }: SectionRowProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-900">{def.title}</label>
      <p className="text-xs text-gray-500">{def.instruction}</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(def.key, e.target.value)}
        className="min-h-[150px] text-sm"
        rows={8}
      />
    </div>
  );
});

export function BusinessPlanEditor({ initialSections, onSave, onCancel }: Props) {
  const [sections, setSections] = useState<Record<BusinessPlanSectionKey, string>>(initialSections);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (key: BusinessPlanSectionKey, value: string) => {
      setDirty(true);
      setSections((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
    },
    [],
  );

  const handleReset = useCallback(() => {
    if (!dirty) return;
    if (!window.confirm("編集内容を破棄して最後に保存した状態に戻します。よろしいですか？")) return;
    setSections(initialSections);
    setDirty(false);
  }, [dirty, initialSections]);

  const handleSave = useCallback(() => {
    setError(null);
    startSaving(async () => {
      const result = await onSave(sections);
      if (!result.ok) setError(result.error ?? "保存に失敗しました");
      else setDirty(false);
    });
  }, [sections, onSave]);

  const rows = useMemo(
    () =>
      BUSINESS_PLAN_SECTIONS.map((def) => (
        <SectionRow key={def.key} def={def} value={sections[def.key] ?? ""} onChange={handleChange} />
      )),
    [sections, handleChange],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-600">
          セクション別に編集できます。保存すると PDF が再生成されます（Claude API は呼ばれないので料金は発生しません）
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            キャンセル
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving || !dirty}>
            <RotateCcw className="h-4 w-4 mr-1" />
            リセット
          </Button>
          <Button onClick={handleSave} disabled={saving || !dirty} size="sm">
            <Save className="h-4 w-4 mr-1" />
            {saving ? "保存中..." : "保存してPDF更新"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2 mb-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">{rows}</div>
    </div>
  );
}
