import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  listContactHistoriesV2,
  listContactHistoriesV2ForEntity,
  countContactHistoriesV2,
  countContactHistoriesV2ForEntity,
} from "@/lib/contact-history-v2/loaders";
import { getTargetTypeLabel } from "@/lib/contact-history-v2/types";
import { ContactHistoriesV2Client } from "./contact-histories-v2-client";

type SearchParams = Promise<{
  targetType?: string;
  targetId?: string;
  entityName?: string;
}>;

/**
 * HOJO 接触履歴 統一版（V2）一覧ページ。
 * 既存の `src/app/hojo/records/contact-histories/` ページはそのまま残し並行稼働。
 * URLパラメータで顧客エンティティ絞込み可。
 */
export default async function HojoContactHistoriesV2Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filterTargetType = sp.targetType;
  const filterTargetIdStr = sp.targetId;
  const filterEntityName = sp.entityName;
  const filterTargetId =
    filterTargetIdStr && !isNaN(parseInt(filterTargetIdStr, 10))
      ? parseInt(filterTargetIdStr, 10)
      : null;

  const isFiltered = !!filterTargetType;

  const [histories, totalCount, scheduledCount, completedCount] = isFiltered
    ? await Promise.all([
        listContactHistoriesV2ForEntity({
          projectCode: "hojo",
          targetType: filterTargetType!,
          targetId: filterTargetId,
          limit: 500,
        }),
        countContactHistoriesV2ForEntity({
          projectCode: "hojo",
          targetType: filterTargetType!,
          targetId: filterTargetId,
        }),
        countContactHistoriesV2ForEntity({
          projectCode: "hojo",
          targetType: filterTargetType!,
          targetId: filterTargetId,
          status: "scheduled",
        }),
        countContactHistoriesV2ForEntity({
          projectCode: "hojo",
          targetType: filterTargetType!,
          targetId: filterTargetId,
          status: "completed",
        }),
      ])
    : await Promise.all([
        listContactHistoriesV2({ projectCode: "hojo", limit: 200 }),
        countContactHistoriesV2({ projectCode: "hojo" }),
        countContactHistoriesV2({ projectCode: "hojo", status: "scheduled" }),
        countContactHistoriesV2({ projectCode: "hojo", status: "completed" }),
      ]);

  const newHref = isFiltered
    ? `/hojo/records/contact-histories-v2/new?targetType=${filterTargetType}${
        filterTargetId !== null ? `&targetId=${filterTargetId}` : ""
      }${filterEntityName ? `&entityName=${encodeURIComponent(filterEntityName)}` : ""}`
    : "/hojo/records/contact-histories-v2/new";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">接触履歴（統一版 v2）</h1>
          {isFiltered ? (
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
              <span>
                {filterEntityName ?? getTargetTypeLabel(filterTargetType!)} の接触履歴のみ表示中
              </span>
              <Link href="/hojo/records/contact-histories-v2">
                <Button variant="ghost" size="sm" className="h-6 px-2">
                  <X className="h-3 w-3 mr-1" /> 絞り込み解除
                </Button>
              </Link>
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-600">
              新しい統一接触履歴テーブル。既存HOJOデータは移行済み。旧ページ（接触履歴）は従来通り動作しています。
            </p>
          )}
        </div>
        <Link href={newHref}>
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
