"use client";

import { useState } from "react";
import { CrudTable, ColumnDef, CustomRenderers, CustomFormFields } from "@/components/crud-table";
import { Textarea } from "@/components/ui/textarea";
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

const TEMPLATE_VARIABLES = [
  { variable: "{{法人名}}", description: "運営法人の名称", sample: "株式会社サンプル" },
  { variable: "{{取引先名}}", description: "取引先の会社名", sample: "テスト株式会社" },
  { variable: "{{担当者名}}", description: "取引先の担当者名", sample: "田中太郎" },
  { variable: "{{年月}}", description: "請求対象の年月", sample: "2026年3月" },
  { variable: "{{合計金額}}", description: "請求金額の合計（税込）", sample: "¥1,000,000" },
  { variable: "{{支払期限}}", description: "支払期限日", sample: "2026年4月30日" },
  { variable: "{{指定PDF名}}", description: "添付するPDFファイル名", sample: "請求書_2026_03.pdf" },
  { variable: "{{受信メールアドレス}}", description: "受け取り側のメールアドレス", sample: "tanaka@example.com" },
];

function replaceTemplateVariables(template: string): string {
  let result = template;
  for (const v of TEMPLATE_VARIABLES) {
    result = result.replaceAll(v.variable, v.sample);
  }
  return result;
}

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
  const text = String(value ?? "");

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
        <Textarea
          value={text}
          onChange={(e) => onChange(e.target.value || null)}
          rows={rows}
          placeholder={`${label}を入力（テンプレート変数使用可）`}
        />
      )}
      <div className="text-xs text-muted-foreground">
        利用可能な変数:{" "}
        {TEMPLATE_VARIABLES.map((v) => v.variable).join("、")}
      </div>
    </div>
  );
}

export function InvoiceTemplatesTable({ data, companyOptions }: Props) {
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
      emptyMessage="請求書テンプレートが登録されていません"
      customRenderers={customRenderers}
      customFormFields={customFormFields}
    />
  );
}
