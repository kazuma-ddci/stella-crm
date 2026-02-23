import Link from "next/link";
import { getStpTransactionFormData } from "../actions";
import { getSystemProjectContext } from "@/lib/project-context";
import { TransactionForm } from "@/app/accounting/transactions/transaction-form";

export default async function StpNewTransactionPage() {
  const [formData, stpCtx] = await Promise.all([
    getStpTransactionFormData(),
    getSystemProjectContext("stp"),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">取引の新規作成（STP）</h1>
        <Link
          href="/stp/finance/transactions"
          className="text-sm text-blue-600 hover:underline"
        >
          取引管理へ戻る
        </Link>
      </div>
      <TransactionForm
        formData={formData}
        projectContext={stpCtx}
        scope={{ projectCode: "stp" }}
        redirectBasePath="/stp/finance/transactions"
      />
    </div>
  );
}
