import { notFound } from "next/navigation";
import { loadHojoContactHistoryV2Masters } from "../load-masters";
import {
  ContactHistoryV2Form,
  type ContactHistoryFormInitial,
} from "../contact-history-form";

type SearchParams = Promise<{
  targetType?: string;
  targetId?: string;
  entityName?: string;
}>;

/**
 * HOJO 新接触履歴 (V2) 新規作成ページ。
 *
 * クエリパラメータで作成対象のエンティティを事前指定可能:
 *   ?targetType=hojo_vendor&targetId=123&entityName=株式会社○○
 * これはベンダー詳細等の埋め込みセクションから「新規作成」したときに使用。
 */
export default async function NewHojoContactHistoryV2Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const masters = await loadHojoContactHistoryV2Masters();
  if (!masters) notFound();

  const sp = await searchParams;
  const presetTargetType = sp.targetType;
  const presetTargetIdStr = sp.targetId;
  const presetEntityName = sp.entityName;

  // 事前設定された顧客がある場合、フォームの initial.customers に1件セット
  let initial: ContactHistoryFormInitial | undefined;
  if (presetTargetType) {
    const presetTargetId = presetTargetIdStr
      ? parseInt(presetTargetIdStr, 10)
      : null;
    initial = {
      customers: [
        {
          targetType: presetTargetType,
          targetId: !isNaN(presetTargetId as number) ? presetTargetId : null,
          attendees: [],
        },
      ],
    };
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">接触履歴を新規作成</h1>
        <p className="mt-1 text-sm text-gray-600">
          {presetEntityName
            ? `「${presetEntityName}」との新しい接触履歴を作成します。`
            : "HOJOプロジェクトの新しい接触履歴を作成します。"}
        </p>
      </div>

      <ContactHistoryV2Form mode="create" masters={masters} initial={initial} />
    </div>
  );
}
