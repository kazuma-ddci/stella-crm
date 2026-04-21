"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, FileText, Archive } from "lucide-react";
import { buildDisplayFileName } from "@/lib/hojo/document-filename";

export type VendorDocumentInfo = {
  docType: string;
  filePath: string;
  fileName: string;
  generatedAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  applicationSupportId: number;
  applicantName: string;
  documents: VendorDocumentInfo[];
};

/**
 * ベンダー用 資料保管モーダル（閲覧＋ダウンロード専用）。
 * 社内用と異なり、再生成・編集・BBS共有などの操作は一切含まれない。
 * 3資料タブ + ヘッダ右上に一括ダウンロード（ZIP）ボタン。
 */
export function VendorDocumentStorageModal({
  open,
  onClose,
  applicationSupportId,
  applicantName,
  documents,
}: Props) {
  const trainingReport = documents.find((d) => d.docType === "training_report");
  const supportApplication = documents.find((d) => d.docType === "support_application");
  const businessPlan = documents.find((d) => d.docType === "business_plan");
  const hasAnyDocument = documents.length > 0;

  const renderTab = (
    doc: VendorDocumentInfo | undefined,
    title: string,
    docType: string,
  ) => {
    if (!doc) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-2">
          <FileText className="h-12 w-12 text-gray-300" />
          <p className="text-sm">まだ{title}が生成されていません</p>
        </div>
      );
    }
    const downloadName = buildDisplayFileName(docType, applicantName, doc.generatedAt);
    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-600">
            生成日時:{" "}
            {new Date(doc.generatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          </div>
          <a href={doc.filePath} download={downloadName}>
            <Button size="sm">
              <Download className="h-4 w-4 mr-1" />
              ダウンロード
            </Button>
          </a>
        </div>
        <iframe
          key={doc.filePath}
          src={`${doc.filePath}?t=${encodeURIComponent(doc.generatedAt)}`}
          className="flex-1 w-full border rounded"
          title={`${title}プレビュー`}
        />
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="h-[85vh] flex flex-col"
        style={{ maxWidth: "calc((100vw - var(--sidebar-w, 0px)) * 0.8)" }}
      >
        <DialogHeader className="flex flex-row items-start justify-between gap-4 pr-8">
          <div className="space-y-1">
            <DialogTitle>資料保管 / {applicantName}</DialogTitle>
            <DialogDescription>
              申請者の資料（PDF）を確認・ダウンロードできます
            </DialogDescription>
          </div>
          <div className="shrink-0">
            <a
              href={`/api/hojo/application-support/${applicationSupportId}/documents-zip`}
              download
            >
              <Button size="sm" disabled={!hasAnyDocument}>
                <Archive className="h-4 w-4 mr-1" />
                一括ダウンロード
              </Button>
            </a>
          </div>
        </DialogHeader>

        <Tabs defaultValue="training_report" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="training_report">研修終了報告書</TabsTrigger>
            <TabsTrigger value="support_application">支援制度申請書</TabsTrigger>
            <TabsTrigger value="business_plan">事業計画書</TabsTrigger>
          </TabsList>
          <TabsContent value="training_report" className="flex-1 flex flex-col min-h-0 mt-4">
            {renderTab(trainingReport, "研修終了報告書", "training_report")}
          </TabsContent>
          <TabsContent value="support_application" className="flex-1 flex flex-col min-h-0 mt-4">
            {renderTab(supportApplication, "支援制度申請書", "support_application")}
          </TabsContent>
          <TabsContent value="business_plan" className="flex-1 flex flex-col min-h-0 mt-4">
            {renderTab(businessPlan, "事業計画書", "business_plan")}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
