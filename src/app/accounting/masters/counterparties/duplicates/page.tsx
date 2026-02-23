import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { detectDuplicates } from "../actions";
import { DuplicatesCheck } from "./duplicates-check";

export default async function CounterpartyDuplicatesPage() {
  const pairs = await detectDuplicates();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">取引先 重複チェック</h1>
      <Card>
        <CardHeader>
          <CardTitle>重複候補一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <DuplicatesCheck initialPairs={pairs} />
        </CardContent>
      </Card>
    </div>
  );
}
