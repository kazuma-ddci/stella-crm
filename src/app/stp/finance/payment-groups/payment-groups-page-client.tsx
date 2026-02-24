"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PaymentGroupsTable } from "./payment-groups-table";
import { UngroupedExpensesPanel } from "./ungrouped-expenses-panel";
import type {
  PaymentGroupListItem,
  UngroupedExpenseTransaction,
} from "./actions";

type Props = {
  data: PaymentGroupListItem[];
  ungroupedTransactions: UngroupedExpenseTransaction[];
  counterpartyOptions: { value: string; label: string }[];
  operatingCompanyOptions: { value: string; label: string }[];
  projectId?: number;
};

export function PaymentGroupsPageClient({
  data,
  ungroupedTransactions,
  counterpartyOptions,
  operatingCompanyOptions,
  projectId,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(
    ungroupedTransactions.length > 0 ? "ungrouped" : "list"
  );

  // サマリー計算
  const totalCount = data.length;
  const beforeRequestCount = data.filter(
    (r) => r.status === "before_request"
  ).length;
  const totalAmount = data.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);
  const confirmedAmount = data
    .filter((r) => ["confirmed", "paid"].includes(r.status))
    .reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);

  // 下書き（before_request）の支払グループ
  const draftPaymentGroups = data.filter(
    (r) => r.status === "before_request"
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">支払管理</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ungrouped">
            未処理の取引
            {ungroupedTransactions.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-xs font-medium text-white">
                {ungroupedTransactions.length}
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
            draftPaymentGroups={draftPaymentGroups}
            counterpartyOptions={counterpartyOptions}
            operatingCompanyOptions={operatingCompanyOptions}
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
                  <div className="text-sm text-muted-foreground">依頼前</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {beforeRequestCount}件
                  </div>
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
              projectId={projectId}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
