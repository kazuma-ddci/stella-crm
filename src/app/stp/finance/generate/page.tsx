import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { GenerateCandidatesClient } from "./generate-candidates-client";

export default function GeneratePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">取引候補の検出</h1>

      <Card>
        <CardHeader>
          <CardTitle>取引候補検出</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            対象月を選択して、CRM契約データと定期取引から発生するはずの取引候補を検出します。
            チェックを入れた候補を取引化します。
            詳細な金額・按分・メモ・期日/予定日の修正は取引管理で行ってください。
          </p>
          <div className="mb-4 text-sm">
            <Link href="/stp/finance/transactions" className="text-blue-600 hover:underline">
              取引管理を開く →
            </Link>
          </div>
          <GenerateCandidatesClient />
        </CardContent>
      </Card>
    </div>
  );
}
