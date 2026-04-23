import {
  listContactHistoriesV2,
  countContactHistoriesV2,
} from "@/lib/contact-history-v2/loaders";
import { ContactHistoriesV2Client } from "./contact-histories-v2-client";

/**
 * SLP 接触履歴 統一版（V2）一覧ページ。
 *
 * Phase 1 時点では新テーブル (contact_histories_v2 ほか) の読み取りのみ対応。
 * 既存の `src/app/slp/records/contact-histories/` ページはそのまま残し、
 * 並行稼働する。データ移行スクリプト実行前はこのページは空一覧が表示される。
 */
export default async function SlpContactHistoriesV2Page() {
  const [histories, totalCount, scheduledCount, completedCount] = await Promise.all([
    listContactHistoriesV2({ projectCode: "slp", limit: 200 }),
    countContactHistoriesV2({ projectCode: "slp" }),
    countContactHistoriesV2({ projectCode: "slp", status: "scheduled" }),
    countContactHistoriesV2({ projectCode: "slp", status: "completed" }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">接触履歴（統一版 v2）</h1>
        <p className="mt-1 text-sm text-gray-600">
          新しい統一接触履歴テーブルのプレビューページ。旧ページ（接触履歴）は従来通り動作しています。
          データ移行スクリプト実行後に、既存データがここに表示されるようになります。
        </p>
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
