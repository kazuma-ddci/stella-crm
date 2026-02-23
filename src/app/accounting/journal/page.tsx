import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getJournalEntries, getJournalFormData } from "./actions";
import { JournalTable } from "./journal-table";

export default async function JournalPage() {
  const [entries, formData] = await Promise.all([
    getJournalEntries(),
    getJournalFormData(),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">仕訳処理</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>仕訳一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <JournalTable entries={entries} formData={formData} />
        </CardContent>
      </Card>
    </div>
  );
}
