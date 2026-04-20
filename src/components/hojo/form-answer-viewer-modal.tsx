"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  type DialogSize,
} from "@/components/ui/dialog";
import { FormAnswerEditor, type FileInfo, type ModifiedAnswers } from "./form-answer-editor";

type Props = {
  answers: Record<string, unknown>;
  modifiedAnswers: ModifiedAnswers | null;
  fileUrls: Record<string, FileInfo> | null;
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: React.ReactNode;
  hideOriginalToggle?: boolean;
  size?: DialogSize;
};

export function FormAnswerViewerModal({
  answers,
  modifiedAnswers,
  fileUrls,
  open,
  onClose,
  title = "フォーム回答データ（閲覧専用）",
  description,
  hideOriginalToggle,
  size,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size={size} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            typeof description === "string"
              ? <DialogDescription>{description}</DialogDescription>
              : <DialogDescription asChild><div>{description}</div></DialogDescription>
          )}
        </DialogHeader>
        <FormAnswerEditor
          answers={answers}
          modifiedAnswers={modifiedAnswers ?? {}}
          fileUrls={fileUrls}
          readOnly
          hideOriginalToggle={hideOriginalToggle}
        />
      </DialogContent>
    </Dialog>
  );
}
