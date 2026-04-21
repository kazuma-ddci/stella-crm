"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, PlayCircle, CheckCircle2, Link2 } from "lucide-react";
import { FormAnswerEditor, type ModifiedAnswers, type FileInfo } from "@/components/hojo/form-answer-editor";
import { ApplicationSupportCandidateSelector, type AppSupportCandidate } from "@/components/hojo/application-support-candidate-selector";
import { RpaRunConfirmationDialog } from "@/components/hojo/rpa-run-confirmation-dialog";
import { useFormSubmissionEditor } from "@/hooks/use-form-submission-editor";
import { useNavigationGuard, createInternalLinkGuard } from "@/hooks/use-navigation-guard";
import { useRpaRunner } from "@/hooks/use-rpa-runner";

type Props = {
  submissionId: number;
  answers: Record<string, unknown>;
  initialModifiedAnswers: ModifiedAnswers;
  fileUrls: Record<string, FileInfo> | null;
  submittedAt: string;
  confirmedAt: string | null;
  formTranscriptDate: string | null;
  linkedApplicationSupportId: number | null;
  uid: string | null;
  applicationSupportCandidates: AppSupportCandidate[];
  canEdit: boolean;
  // RPA 関連
  subsidyAmount: number | null;
  existingDocTypes: { trainingReport: boolean; supportApplication: boolean; businessPlan: boolean };
  appSupportAnyRunning: boolean; // 同一申請者で何らかの資料が生成中なら RPA実行不可
};

export function FormSubmissionEditClient({
  submissionId,
  answers,
  initialModifiedAnswers,
  fileUrls,
  submittedAt,
  confirmedAt,
  formTranscriptDate,
  linkedApplicationSupportId,
  uid,
  applicationSupportCandidates,
  canEdit,
  subsidyAmount,
  existingDocTypes,
  appSupportAnyRunning,
}: Props) {
  const [selectedLinkId, setSelectedLinkId] = useState<string>(
    linkedApplicationSupportId ? String(linkedApplicationSupportId) : "",
  );

  const editor = useFormSubmissionEditor({
    submissionId,
    linkedApplicationSupportId,
    initialModifiedAnswers,
  });

  useNavigationGuard(editor.hasChanges);
  const linkClickGuard = createInternalLinkGuard(editor.hasChanges);

  const rpa = useRpaRunner(editor, {
    canRun: () => !!linkedApplicationSupportId && !appSupportAnyRunning,
    notLinkedMessage: !linkedApplicationSupportId
      ? "申請者レコードの紐付けが必要です"
      : "この申請者の資料生成中です。完了してからお試しください。",
  });

  const handleLink = () => {
    if (!selectedLinkId) {
      toast.error("紐付け先の申請者レコードを選択してください");
      return;
    }
    editor.link(Number(selectedLinkId));
  };

  const isAutoLinked =
    applicationSupportCandidates.length === 1 && !!linkedApplicationSupportId;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/hojo/form-submissions" onClick={linkClickGuard}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧に戻る
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">フォーム回答 編集</h1>
        <Badge variant="outline">
          回答日時: {new Date(submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
        </Badge>
        {confirmedAt && (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            RPA実行済 {new Date(confirmedAt).toLocaleDateString("ja-JP")}
          </Badge>
        )}
        {formTranscriptDate && (
          <Badge variant="outline">フォーム内容確定日: {formTranscriptDate}</Badge>
        )}
      </div>

      {uid && <div className="text-xs text-gray-500">UID: {uid}</div>}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            申請者レコードとの紐付け
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {applicationSupportCandidates.length === 0 ? (
            <p className="text-sm text-gray-500">
              このUIDに紐付く申請者レコードが見つかりません。支援金管理ページで該当のLINE友達を確認してください。
            </p>
          ) : isAutoLinked ? (
            <p className="text-sm text-gray-700">
              自動紐付け済み:{" "}
              <span className="font-medium">
                {applicationSupportCandidates[0].applicantName ?? "(申請者名未設定)"}
              </span>
              （{new Date(applicationSupportCandidates[0].createdAt).toLocaleDateString("ja-JP")} 作成）
            </p>
          ) : (
            <>
              <ApplicationSupportCandidateSelector
                candidates={applicationSupportCandidates}
                value={selectedLinkId}
                onChange={setSelectedLinkId}
                disabled={!canEdit}
                warning={
                  !linkedApplicationSupportId && applicationSupportCandidates.length > 1
                    ? "同じUIDに複数の申請者レコードがあります。どの申請者の回答として確定するか選択してください。"
                    : null
                }
              />
              {canEdit && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLink}
                    disabled={
                      editor.linking ||
                      !selectedLinkId ||
                      selectedLinkId === String(linkedApplicationSupportId ?? "")
                    }
                  >
                    {editor.linking ? "保存中..." : "紐付け保存"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <FormAnswerEditor
        answers={answers}
        modifiedAnswers={editor.modifiedAnswers}
        fileUrls={fileUrls}
        readOnly={!canEdit}
        onChange={editor.handleChange}
      />

      {canEdit && (
        <div className="sticky bottom-0 bg-white border-t py-3 flex items-center justify-between gap-3 -mx-6 px-6 shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.08)]">
          <div className="text-xs text-gray-500">
            {editor.hasChanges ? "未保存の編集があります（RPA実行時に自動保存されます）" : "変更なし"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => editor.save()}
              disabled={editor.saving || !editor.hasChanges}
            >
              <Save className="h-4 w-4 mr-1" />
              {editor.saving ? "保存中..." : "保存"}
            </Button>
            <Button
              onClick={rpa.openDialog}
              disabled={editor.running || editor.saving || !linkedApplicationSupportId || !!appSupportAnyRunning}
              className="bg-green-600 hover:bg-green-700"
            >
              <PlayCircle className="h-4 w-4 mr-1" />
              {editor.running
                ? "実行中..."
                : appSupportAnyRunning
                  ? "他の資料生成中..."
                  : "RPA実行"}
            </Button>
          </div>
        </div>
      )}

      <RpaRunConfirmationDialog
        open={rpa.dialogOpen}
        onClose={() => rpa.setDialogOpen(false)}
        onConfirm={rpa.confirmRun}
        existing={existingDocTypes}
        subsidyAmount={subsidyAmount}
      />
    </div>
  );
}
