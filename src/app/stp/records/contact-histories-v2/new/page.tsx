import { notFound } from "next/navigation";
import { loadStpContactHistoryV2Masters } from "../load-masters";
import {
  ContactHistoryV2Form,
  type ContactHistoryFormInitial,
} from "../contact-history-form";

type SearchParams = Promise<{
  targetType?: string;
  targetId?: string;
  entityName?: string;
}>;

export default async function NewStpContactHistoryV2Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const masters = await loadStpContactHistoryV2Masters();
  if (!masters) notFound();

  const sp = await searchParams;
  const presetTargetType = sp.targetType;
  const presetTargetIdStr = sp.targetId;
  const presetEntityName = sp.entityName;

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
            : "STPプロジェクトの新しい接触履歴を作成します。"}
        </p>
      </div>

      <ContactHistoryV2Form mode="create" masters={masters} initial={initial} />
    </div>
  );
}
