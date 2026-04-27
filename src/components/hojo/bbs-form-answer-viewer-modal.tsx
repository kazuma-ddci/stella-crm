"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BBS_FORM_DESCRIPTION,
  BBS_FORM_ITEMS,
  BBS_FORM_TITLE,
} from "@/lib/hojo/bbs-form-structure";
import {
  BBS_ITEM_RESOLVERS,
  type FileInfo,
} from "@/lib/hojo/bbs-form-mapping";

type Props = {
  open: boolean;
  onClose: () => void;
  answers: Record<string, unknown>;
  modifiedAnswers: Record<string, unknown> | null;
  fileUrls: Record<string, FileInfo> | null;
  description?: React.ReactNode;
};

function AnswerText({ value }: { value: string }) {
  if (!value) return <div className="text-sm text-gray-400 italic">（未回答）</div>;
  return (
    <div className="text-sm whitespace-pre-wrap text-gray-900 border-b border-gray-300 pb-2 min-h-[28px]">
      {value}
    </div>
  );
}

export function BbsFormAnswerViewerModal({
  open,
  onClose,
  answers,
  modifiedAnswers,
  fileUrls,
  description,
}: Props) {
  const ctx = { answers, modifiedAnswers, fileUrls };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="wide" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{BBS_FORM_TITLE}</DialogTitle>
          {description ? (
            typeof description === "string" ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription asChild>
                <div>{description}</div>
              </DialogDescription>
            )
          ) : (
            <DialogDescription>{BBS_FORM_DESCRIPTION}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6 py-2">
          {BBS_FORM_ITEMS.map((item) => {
            if (item.type === "PAGE_BREAK") {
              return (
                <div
                  key={item.id}
                  className="mt-6 first:mt-0 border-l-4 border-[#10b981] pl-3 py-1 bg-[#10b981]/5"
                >
                  <h3 className="text-base font-semibold text-gray-800">
                    {item.title.trim()}
                  </h3>
                </div>
              );
            }

            return (
              <div key={item.id} className="space-y-2">
                <div className="flex items-start gap-1">
                  <div className="text-sm font-medium text-gray-800 whitespace-pre-wrap">
                    {item.title}
                  </div>
                  {item.required && (
                    <span className="text-red-500 text-sm leading-5">*</span>
                  )}
                </div>
                <AnswerText value={BBS_ITEM_RESOLVERS[item.id]?.(ctx) ?? ""} />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
