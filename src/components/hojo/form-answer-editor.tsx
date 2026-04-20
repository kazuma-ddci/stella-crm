"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { FORM_SECTIONS, getAnswerValue } from "@/lib/hojo/form-answer-sections";
import type { FieldDef } from "@/lib/hojo/form-answer-sections";
import { FileText, ExternalLink, Eye, EyeOff } from "lucide-react";

export type ModifiedAnswers = Record<string, Record<string, string | null>>;

export type FileInfo = {
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
};

type Props = {
  answers: Record<string, unknown>;
  modifiedAnswers: ModifiedAnswers;
  fileUrls?: Record<string, FileInfo> | null;
  readOnly?: boolean;
  onChange?: (path: string, key: string, value: string) => void;
  hideOriginalToggle?: boolean;
};

function FileLink({ info, label }: { info: FileInfo | undefined; label: string }) {
  if (!info?.filePath) {
    return <div className="text-xs text-gray-400 italic px-3 py-2">未添付</div>;
  }
  return (
    <a
      href={info.filePath}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-100 rounded px-3 py-2 bg-blue-50"
    >
      <FileText className="h-4 w-4" />
      {info.fileName ?? label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function ReadOnlyValue({ value }: { value: string }) {
  if (!value) return <div className="text-xs text-gray-400 italic px-3 py-2">未入力</div>;
  return (
    <div className="text-sm whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded px-3 py-2 min-h-[40px]">
      {value}
    </div>
  );
}

function EditField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: FieldDef;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return <ReadOnlyValue value={value} />;
  }

  if (field.type === "radio" && field.options) {
    return (
      <RadioGroup value={value} onValueChange={(v) => onChange?.(v)} className="flex flex-col gap-2 py-1">
        {field.options.map((o) => (
          <label key={o} className="flex items-center gap-2 cursor-pointer text-sm">
            <RadioGroupItem value={o} id={`${field.key}_${o}`} />
            <span className="text-gray-700">{o}</span>
          </label>
        ))}
      </RadioGroup>
    );
  }
  if (field.type === "textarea") {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={field.placeholder}
        className="min-h-[80px] text-sm"
      />
    );
  }
  return (
    <Input
      type={field.inputType || "text"}
      inputMode={field.inputMode}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={field.placeholder}
      className="text-sm"
    />
  );
}

export function FormAnswerEditor({
  answers,
  modifiedAnswers,
  fileUrls,
  readOnly,
  onChange,
  hideOriginalToggle,
}: Props) {
  const [showOriginal, setShowOriginal] = useState(false);

  const currentBankType =
    modifiedAnswers.bankAccount?.bankType ??
    getAnswerValue(answers, "bankAccount", "bankType");

  const visibleSections = FORM_SECTIONS.filter((s) => {
    if (!s.condition) return true;
    return s.condition({ bankType: currentBankType });
  });

  const toggleEnabled = !hideOriginalToggle;
  const effectiveShowOriginal = toggleEnabled && showOriginal;

  return (
    <div className="space-y-4">
      {toggleEnabled && (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowOriginal((v) => !v)}
            className="gap-1.5"
          >
            {showOriginal ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                元データを隠す
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                元データも表示
              </>
            )}
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {visibleSections.map((section) => (
          <div key={section.key} className="rounded-lg border bg-white">
            <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
              <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
              {section.description && (
                <p className="text-xs text-gray-600 mt-1">{section.description}</p>
              )}
            </div>
            <div className="p-4 space-y-4">
              {section.fields.map((field) => {
                const originalValue =
                  field.type === "file"
                    ? ""
                    : getAnswerValue(answers, section.path, field.key);
                const editedValue =
                  field.type === "file"
                    ? ""
                    : (modifiedAnswers[section.path]?.[field.key] ?? originalValue);
                const isModified =
                  field.type !== "file" &&
                  modifiedAnswers[section.path]?.[field.key] !== undefined &&
                  editedValue !== originalValue;
                const fileInfo = field.type === "file" ? fileUrls?.[field.key] : undefined;

                return (
                  <div key={field.key} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-700">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {isModified && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          編集済み
                        </span>
                      )}
                    </div>

                    {effectiveShowOriginal ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] text-gray-500 mb-1">元の回答</div>
                          {field.type === "file" ? (
                            <FileLink info={fileInfo} label={field.label} />
                          ) : (
                            <ReadOnlyValue value={originalValue} />
                          )}
                        </div>
                        <div className={isModified ? "pl-2 border-l-2 border-amber-400" : ""}>
                          <div className="text-[10px] text-gray-500 mb-1">
                            {readOnly ? "現在の回答" : "編集後の回答"}
                          </div>
                          {field.type === "file" ? (
                            <div className="text-xs text-gray-500 italic px-3 py-2">
                              添付ファイルは顧客側でのみ変更可能です
                            </div>
                          ) : (
                            <EditField
                              field={field}
                              value={editedValue}
                              onChange={(v) => onChange?.(section.path, field.key, v)}
                              readOnly={readOnly}
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={isModified ? "pl-2 border-l-2 border-amber-400" : ""}>
                        {field.type === "file" ? (
                          <FileLink info={fileInfo} label={field.label} />
                        ) : (
                          <EditField
                            field={field}
                            value={editedValue}
                            onChange={(v) => onChange?.(section.path, field.key, v)}
                            readOnly={readOnly}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
