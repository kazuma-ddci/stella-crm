"use client";

import {
  CrudTable,
  ColumnDef,
  CustomRenderers,
  DynamicOptionsMap,
} from "@/components/crud-table";
import {
  createRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
} from "./actions";

const TYPE_OPTIONS = [
  { value: "revenue", label: "売上" },
  { value: "expense", label: "経費" },
];

const AMOUNT_TYPE_OPTIONS = [
  { value: "fixed", label: "固定" },
  { value: "variable", label: "変動" },
];

const FREQUENCY_OPTIONS = [
  { value: "once", label: "一度限り" },
  { value: "monthly", label: "毎月／Nヶ月ごと" },
  { value: "yearly", label: "毎年／N年ごと" },
  { value: "weekly", label: "毎週" },
];

const TAX_RATE_OPTIONS = [
  { value: "10", label: "10%（標準税率）" },
  { value: "8", label: "8%（軽減税率）" },
  { value: "0", label: "0%（非課税）" },
];

const WEEKDAY_OPTIONS = [
  { value: "0", label: "日曜" },
  { value: "1", label: "月曜" },
  { value: "2", label: "火曜" },
  { value: "3", label: "水曜" },
  { value: "4", label: "木曜" },
  { value: "5", label: "金曜" },
  { value: "6", label: "土曜" },
];

type SelectOption = { value: string; label: string };

type Props = {
  data: Record<string, unknown>[];
  counterpartyOptions: SelectOption[];
  expenseCategoryByType: Record<string, SelectOption[]>;
  costCenterOptions: SelectOption[];
  allocationTemplateOptions: SelectOption[];
  paymentMethodOptions: SelectOption[];
  projectOptions: SelectOption[];
  approverOptions: SelectOption[];
};

function formatExecutionDay(
  value: unknown,
  item: Record<string, unknown>
): string {
  if (value === null || value === undefined || value === "") return "（未設定）";
  const day = Number(value);
  const frequency = item.frequency as string;
  if (frequency === "weekly") {
    const weekday = WEEKDAY_OPTIONS.find((w) => w.value === String(day));
    return weekday ? weekday.label : String(day);
  }
  return `${day}日`;
}

export function RecurringTransactionsTable({
  data,
  counterpartyOptions,
  expenseCategoryByType,
  costCenterOptions,
  allocationTemplateOptions,
  paymentMethodOptions,
  projectOptions,
  approverOptions,
}: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "type",
      header: "種別",
      type: "select",
      options: TYPE_OPTIONS,
      required: true,
      filterable: true,
    },
    {
      key: "name",
      header: "名称",
      type: "text",
      required: true,
      filterable: true,
    },
    {
      key: "counterpartyId",
      header: "取引先",
      type: "select",
      options: counterpartyOptions,
      required: true,
      searchable: true,
    },
    {
      key: "expenseCategoryId",
      header: "費目",
      type: "select",
      dynamicOptionsKey: "expenseCategoryByType",
      dependsOn: "type",
      dependsOnPlaceholder: "先に種別を選択してください",
      required: true,
    },
    {
      key: "amountType",
      header: "金額タイプ",
      type: "select",
      options: AMOUNT_TYPE_OPTIONS,
      required: true,
      defaultValue: "fixed",
      filterable: true,
    },
    {
      key: "amount",
      header: "金額",
      type: "number",
      currency: true,
      visibleWhen: { field: "amountType", value: "fixed" },
    },
    {
      key: "taxRate",
      header: "税率",
      type: "select",
      options: TAX_RATE_OPTIONS,
      defaultValue: "10",
      hidden: true,
      visibleWhen: { field: "amountType", value: "fixed" },
    },
    {
      key: "taxAmount",
      header: "消費税額",
      type: "number",
      currency: true,
      hidden: true,
      visibleWhen: { field: "amountType", value: "fixed" },
    },
    {
      key: "frequency",
      header: "支払いサイクル",
      type: "select",
      options: FREQUENCY_OPTIONS,
      required: true,
      filterable: true,
    },
    {
      key: "intervalCount",
      header: "間隔（Nヶ月ごと／N年ごと）",
      type: "number",
      defaultValue: 1,
      hidden: true,
    },
    {
      key: "executeOnLastDay",
      header: "毎月末日に実行",
      type: "boolean",
      defaultValue: false,
      hidden: true,
    },
    {
      key: "executionDay",
      header: "実行日",
      type: "number",
    },
    {
      key: "startDate",
      header: "開始日",
      type: "date",
      required: true,
    },
    {
      key: "endDate",
      header: "終了日",
      type: "date",
    },
    // === 按分設定（フォームのみ表示） ===
    {
      key: "costCenterId",
      header: "プロジェクト（按分なし）",
      type: "select",
      options: [{ value: "", label: "（なし）" }, ...costCenterOptions],
      hidden: true,
    },
    {
      key: "allocationTemplateId",
      header: "按分テンプレート",
      type: "select",
      options: [
        { value: "", label: "（なし）" },
        ...allocationTemplateOptions,
      ],
      hidden: true,
    },
    {
      key: "paymentMethodId",
      header: "決済手段",
      type: "select",
      options: [{ value: "", label: "（なし）" }, ...paymentMethodOptions],
      hidden: true,
    },
    {
      key: "projectId",
      header: "プロジェクト",
      type: "select",
      options: [{ value: "", label: "（なし）" }, ...projectOptions],
      filterable: true,
    },
    {
      key: "approverStaffId",
      header: "承認者",
      type: "select",
      options: [{ value: "", label: "（なし）" }, ...approverOptions],
      hidden: true,
    },
    {
      key: "note",
      header: "摘要・メモ",
      type: "textarea",
      hidden: true,
    },
    {
      key: "isActive",
      header: "有効",
      type: "boolean",
      defaultValue: true,
      filterable: true,
    },
  ];

  const customRenderers: CustomRenderers = {
    type: (value) => {
      const option = TYPE_OPTIONS.find((o) => o.value === value);
      return option ? option.label : String(value);
    },
    counterpartyId: (_value, item) => {
      return (item?.counterpartyName as string) || "（不明）";
    },
    expenseCategoryId: (_value, item) => {
      return (item?.expenseCategoryName as string) || "（不明）";
    },
    amountType: (value) => {
      const option = AMOUNT_TYPE_OPTIONS.find((o) => o.value === value);
      return option ? option.label : String(value);
    },
    frequency: (value, item) => {
      const option = FREQUENCY_OPTIONS.find((o) => o.value === value);
      const base = option ? option.label : String(value);
      const interval = Number(item?.intervalCount ?? 1);
      if (value === "monthly" && interval > 1) return `${interval}ヶ月ごと`;
      if (value === "yearly" && interval > 1) return `${interval}年ごと`;
      return base;
    },
    executionDay: (value, item) => {
      if (item?.executeOnLastDay) return "月末日";
      return formatExecutionDay(value, item ?? {});
    },
    approverStaffId: (_value, item) => {
      return (item?.approverStaffName as string) || "（なし）";
    },
    costCenterId: (_value, item) => {
      return (item?.costCenterName as string) || "（なし）";
    },
    allocationTemplateId: (_value, item) => {
      return (item?.allocationTemplateName as string) || "（なし）";
    },
    paymentMethodId: (_value, item) => {
      return (item?.paymentMethodName as string) || "（なし）";
    },
    projectId: (_value, item) => {
      return (item?.projectName as string) || "（なし）";
    },
    taxRate: (value) => {
      const option = TAX_RATE_OPTIONS.find((o) => o.value === String(value));
      return option ? option.label : `${value}%`;
    },
  };

  const dynamicOptions: DynamicOptionsMap = {
    expenseCategoryByType: expenseCategoryByType as Record<
      string,
      SelectOption[]
    >,
  };

  // 金額変更時に消費税額を自動計算
  const handleFieldChange = (
    fieldKey: string,
    newValue: unknown,
    formData: Record<string, unknown>,
    setFormData: (data: Record<string, unknown>) => void
  ) => {
    if (fieldKey === "amount" || fieldKey === "taxRate") {
      const amount =
        fieldKey === "amount" ? Number(newValue) || 0 : Number(formData.amount) || 0;
      const taxRate =
        fieldKey === "taxRate"
          ? Number(newValue) || 0
          : Number(formData.taxRate) || 10;
      const taxAmount = Math.floor(amount * (taxRate / 100));
      setFormData({
        ...formData,
        [fieldKey]: newValue,
        taxAmount,
      });
    }
  };

  return (
    <CrudTable
      tableId="accounting.recurring-transactions"
      data={data}
      columns={columns}
      title="定期取引"
      onAdd={createRecurringTransaction}
      onUpdate={updateRecurringTransaction}
      onDelete={deleteRecurringTransaction}
      emptyMessage="定期取引が登録されていません"
      customRenderers={customRenderers}
      dynamicOptions={dynamicOptions}
      onFieldChange={handleFieldChange}
    />
  );
}
