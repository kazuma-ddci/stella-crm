import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateCandidatesClient } from "./generate-candidates-client";

export default function GeneratePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">取引候補の検出・生成</h1>

      <Card>
        <CardHeader>
          <CardTitle>取引候補検出</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            対象月を選択して、CRM契約データと定期取引から発生するはずの取引候補を検出します。
            確認後、チェックを入れた候補のみ取引レコードとして生成できます。
          </p>
          <GenerateCandidatesClient />
        </CardContent>
      </Card>
    </div>
  );
}
