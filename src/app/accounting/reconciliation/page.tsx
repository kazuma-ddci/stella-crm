import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getUnmatchedBankTransactions,
  getUnmatchedJournalEntries,
  getReconciliations,
  getReconciliationFormData,
} from "./actions";
import { ReconciliationTable } from "./reconciliation-table";

export default async function ReconciliationPage() {
  const [bankTransactions, journalEntries, reconciliations, formData] =
    await Promise.all([
      getUnmatchedBankTransactions(),
      getUnmatchedJournalEntries(),
      getReconciliations(),
      getReconciliationFormData(),
    ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">消込処理</h1>
      </div>

      <ReconciliationTable
        bankTransactions={bankTransactions}
        journalEntries={journalEntries}
        reconciliations={reconciliations}
        formData={formData}
      />
    </div>
  );
}
