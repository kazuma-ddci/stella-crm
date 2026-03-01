"use client";

import { useState, useRef, useEffect } from "react";
import { CrudTable, ColumnDef, CustomRenderers, CustomFormFields } from "@/components/crud-table";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import {
  createInvoiceTemplate,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
} from "./actions";

const TEMPLATE_TYPE_OPTIONS = [
  { value: "sending", label: "送付用" },
  { value: "request", label: "発行依頼用" },
];

const VARIABLE_GROUPS = [
  {
    label: "法人・取引先",
    variables: [
      { variable: "{{法人名}}", description: "運営法人の名称", sample: "株式会社サンプル" },
      { variable: "{{取引先名}}", description: "取引先の会社名", sample: "テスト株式会社" },
      { variable: "{{担当者名}}", description: "取引先の担当者名", sample: "田中太郎" },
    ],
  },
  {
    label: "請求情報",
    variables: [
      { variable: "{{年月}}", description: "請求対象の年月", sample: "2026年3月" },
      { variable: "{{合計金額}}", description: "請求金額の合計（税込）", sample: "¥1,000,000" },
      { variable: "{{支払期限}}", description: "支払期限日", sample: "2026年4月30日" },
    ],
  },
  {
    label: "その他",
    variables: [
      { variable: "{{指定PDF名}}", description: "添付するPDFファイル名", sample: "請求書_2026_03.pdf" },
      { variable: "{{受信メールアドレス}}", description: "受け取り側のメールアドレス", sample: "tanaka@example.com" },
    ],
  },
];

const ALL_TEMPLATE_VARIABLES = VARIABLE_GROUPS.flatMap((g) => g.variables);

function replaceTemplateVariables(template: string): string {
  let result = template;
  for (const v of ALL_TEMPLATE_VARIABLES) {
    result = result.replaceAll(v.variable, v.sample);
  }
  return result;
}

// --- contentEditable 用ヘルパー ---

const CHIP_CLASS =
  "inline-flex items-center rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-xs font-medium align-baseline cursor-default select-all whitespace-nowrap";

/** 保存テキスト（{{変数}}形式）→ エディタ用HTML */
function textToHtml(text: string): string {
  if (!text) return "";
  const parts = text.split(/(\{\{.+?\}\})/g);
  return parts
    .map((part) => {
      if (/^\{\{.+?\}\}$/.test(part)) {
        const label = part.slice(2, -2);
        // data-variable に元の {{変数}} を保持
        return `<span contenteditable="false" data-variable="${part}" class="${CHIP_CLASS}">${label}</span>`;
      }
      return part
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
    })
    .join("");
}

/** エディタDOM → 保存テキスト（{{変数}}形式） */
function domToText(element: HTMLElement): string {
  let result = "";
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || "";
    } else if (node instanceof HTMLElement) {
      if (node.dataset.variable) {
        result += node.dataset.variable;
      } else if (node.tagName === "BR") {
        result += "\n";
      } else if (node.tagName === "DIV" || node.tagName === "P") {
        // ブラウザがEnterで<div>を作る場合の対応
        if (result && !result.endsWith("\n")) result += "\n";
        result += domToText(node);
      } else {
        result += domToText(node);
      }
    }
  }
  return result;
}

// --- コンポーネント ---

type CompanyOption = {
  value: string;
  label: string;
};

type Props = {
  data: Record<string, unknown>[];
  companyOptions: CompanyOption[];
};

function TemplateField({
  value,
  onChange,
  label,
  rows,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
  label: string;
  rows: number;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string>("");
  const text = String(value ?? "");

  // 外部からの値変更 → DOM更新（ユーザー入力時はスキップ）
  useEffect(() => {
    if (editorRef.current && text !== lastValueRef.current) {
      editorRef.current.innerHTML = textToHtml(text);
      lastValueRef.current = text;
    }
  }, [text]);

  function syncToState() {
    if (!editorRef.current) return;
    const newText = domToText(editorRef.current);
    lastValueRef.current = newText;
    onChange(newText);
  }

  function insertVariable(variable: string) {
    const editor = editorRef.current;
    if (!editor) return;

    const span = document.createElement("span");
    span.contentEditable = "false";
    span.dataset.variable = variable;
    span.className = CHIP_CLASS;
    span.textContent = variable.slice(2, -2);

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(span);
        const newRange = document.createRange();
        newRange.setStartAfter(span);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        editor.appendChild(span);
        editor.focus();
      }
    } else {
      editor.appendChild(span);
      editor.focus();
    }

    syncToState();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="h-7 gap-1 text-xs"
        >
          {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showPreview ? "編集" : "プレビュー"}
        </Button>
      </div>
      {showPreview ? (
        <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap min-h-[60px]">
          {replaceTemplateVariables(text) || <span className="text-muted-foreground">（空）</span>}
        </div>
      ) : (
        <>
          <div className="relative">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncToState}
              onPaste={(e) => {
                e.preventDefault();
                const pastedText = e.clipboardData.getData("text/plain");
                document.execCommand("insertText", false, pastedText);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  document.execCommand("insertLineBreak");
                }
              }}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] md:text-sm whitespace-pre-wrap break-words"
              style={{ minHeight: `${rows * 1.5 + 1}rem` }}
              role="textbox"
              aria-label={label}
            />
            {!text && (
              <div className="absolute top-2 left-3 text-muted-foreground pointer-events-none md:text-sm">
                {label}を入力
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            {VARIABLE_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">{group.label}:</span>
                {group.variables.map((v) => (
                  <button
                    key={v.variable}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertVariable(v.variable)}
                    title={v.description}
                    className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    {v.variable.slice(2, -2)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function EmailTemplatesTable({ data, companyOptions }: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "operatingCompanyId",
      header: "運営法人",
      type: "select",
      options: companyOptions,
      required: true,
      filterable: true,
    },
    {
      key: "name",
      header: "テンプレート名",
      type: "text",
      required: true,
      filterable: true,
    },
    {
      key: "templateType",
      header: "種別",
      type: "select",
      options: TEMPLATE_TYPE_OPTIONS,
      required: true,
      filterable: true,
    },
    {
      key: "emailSubjectTemplate",
      header: "メール件名",
      type: "textarea",
      required: true,
    },
    {
      key: "emailBodyTemplate",
      header: "メール本文",
      type: "textarea",
      required: true,
    },
    {
      key: "isDefault",
      header: "デフォルト",
      type: "boolean",
      defaultValue: false,
    },
  ];

  const customRenderers: CustomRenderers = {
    operatingCompanyId: (value, item) => {
      if (!value) return "（なし）";
      const option = companyOptions.find((o) => o.value === String(value));
      if (option) return option.label;
      const label = item?.operatingCompanyLabel as string | undefined;
      return label ? `${label}（無効）` : "（なし）";
    },
    templateType: (value) => {
      const option = TEMPLATE_TYPE_OPTIONS.find((o) => o.value === value);
      return option ? option.label : String(value);
    },
  };

  const customFormFields: CustomFormFields = {
    emailSubjectTemplate: {
      render: (value, onChange) => (
        <TemplateField
          value={value}
          onChange={onChange}
          label="メール件名テンプレート"
          rows={2}
        />
      ),
    },
    emailBodyTemplate: {
      render: (value, onChange) => (
        <TemplateField
          value={value}
          onChange={onChange}
          label="メール本文テンプレート"
          rows={8}
        />
      ),
    },
  };

  return (
    <CrudTable
      data={data}
      columns={columns}
      title="テンプレート"
      onAdd={createInvoiceTemplate}
      onUpdate={updateInvoiceTemplate}
      onDelete={deleteInvoiceTemplate}
      emptyMessage="メールテンプレートが登録されていません"
      customRenderers={customRenderers}
      customFormFields={customFormFields}
    />
  );
}
