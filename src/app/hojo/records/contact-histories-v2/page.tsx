import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  listContactHistoriesV2,
  countContactHistoriesV2,
} from "@/lib/contact-history-v2/loaders";
import { ContactHistoriesV2Client } from "./contact-histories-v2-client";

/**
 * HOJO 接触履歴 統一版（V2）一覧ページ。
 * 既存の `src/app/hojo/records/contact-histories/` ページはそのまま残し並行稼働。
 * データ移行スクリプト実行前は空一覧が表示される。
 */
export default async function HojoContactHistoriesV2Page() {
  const [histories, totalCount, scheduledCount, completedCount] = await Promise.all([
    listContactHistoriesV2({ projectCode: "hojo", limit: 200 }),
    countContactHistoriesV2({ projectCode: "hojo" }),
    countContactHistoriesV2({ projectCode: "hojo", status: "scheduled" }),
    countContactHistoriesV2({ projectCode: "hojo", status: "completed" }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">接触履歴（統一版 v2）</h1>
          <p className="mt-1 text-sm text-gray-600">
            新しい統一接触履歴テーブル。既存HOJOデータは移行済み。旧ページ（接触履歴）は従来通り動作しています。
          </p>
        </div>
        <Link href="/hojo/records/contact-histories-v2/new">
          <Button>新規作成</Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <SummaryCard label="合計" value={totalCount} />
        <SummaryCard label="予定" value={scheduledCount} />
        <SummaryCard label="実施済" value={completedCount} />
      </div>

      <ContactHistoriesV2Client histories={histories} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-lg border bg-white p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
