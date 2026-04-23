import { notFound } from "next/navigation";
import { loadStpContactHistoryV2Masters } from "../load-masters";
import { ContactHistoryV2Form } from "../contact-history-form";

export default async function NewSlpContactHistoryV2Page() {
  const masters = await loadStpContactHistoryV2Masters();
  if (!masters) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">接触履歴を新規作成（V2）</h1>
        <p className="mt-1 text-sm text-gray-600">
          STPプロジェクトの新しい接触履歴を作成します。
        </p>
      </div>

      <ContactHistoryV2Form mode="create" masters={masters} />
    </div>
  );
}
