"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { InvoiceGroupListItem, UngroupedTransaction, UngroupedAllocationItem } from "./actions";
import { InvoiceGroupsTable } from "./invoice-groups-table";
import { UngroupedTransactionsPanel } from "./ungrouped-transactions-panel";

type Props = {
  data: InvoiceGroupListItem[];
  ungroupedTransactions: UngroupedTransaction[];
  ungroupedAllocationItems: UngroupedAllocationItem[];
  stellaCustomerOptions: { value: string; label: string; companyId: number }[];
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
  bankAccountsByCompany: Record<string, { value: string; label: string }[]>;
  defaultBankAccountByCompany: Record<string, string>;
  expenseCategories: { id: number; name: string; type: string }[];
  unconfirmedTransactions: UngroupedTransaction[];
  projectId?: number;
  initialGroupId?: number | null;
};

export function InvoicesPageClient({
  data,
  ungroupedTransactions,
  ungroupedAllocationItems,
  stellaCustomerOptions,
  counterpartyOptions,
  operatingCompanyOptions,
  bankAccountsByCompany,
  defaultBankAccountByCompany,
  expenseCategories,
  unconfirmedTransactions,
  projectId,
  initialGroupId,
}: Props) {
  const [activeTab, setActiveTab] = useState(initialGroupId ? "invoices" : "ungrouped");

  // サマリー
  const totalCount = data.length;
  const draftCount = data.filter((r) => r.status === "draft").length;
  const totalAmount = data
    .filter((r) => r.status !== "corrected")
    .reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);
  const unpaidAmount = data
    .filter((r) =>
      ["sent", "awaiting_accounting", "partially_paid"].includes(r.status)
    )
    .reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);

  // 下書きの請求一覧（UngroupedTransactionsPanelで使用）
  const draftInvoiceGroups = useMemo(
    () => data.filter((r) => r.status === "draft"),
    [data]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">請求管理</h1>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        idBase={`stp-finance-invoices-${projectId ?? "default"}`}
      >
        <TabsList>
          <TabsTrigger value="ungrouped">
            未処理の取引
            {(ungroupedTransactions.length + ungroupedAllocationItems.length) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {ungroupedTransactions.length + ungroupedAllocationItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices">
            請求一覧
            <Badge variant="secondary" className="ml-2">
              {totalCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ungrouped">
          <UngroupedTransactionsPanel
            ungroupedTransactions={ungroupedTransactions}
            ungroupedAllocationItems={ungroupedAllocationItems}
            draftInvoiceGroups={draftInvoiceGroups}
            stellaCustomerOptions={stellaCustomerOptions}
            counterpartyOptions={counterpartyOptions}
            operatingCompanyOptions={operatingCompanyOptions}
            bankAccountsByCompany={bankAccountsByCompany}
            defaultBankAccountByCompany={defaultBankAccountByCompany}
            expenseCategories={expenseCategories}
            unconfirmedTransactions={unconfirmedTransactions}
            projectId={projectId}
          />
        </TabsContent>

        <TabsContent value="invoices">
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
                  <div className="text-sm text-muted-foreground">下書き</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {draftCount}件
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">請求合計</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    ¥{totalAmount.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">未入金</div>
                  <div className="text-2xl font-bold text-rose-600">
                    ¥{unpaidAmount.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            <InvoiceGroupsTable
              data={data}
              stellaCustomerOptions={stellaCustomerOptions}
              counterpartyOptions={counterpartyOptions}
              operatingCompanyOptions={operatingCompanyOptions}
              bankAccountsByCompany={bankAccountsByCompany}
              defaultBankAccountByCompany={defaultBankAccountByCompany}
              expenseCategories={expenseCategories}
              projectId={projectId}
              initialGroupId={initialGroupId}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
