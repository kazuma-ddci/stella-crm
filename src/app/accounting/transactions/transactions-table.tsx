"use client";

import Link from "next/link";
import { TransactionStatusBadge } from "./transaction-status-badge";
import { TransactionStatusActions } from "./transaction-status-actions";
import { AllocationStatusButton } from "./allocation-confirmation-panel";

type TransactionRow = {
  id: number;
  type: string;
  amount: number;
  taxAmount: number;
  status: string;
  periodFrom: Date;
  periodTo: Date;
  note: string | null;
  counterparty: { id: number; name: string } | null;
  expenseCategory: { id: number; name: string } | null;
  costCenter: { id: number; name: string } | null;
  project: { id: number; name: string; code: string } | null;
  confirmer: { id: number; name: string } | null;
  confirmedAt: Date | null;
  allocationTemplate: { id: number; name: string } | null;
};

export function TransactionsTable({
  transactions,
}: {
  transactions: TransactionRow[];
}) {
  if (transactions.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        取引データがありません
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-3 py-2 font-medium">種別</th>
            <th className="px-3 py-2 font-medium">発生期間</th>
            <th className="px-3 py-2 font-medium">取引先</th>
            <th className="px-3 py-2 font-medium">費目</th>
            <th className="px-3 py-2 font-medium text-right">金額（税抜）</th>
            <th className="px-3 py-2 font-medium text-right">消費税</th>
            <th className="px-3 py-2 font-medium">プロジェクト</th>
            <th className="px-3 py-2 font-medium">ステータス</th>
            <th className="px-3 py-2 font-medium">確認者</th>
            <th className="px-3 py-2 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr
              key={tx.id}
              className="border-b hover:bg-muted/50 group/row"
            >
              <td className="px-3 py-2">
                {tx.type === "revenue" ? (
                  <span className="text-green-600 font-medium">売上</span>
                ) : (
                  <span className="text-red-600 font-medium">経費</span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {new Date(tx.periodFrom).toLocaleDateString("ja-JP")}
                {" 〜 "}
                {new Date(tx.periodTo).toLocaleDateString("ja-JP")}
              </td>
              <td className="px-3 py-2">{tx.counterparty?.name ?? "-"}</td>
              <td className="px-3 py-2">{tx.expenseCategory?.name ?? "-"}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                ¥{tx.amount.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                ¥{tx.taxAmount.toLocaleString()}
              </td>
              <td className="px-3 py-2">
                {tx.project?.name ?? tx.costCenter?.name ?? "-"}
              </td>
              <td className="px-3 py-2">
                <TransactionStatusBadge status={tx.status} />
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                {tx.confirmer ? (
                  <span>
                    {tx.confirmer.name}
                    {tx.confirmedAt && (
                      <>
                        <br />
                        {new Date(tx.confirmedAt).toLocaleDateString("ja-JP")}
                      </>
                    )}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  {(tx.status === "unconfirmed" || tx.status === "returned") && (
                    <Link
                      href={`/accounting/transactions/${tx.id}/edit`}
                      className="text-xs text-blue-600 hover:underline mr-1"
                    >
                      編集
                    </Link>
                  )}
                  <AllocationStatusButton
                    transactionId={tx.id}
                    hasAllocationTemplate={!!tx.allocationTemplate}
                  />
                  <TransactionStatusActions
                    transactionId={tx.id}
                    status={tx.status}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
