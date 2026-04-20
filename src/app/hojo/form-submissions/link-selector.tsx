"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { linkSubmissionToApplicationSupport } from "./[id]/actions";
import {
  ApplicationSupportCandidateSelector,
  type AppSupportCandidate,
} from "@/components/hojo/application-support-candidate-selector";

export type UnlinkedSubmission = {
  id: number;
  tradeName: string;
  fullName: string;
  submittedAt: string;
  uid: string;
  candidates: AppSupportCandidate[];
};

type Props = {
  unlinked: UnlinkedSubmission[];
  canEdit: boolean;
};

export function LinkSelectorBanner({ unlinked, canEdit }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  if (unlinked.length === 0) return null;

  const handleSave = async (submissionId: number) => {
    const appSupportId = selections[submissionId];
    if (!appSupportId) {
      alert("紐付け先を選択してください");
      return;
    }
    setSavingId(submissionId);
    const result = await linkSubmissionToApplicationSupport(submissionId, Number(appSupportId));
    setSavingId(null);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    setSelections((prev) => {
      const next = { ...prev };
      delete next[submissionId];
      return next;
    });
    router.refresh();
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <span className="text-sm font-semibold text-amber-900">
            未紐付けの回答が {unlinked.length} 件あります
          </span>
          <span className="text-xs text-amber-700">
            （同じUIDに複数の申請者レコードが存在するため、どの申請者と紐付けるかを選択してください）
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-amber-700" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-700" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-amber-200">
          {unlinked.map((s) => (
            <div key={s.id} className="rounded bg-white border border-amber-200 p-3 space-y-2">
              <div className="text-sm flex flex-wrap items-center gap-2">
                <span className="font-semibold">{s.tradeName || "(屋号未入力)"}</span>
                {s.fullName && <span className="text-gray-600">{s.fullName}</span>}
                <span className="text-xs text-gray-500">
                  UID: {s.uid} / 回答:{" "}
                  {new Date(s.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </span>
              </div>
              {canEdit ? (
                <>
                  <ApplicationSupportCandidateSelector
                    candidates={s.candidates}
                    value={selections[s.id] ?? ""}
                    onChange={(v) => setSelections((prev) => ({ ...prev, [s.id]: v }))}
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSave(s.id)}
                      disabled={savingId === s.id || !selections[s.id]}
                    >
                      {savingId === s.id ? "保存中..." : "紐付け保存"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-500">閲覧権限のみのため紐付け編集できません</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
