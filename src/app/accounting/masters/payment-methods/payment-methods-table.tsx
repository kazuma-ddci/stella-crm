"use client";

import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { createPaymentMethod, updatePaymentMethod } from "./actions";

const METHOD_TYPE_OPTIONS = [
  { value: "cash", label: "現金" },
  { value: "bank_account", label: "銀行口座" },
  { value: "credit_card", label: "クレジットカード" },
  { value: "crypto_wallet", label: "仮想通貨ウォレット" },
];

const AVAILABLE_FOR_OPTIONS = [
  { value: "both", label: "入金・出金" },
  { value: "incoming", label: "入金のみ" },
  { value: "outgoing", label: "出金のみ" },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: "", label: "（選択してください）" },
  { value: "ordinary", label: "普通" },
  { value: "checking", label: "当座" },
  { value: "savings", label: "貯蓄" },
];

type SettlementAccountOption = {
  value: string;
  label: string;
};

type Props = {
  data: Record<string, unknown>[];
  settlementAccountOptions: SettlementAccountOption[];
};

export function PaymentMethodsTable({
  data,
  settlementAccountOptions,
}: Props) {
  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "methodType",
      header: "種別",
      type: "select",
      options: METHOD_TYPE_OPTIONS,
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
    // === 銀行口座の詳細（フォームのみ表示） ===
    {
      key: "bankName",
      header: "銀行名",
      type: "text",
      hidden: true,
      visibleWhen: { field: "methodType", value: "bank_account" },
    },
    {
      key: "branchName",
      header: "支店名",
      type: "text",
      hidden: true,
      visibleWhen: { field: "methodType", value: "bank_account" },
    },
    {
      key: "accountType",
      header: "口座種別",
      type: "select",
      options: ACCOUNT_TYPE_OPTIONS,
      hidden: true,
      visibleWhen: { field: "methodType", value: "bank_account" },
    },
    {
      key: "accountNumber",
      header: "口座番号",
      type: "text",
      hidden: true,
      visibleWhen: { field: "methodType", value: "bank_account" },
    },
    {
      key: "accountHolder",
      header: "口座名義",
      type: "text",
      hidden: true,
      visibleWhen: { field: "methodType", value: "bank_account" },
    },
    // === クレジットカードの詳細（フォームのみ表示） ===
    {
      key: "cardBrand",
      header: "カードブランド",
      type: "text",
      hidden: true,
      visibleWhen: { field: "methodType", value: "credit_card" },
    },
    {
      key: "cardLast4",
      header: "カード末尾4桁",
      type: "text",
      hidden: true,
      visibleWhen: { field: "methodType", value: "credit_card" },
    },
    {
      key: "closingDay",
      header: "締め日",
      type: "number",
      hidden: true,
      visibleWhen: { field: "methodType", value: "credit_card" },
    },
    {
      key: "paymentDay",
      header: "引落日",
      type: "number",
      hidden: true,
      visibleWhen: { field: "methodType", value: "credit_card" },
    },
    {
      key: "settlementAccountId",
      header: "引落口座",
      type: "select",
      options: [{ value: "", label: "（なし）" }, ...settlementAccountOptions],
      hidden: true,
      visibleWhen: { field: "methodType", value: "credit_card" },
    },
    // === 仮想通貨ウォレットの詳細（フォームのみ表示） ===
    {
      key: "cryptoCurrency",
      header: "通貨",
      type: "text",
      hidden: true,
      visibleWhen: { field: "methodType", value: "crypto_wallet" },
    },
    {
      key: "cryptoNetwork",
      header: "ネットワーク",
      type: "text",
      hidden: true,
      visibleWhen: { field: "methodType", value: "crypto_wallet" },
    },
    {
      key: "walletAddress",
      header: "ウォレットアドレス",
      type: "text",
      hidden: true,
      visibleWhen: { field: "methodType", value: "crypto_wallet" },
    },
    // === 共通フィールド ===
    {
      key: "availableFor",
      header: "利用区分",
      type: "select",
      options: AVAILABLE_FOR_OPTIONS,
      defaultValue: "both",
    },
    {
      key: "initialBalance",
      header: "初期残高",
      type: "number",
      currency: true,
    },
    {
      key: "initialBalanceDate",
      header: "初期残高日",
      type: "date",
      hidden: true,
    },
    {
      key: "balanceAlertThreshold",
      header: "残高アラート閾値",
      type: "number",
      currency: true,
      hidden: true,
    },
    {
      key: "isActive",
      header: "有効",
      type: "boolean",
      defaultValue: true,
    },
  ];

  const customRenderers: CustomRenderers = {
    methodType: (value) => {
      const option = METHOD_TYPE_OPTIONS.find((o) => o.value === value);
      return option ? option.label : String(value);
    },
    availableFor: (value) => {
      const option = AVAILABLE_FOR_OPTIONS.find((o) => o.value === value);
      return option ? option.label : String(value);
    },
    settlementAccountId: (value, item) => {
      if (!value) return "（なし）";
      const option = settlementAccountOptions.find(
        (o) => o.value === String(value)
      );
      if (option) return option.label;
      const label = item?.settlementAccountLabel as string | undefined;
      return label ? `${label}（無効）` : "（なし）";
    },
  };

  return (
    <CrudTable
      tableId="accounting.payment-methods"
      data={data}
      columns={columns}
      title="決済手段"
      onAdd={createPaymentMethod}
      onUpdate={updatePaymentMethod}
      emptyMessage="決済手段が登録されていません"
      customRenderers={customRenderers}
    />
  );
}
