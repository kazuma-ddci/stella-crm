"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PaymentGroupsTable } from "./payment-groups-table";
import { UngroupedExpensesPanel } from "./ungrouped-expenses-panel";
import { InboundInvoiceBanner } from "./inbound-invoice-banner";
import type {
  PaymentGroupListItem,
  UngroupedExpenseTransaction,
  UngroupedAllocationItem,
} from "./actions";
import type { PendingInboundInvoice, MatchablePaymentGroup } from "./inbound-invoice-actions";

type Props = {
  data: PaymentGroupListItem[];
  ungroupedTransactions: UngroupedExpenseTransaction[];
  ungroupedAllocationItems: UngroupedAllocationItem[];
  counterpartyOptions: { value: string; label: string; isStellaCustomer: boolean }[];
  operatingCompanyOptions: { value: string; label: string }[];
  expenseCategories: { id: number; name: string; type: string }[];
  unconfirmedTransactions: UngroupedExpenseTransaction[];
  projectId?: number;
  canEditAccounting?: boolean;
  pendingInboundInvoices?: PendingInboundInvoice[];
  matchablePaymentGroups?: MatchablePaymentGroup[];
};

export function PaymentGroupsPageClient({
  data,
  ungroupedTransactions,
  ungroupedAllocationItems,
  counterpartyOptions,
  operatingCompanyOptions,
  expenseCategories,
  unconfirmedTransactions,
  projectId,
  canEditAccounting,
  pendingInboundInvoices = [],
  matchablePaymentGroups = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(
    (ungroupedTransactions.length + ungroupedAllocationItems.length) > 0 ? "ungrouped" : "list"
  );

  // サマリー計算
  const totalCount = data.length;
  const invoiceBeforeRequestCount = data.filter(
    (r) => r.paymentType === "invoice" && r.status === "before_request"
  ).length;
  const directUnprocessedCount = data.filter(
    (r) => r.paymentType === "direct" && r.status === "unprocessed"
  ).length;
  const actionRequiredCount = invoiceBeforeRequestCount + directUnprocessedCount;
  const totalAmount = data.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);
  const confirmedAmount = data
    .filter((r) => ["confirmed", "paid"].includes(r.status))
    .reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);

  // 下書き（before_request）+ direct未処理の支払グループ
  const draftPaymentGroups = data.filter(
    (r) => r.status === "before_request" || (r.paymentType === "direct" && r.status === "unprocessed")
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">支払管理</h1>

      <InboundInvoiceBanner
        invoices={pendingInboundInvoices}
        matchableGroups={matchablePaymentGroups}
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        idBase={`stp-finance-payment-groups-${projectId ?? "default"}`}
      >
        <TabsList>
          <TabsTrigger value="ungrouped">
            未処理の取引
            {(ungroupedTransactions.length + ungroupedAllocationItems.length) > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-xs font-medium text-white">
                {ungroupedTransactions.length + ungroupedAllocationItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="list">
            支払一覧
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-200 px-1.5 text-xs font-medium text-gray-700">
              {totalCount}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ungrouped">
          <UngroupedExpensesPanel
            ungroupedTransactions={ungroupedTransactions}
            ungroupedAllocationItems={ungroupedAllocationItems}
            draftPaymentGroups={draftPaymentGroups}
            counterpartyOptions={counterpartyOptions}
            operatingCompanyOptions={operatingCompanyOptions}
            expenseCategories={expenseCategories}
            unconfirmedTransactions={unconfirmedTransactions}
            projectId={projectId}
          />
        </TabsContent>

        <TabsContent value="list">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">総件数</div>
                  <div className="text-2xl font-bold">{totalCount}件</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">要対応</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {actionRequiredCount}件
                  </div>
                  {invoiceBeforeRequestCount > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      請求書: 依頼前 {invoiceBeforeRequestCount}件
                    </div>
                  )}
                  {directUnprocessedCount > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      即時: 未処理 {directUnprocessedCount}件
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">
                    支払合計
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">
                    ¥{totalAmount.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">
                    確認済み
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    ¥{confirmedAmount.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            <PaymentGroupsTable
              data={data}
              counterpartyOptions={counterpartyOptions}
              operatingCompanyOptions={operatingCompanyOptions}
              expenseCategories={expenseCategories}
              projectId={projectId}
              canEditAccounting={canEditAccounting}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
