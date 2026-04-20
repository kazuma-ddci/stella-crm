"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, PlayCircle, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { FormAnswerEditor, type ModifiedAnswers, type FileInfo } from "@/components/hojo/form-answer-editor";
import { useFormSubmissionEditor } from "@/hooks/use-form-submission-editor";
import { useRpaRunner } from "@/hooks/use-rpa-runner";
import { RpaRunConfirmationDialog } from "@/components/hojo/rpa-run-confirmation-dialog";

export type FormSubmissionDataForModal = {
  id: number;
  submittedAt: string;
  confirmedAt: string | null;
  linkedApplicationSupportId: number | null;
  answers: Record<string, unknown>;
  modifiedAnswers: ModifiedAnswers | null;
  fileUrls: Record<string, FileInfo> | null;
};

type Props = {
  data: FormSubmissionDataForModal;
  thisApplicationSupportId: number;
  canEdit: boolean;
  open: boolean;
  onClose: () => void;
  // RPA用
  subsidyAmount: number | null;
  existingDocTypes: { trainingReport: boolean; supportApplication: boolean; businessPlan: boolean };
};

export function FormAnswerEditModal(props: Props) {
  if (!props.open) return null;
  return <FormAnswerEditModalInner key={props.data.id} {...props} />;
}

function FormAnswerEditModalInner({
  data,
  thisApplicationSupportId,
  canEdit,
  open,
  onClose,
  subsidyAmount,
  existingDocTypes,
}: Props) {
  const editor = useFormSubmissionEditor({
    submissionId: data.id,
    linkedApplicationSupportId: data.linkedApplicationSupportId,
    initialModifiedAnswers: data.modifiedAnswers ?? {},
  });

  const isLinkedToThis = data.linkedApplicationSupportId === thisApplicationSupportId;
  const isLinkedElsewhere =
    data.linkedApplicationSupportId !== null && !isLinkedToThis;
  const effectiveReadOnly = !canEdit || isLinkedElsewhere;

  const rpa = useRpaRunner(editor, {
    canRun: () => isLinkedToThis,
    notLinkedMessage: "このレコードに紐付けてからRPAを実行してください",
  });

  const handleClose = () => {
    if (editor.hasChanges) {
      if (!window.confirm("保存していない編集があります。閉じても大丈夫ですか？")) return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        style={{ maxWidth: "calc((100vw - var(--sidebar-w, 0px)) * 0.8)" }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            フォーム回答データ
            {data.confirmedAt && (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                RPA実行済
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            回答日時: {new Date(data.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
            {data.confirmedAt && (
              <>
                {" / "}RPA実行日時: {new Date(data.confirmedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLinkedElsewhere && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-2">
              <p>
                この回答は別の申請者レコード（ID: {data.linkedApplicationSupportId}）に紐付けられています。編集するには紐付けをこのレコードに変更してください。
              </p>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => editor.link(thisApplicationSupportId)}
                  disabled={editor.linking}
                >
                  {editor.linking ? "変更中..." : "このレコードに紐付け変更"}
                </Button>
              )}
            </div>
          </div>
        )}

        {!data.linkedApplicationSupportId && canEdit && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded p-3">
            <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 space-y-2">
              <p>この回答はまだどの申請者レコードにも紐付けられていません。</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => editor.link(thisApplicationSupportId)}
                disabled={editor.linking}
              >
                {editor.linking ? "紐付け中..." : "このレコードに紐付け"}
              </Button>
            </div>
          </div>
        )}

        <FormAnswerEditor
          answers={data.answers}
          modifiedAnswers={editor.modifiedAnswers}
          fileUrls={data.fileUrls}
          readOnly={effectiveReadOnly}
          onChange={editor.handleChange}
        />

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Link href={`/hojo/form-submissions/${data.id}`} target="_blank">
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" />
              詳細ページを開く
            </Button>
          </Link>
          {canEdit && isLinkedToThis && (
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
                disabled={editor.running || editor.saving}
                className="bg-green-600 hover:bg-green-700"
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                {editor.running ? "実行中..." : "RPA実行"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>

      <RpaRunConfirmationDialog
        open={rpa.dialogOpen}
        onClose={() => rpa.setDialogOpen(false)}
        onConfirm={rpa.confirmRun}
        existing={existingDocTypes}
        subsidyAmount={subsidyAmount}
      />
    </Dialog>
  );
}
