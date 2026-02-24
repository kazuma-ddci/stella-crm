"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { InvoiceGroupListItem, UngroupedTransaction } from "./actions";
import { InvoiceGroupsTable } from "./invoice-groups-table";
import { UngroupedTransactionsPanel } from "./ungrouped-transactions-panel";

type Props = {
  data: InvoiceGroupListItem[];
  ungroupedTransactions: UngroupedTransaction[];
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
  bankAccountsByCompany: Record<string, { value: string; label: string }[]>;
  projectId?: number;
};

export function InvoicesPageClient({
  data,
  ungroupedTransactions,
  counterpartyOptions,
  operatingCompanyOptions,
  bankAccountsByCompany,
  projectId,
}: Props) {
  const [activeTab, setActiveTab] = useState("ungrouped");

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ungrouped">
            未処理の取引
            {ungroupedTransactions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {ungroupedTransactions.length}
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
            draftInvoiceGroups={draftInvoiceGroups}
            counterpartyOptions={counterpartyOptions}
            operatingCompanyOptions={operatingCompanyOptions}
            bankAccountsByCompany={bankAccountsByCompany}
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
              counterpartyOptions={counterpartyOptions}
              operatingCompanyOptions={operatingCompanyOptions}
              bankAccountsByCompany={bankAccountsByCompany}
              projectId={projectId}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
